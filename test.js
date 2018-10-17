var imaps = require('imap-simple');
var request = require('request');
var sleep = require('sleep-promise');
var csvToJson = require('csvtojson');
var turf = require('@turf/turf');

const pLimit = require('p-limit');

const limit = pLimit(500);

const email = 'parcareapp@gmail.com';
const deviceId = 'e2c02f06-b414-53ba-9dde-1cfa4b1e0e55'
const emailWaitSecs = 5;

const parkingLocsFile = 'parkopedia_parking.csv'

const bikeSearchRadiusMiles = 1;


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
        email: email
    },
    json: true
};

var config = {
    imap: {
        user: email,
        password: 't0Qh%UinRTEvZe3S#a5Q0%',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000
    }
};

init();

async function init() {
    const parkingLocs = await csvToJson().fromFile(parkingLocsFile);
    reloadScooters(parkingLocs)
}

async function reloadScooters(parkingLocs) {
    var response = await performRequest(loginOptions);
    console.log(response);
    console.log("Waiting...");
    await sleep(emailWaitSecs * 1000);
    console.log("Done waiting...");
    var token = await getEmailVerifyCode();
    console.log("TOKEN: " + token);
    console.log("Verifying token...");
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

    console.log("-------- STARTED!");
    Promise.all(reqs)
        .then(function (responses) {
            console.log("-------- ENDED!");
            var total = 0;
            uniqueBirds = [];
            responses.forEach(function (response) {
                response.birds.forEach(function(currentBird) {
                    if (currentBird != {} && currentBird != [] && typeof currentBird != 'undefined') {
                        uniqueBirds.push(currentBird.id);
                    }
                })
            })
            console.log("UNIQUE BIRDS: " + countUnique(uniqueBirds));
        })
        .catch(function (error) {
            throw error;
        });
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