require('module-alias/register');
var turf = require('@turf/turf');
var pLimit = require('p-limit');
var perfy = require('perfy');
var timber = require('timber');
var express = require("express");
var bodyParser = require('body-parser');
var waitUntil = require('async-wait-until');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/bird');

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;
const limit = pLimit(process.env.CONCURRENT_REQUESTS);
const deviceId = process.env.DEVICE_ID;
const bikeSearchRadiusMiles = process.env.BIKE_SEARCH_RADIUS_MILES;

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

var loginToken = undefined;
var authToken = undefined;
var requestsOnToken = 0;

var parkingLocs = undefined;
var circleGeoJSON = [];

async function execute() {
    while (true) {
        perfy.start('bird_reqs');
        await reloadScooters();
        var resultTime = perfy.end('bird_reqs');
        await misc.sleep(45000 - resultTime.fullMilliseconds);
    }
}
execute();

async function reloadScooters() {
    if (requestsOnToken >= 30 || parkingLocs == undefined || circleGeoJSON == undefined || circleGeoJSON == []) {
        parkingLocs = await (sql.regularSelect('parkopedia_parking', '*', ['id'], ['>'], ['0'], null));
        parkingLocs = parkingLocs[0];
        console.log("BIRD SCOOTERS || REFRESHED PARKING SPOTS");

        console.log("BIRD SCOOTERS || CALCULATING PARKING LOC LAT/LNGS")
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
        console.log("BIRD SCOOTERS || TOTAL LAT/LNGS TO CHECK = " + lngLats.length);
    }

    var tokenValid = await isTokenValid();
    if (!tokenValid) {
        console.log("BIRD SCOOTERS || TOKEN INVALID, REFRESHING...");
        var response = await misc.performRequest(requestOptions.loginOptions(process.env.EMAIL, deviceId));
        console.log("BIRD SCOOTERS || USER ID = " + response.id);
        console.log("BIRD SCOOTERS || WAITING FOR EMAIL...");

        var loginToken = await waitForLoginToken();

        console.log("BIRD SCOOTERS || TOKEN RECEIVED = " + loginToken);

        console.log("BIRD SCOOTERS || VERIFYING TOKEN...");
        var auth = await misc.performRequest(requestOptions.verifyOptions(loginToken, deviceId));
        authToken = auth.token;
        console.log("BIRD SCOOTERS || AUTH TOKEN VALID? " + (authToken.length >= 150));
    }

    var reqs = [];
    lngLats.forEach(function (currentLoc) {
        reqs.push(limit(() => misc.performRequest(requestOptions.scooterOptions(currentLoc.lat, currentLoc.lng, 10000, authToken, deviceId))));
    });

    console.log("BIRD SCOOTERS || LOADING SCOOTERS");
    responses = await Promise.all(reqs);
    uniqueBirds = [];
    responses.forEach(function (response) {
        if (typeof response.birds != 'undefined' && response.birds.length != {}) {
            response.birds.forEach(function (currentBird) {
                if (currentBird != {} && currentBird != [] && !uniqueBirds.some(item => item.id == currentBird.id)) {
                    uniqueBirds.push(currentBird);
                }
            });
        }
    });

    requestsOnToken++;
    console.log("BIRD SCOOTERS || RECEIVED " + uniqueBirds.length + " SCOOTERS");
    var dbBirds = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Bird']);

    var results = compareBirds(uniqueBirds, dbBirds[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Bird', 'US', current.id, 1, 'Scooter', current.location.latitude, current.location.longitude, current.battery_level]);
    })
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng', 'battery_level'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.location.latitude}', \`lng\`='${current.location.longitude}', \`battery_level\`='${current.battery_level}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`BIRD SCOOTERS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareBirds(localBirds, dbBirds) {
    idsToUpdate = [];

    localBirds.forEach(function (currentBird) {
        if (dbBirds.some(item => item.id == currentBird.id)) {
            var similarBird = dbBirds.filter(bird => bird.id == currentBird.id);
            if (similarBird[0].lat != currentBird.location.latitude || similarBird[0].lng != currentBird.location.longitude || similarBird[0].battery_level != currentBird.battery_level) {
                const currentBirdLoc = currentBird.location;

                const similarBirdLoc = {
                    'latitude': similarBird[0].lat,
                    'longitude': similarBird[0].lng
                };

                if (!haversine(currentBirdLoc, similarBirdLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    }) || similarBird[0].battery_level != currentBird.battery_level) {
                    idsToUpdate.push(currentBird);
                }

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

var app = express();
app.use(bodyParser.json())

app.post("/", function (req, res) {
    var emailHtml = req.body.html;
    var begString = '<div style="color: #666">';
    var begIndex = emailHtml.indexOf(begString);
    var endString = '</div>';
    var endIndex = emailHtml.indexOf(endString, begIndex);
    currToken = emailHtml.substring(begIndex + begString.length, endIndex).trim();
    loginToken = currToken;
    res.status(200).send("OK");
});

app.listen(3000, function () {
    console.log("BIRD SCOOTERS || LISTENING FOR EMAIL RESPONSE ON PORT 3000");
});

async function waitForLoginToken() {
    return new Promise(function (resolve, reject) {
        waitUntil(function () {
                if (loginToken != undefined) {
                    return loginToken;
                } else {
                    return false;
                }
            }, 15000)
            .then((result) => {
                resolve(result);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

async function isTokenValid() {
    if (authToken == undefined || requestsOnToken >= 120) {
        authToken = undefined;
        requestsOnToken = 0;
        return false;
    } else {
        var userInfo = await misc.performRequest(requestOptions.userOptions(authToken, deviceId));
        if (typeof userInfo != "undefined" && typeof userInfo.id != 'undefined' && userInfo.id.length > 5) {
            return true;
        } else {
            authToken = undefined;
            requestsOnToken = 0;
            return false;
        }
    }
}
