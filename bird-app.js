require('module-alias/register');
var imaps = require('imap-simple');
var request = require('request');
var sleep = require('sleep-promise');
var turf = require('@turf/turf');
var pLimit = require('p-limit');
var perfy = require('perfy');
var timber = require('timber');

var sql = require('@sql');

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

const limit = pLimit(process.env.CONCURRENT_REQUESTS);

const deviceId = process.env.DEVICE_ID;
const emailWaitSecs = process.env.EMAIL_WAIT_SECS;
const bikeSearchRadiusMiles = process.env.BIKE_SEARCH_RADIUS_MILES;

var loginOptions = {
    method: 'POST',
    url: 'https://api.bird.co/user/login',
    headers: {
        'app-version': '3.0.5',
        'platform': 'ios',
        'device-id': deviceId,
        'content-type': 'application/json'
    },
    body: {
        email: process.env.EMAIL
    },
    json: true
};

var config = {
    imap: {
        user: process.env.EMAIL,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000
    }
};

reloadScooters();

async function reloadScooters() {
    parkingLocs = await (sql.select.regularSelect('parkopedia_parking', '*', ['id'], ['>'], ['0'], null));
    parkingLocs = parkingLocs[0];
    console.log("TOTAL PARKING SPOTS : " + parkingLocs.length);

    var response = await performRequest(loginOptions);
    console.log("USER ID: " + response.id);
    console.log("Waiting for email ...");

    await sleep(emailWaitSecs * 1000);

    console.log("Checking email   ...");
    var token = await getEmailVerifyCode();
    console.log("TOKEN RECEIVED   : " + token);

    console.log("Verifying token  ...");
    var auth = await performRequest(getVerifyOptions(token));
    var authToken = auth.token;
    console.log("AUTH TOKEN: " + authToken);

    circleGeoJSON = [];

    parkingLocs.forEach(function (currentLoc) {
        var center = [currentLoc.lng, currentLoc.lat];
        var radius = bikeSearchRadiusMiles;
        var options = {
            steps: 6,
            units: 'miles'
        };
        var circle = turf.circle(center, radius, options);
        circleGeoJSON.push(circle);
    });

    lngLats = [];
    circleGeoJSON.forEach(function (currentGeoJSON) {
        currentGeoJSON.geometry.coordinates[0].forEach(function (currentLngLat) {
            lngLats.push({
                'lng': currentLngLat[0],
                'lat': currentLngLat[1],
            });
        })
    });

    console.log("TOTAL LAT/LNGS TO CHECK : " + lngLats.length);
    var reqs = []
    lngLats.forEach(function (currentLoc) {
        reqs.push(limit(() => performRequest(getScooterOptions(currentLoc.lat, currentLoc.lng, 10000, authToken))));
    });

    perfy.start('bird_reqs');
    responses = await Promise.all(reqs);
    uniqueBirds = [];
    responses.forEach(function (response) {
        response.birds.forEach(function (currentBird) {
            if (currentBird != {} && currentBird != [] && !uniqueBirds.some(item => item.id == currentBird.id)) {
                uniqueBirds.push(currentBird);
            }
        });
    });
    var result = perfy.end('bird_reqs');
    console.log("UNIQUE BIRDS : " + uniqueBirds.length);
    console.log("SCRIPT TIME  : " + result.time + " sec.");
    console.log(JSON.stringify(uniqueBirds[0]));
    var dbBirds = await sql.select.regularSelect('bike_locs', '*', ['company'], ['='], ['Bird']);

    var results = compareBirds(uniqueBirds, dbBirds[0]);
    console.log("# ADDED: " + results.idsToAdd.length);
    console.log("# UPDATED: " + results.idsToUpdate.length);
    console.log("# REMOVED: " + results.idsToRemove.length);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Bird', 'USA', current.id, 1, 'Scooter', current.location.latitude, current.location.longitude, current.battery_level]);
    })
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng', 'battery_level'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.location.latitude}', \`lng\`='${current.location.longitude}', \`battery_level\`='${current.battery_level}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log("DONE!");
    await sleep(5000);
    process.exit();
}

function compareBirds(localBirds, dbBirds) {
    idsToUpdate = [];

    localBirds.forEach(function (currentBird) {
        if (dbBirds.some(item => item.id == currentBird.id)) {
            var similarBird = dbBirds.filter(bird => bird.id == currentBird.id);
            if (similarBird[0].lat != currentBird.location.latitude || similarBird[0].lng != currentBird.location.longitude || similarBird[0].battery != currentBird.battery_level) {
                idsToUpdate.push(currentBird);
            }
        }
    });

    var idsToAdd = localBirds.filter(function (currentBird) {
        return !dbBirds.some(bird => bird.id == currentBird.id)
    });
    var idsToRemove = dbBirds.filter(function (currentBird) {
        return !localBirds.some(bird => bird.id == currentBird.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}

async function getEmailVerifyCode() {
    return new Promise(function (resolve, reject) {
        imaps.connect(config).then(function (connection) {
            return connection.openBox('INBOX').then(function () {
                var searchCriteria = [
                    'ALL'
                ];
                var fetchOptions = {
                    bodies: ['HEADER', 'TEXT'],
                    markSeen: false
                };
                return connection.search(searchCriteria, fetchOptions).then(function (results) {
                    var messages = results.map(function (res) {
                        return res.parts.filter(function (part) {
                            return part;
                        })[0].body
                    });
                    var tokens = [];
                    messages.forEach(function (current) {
                        var mostRecentEmail = current;
                        var begString = '<div style="color: #666">';
                        var begIndex = mostRecentEmail.indexOf(begString);
                        var endString = '</div>';
                        var endIndex = mostRecentEmail.indexOf(endString, begIndex);
                        tokens.push(mostRecentEmail.substring(begIndex + begString.length, endIndex).trim());
                    });
                    resolve(tokens[tokens.length - 1]);
                });
            });
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function performRequest(requestOptions) {
    return new Promise(function (resolve, reject) {
        request(requestOptions, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
}

function getScooterOptions(lat, lng, radius, authToken) {
    var location = {
        "latitude": lat,
        "longitude": lng,
        "altitude": 500,
        "accuracy": 100,
        "speed": -1,
        "heading": -1
    }
    return options = {
        method: 'GET',
        url: 'https://api.bird.co/bird/nearby',
        qs: {
            latitude: lat,
            longitude: lng,
            radius: radius
        },
        headers: {
            location: JSON.stringify(location),
            'app-version': '3.0.5',
            'device-id': deviceId,
            authorization: 'Bird ' + authToken
        },
        json: true
    };
}

function getVerifyOptions(token) {
    return verifyOptions = {
        method: 'PUT',
        url: 'https://api.bird.co/request/accept',
        headers: {
            'app-version': '3.0.5',
            'platform': 'ios',
            'device-id': deviceId,
            'content-type': 'application/json'
        },
        body: {
            token: token
        },
        json: true
    };
}