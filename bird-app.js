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

const deviceId = 'e2c02f06-b414-53ba-9dde-1cfa4b1e0e55'
const emailWaitSecs = process.env.EMAIL_WAIT_SECS;
const bikeSearchRadiusMiles = process.env.BIKE_SEARCH_RADIUS_MILES;

process.env.EMAIL = "parcareapp@gmail.com";
process.env.EMAIL_PASS = "t0Qh%UinRTEvZe3S#a5Q0%";

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

    console.log(lngLats.length);
    var reqs = []
    lngLats.forEach(function (currentLoc) {
        reqs.push(limit(() => performRequest(getScooterOptions(currentLoc.lat, currentLoc.lng, 10000, authToken))));
    });

    perfy.start('bird_reqs');
    responses = await Promise.all(reqs);
    var total = 0;
    uniqueBirds = [];
    responses.forEach(function (response) {
        response.birds.forEach(function (currentBird) {
            if (currentBird != {} && currentBird != [] && typeof currentBird != 'undefined') {
                uniqueBirds.push(currentBird.id);
            }
        });
    });
    var result = perfy.end('bird_reqs');
    console.log("UNIQUE BIRDS : " + countUnique(uniqueBirds));
    console.log("SCRIPT TIME  : " + result.time + " sec.");
    process.exit();
}

function countUnique(iterable) {
    return new Set(iterable).size;
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