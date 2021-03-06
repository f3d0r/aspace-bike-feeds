//GLOBAL IMPORTS
require('module-alias/register');

//PACKAGE IMPORTS
var perfy = require('perfy');
var haversine = require('haversine');
var Logger = require('logdna');
var ip = require('ip');
var os = require('os');

//LOCAL IMPORTS
var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/nextbike');

//CONSTANTS
const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

//LOGGING SETUP
var logger = Logger.setupDefaultLogger(process.env.LOG_DNA_API_KEY, {
    hostname: os.hostname(),
    ip: ip.address(),
    app: process.env.APP_NAME,
    env: process.env.ENV_NAME,
    index_meta: true,
    tags: process.env.APP_NAME + ',' + process.env.ENV_NAME + ',' + os.hostname()
});
console.log = function (d) {
    process.stdout.write(d + '\n');
    logger.log(d);
};
logger.write = function (d) {
    console.log(d);
};

//MAIN SCRIPT
async function execute() {
    while (true) {
        perfy.start('nextbike_reqs');
        try {
            await reloadNextbike();
            var resultTime = perfy.end('nextbike_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadNextbike() {
    var reqs = [];
    reqs.push(misc.performRequest(requestOptions.getBikes()));

    console.log("NEXTBIKE BIKES || LOADING BIKES");
    responses = await Promise.all(reqs);

    localStations = [];
    responses.forEach(function (currentResponse) {
        if (typeof currentResponse.countries != 'undefined' && currentResponse.countries != {}) {
            currentResponse.countries.forEach(function (currentCountry) {
                if (typeof currentCountry != 'undefined' && currentCountry != {}) {
                    var region = currentCountry.country;
                    currentCountry.cities.forEach(function (currentCity) {
                        if (typeof currentCity != 'undefined' && currentCity != {}) {
                            currentCity.places.forEach(function (currentPlace) {
                                if (typeof currentPlace != 'undefined' && currentPlace != {} && currentPlace.region != 'undefined' && currentPlace.region != '') {
                                    if (!currentPlace.maintenance && currentPlace.uid != 'undefined' && currentPlace.bikes != 'undefined' &&
                                        currentPlace.lat != 'undefined' && currentPlace.lng != 'undefined') {
                                        localStations.push({
                                            "id": currentPlace.uid,
                                            "company": "Nextbike",
                                            "region": region,
                                            "bikes_available": currentPlace.bikes,
                                            "lat": currentPlace.lat,
                                            "lng": currentPlace.lng
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
    console.log("NEXTBIKE BIKES || RECEIVED " + localStations.length + " STATIONS");

    var dbBikes = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Nextbike']);

    var results = compareNextBikes(localStations, dbBikes[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Nextbike', current.region, current.id, current.bikes_available, "bike", current.lat, current.lng]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}' WHERE \`id\`='${current.id}'; `;
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`NEXTBIKE BIKES || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareNextBikes(localBikes, dbBikes) {
    idsToUpdate = [];

    localBikes.forEach(function (currentBike) {
        if (dbBikes.some(bike => bike.id == currentBike.id)) {
            var similarBike = dbBikes.filter(bike => bike.id == currentBike.id);
            if (similarBike[0].lat != currentBike.lat || similarBike[0].lng != currentBike.lng) {
                const currentBikeLoc = {
                    'latitude': currentBike.lat,
                    'longitude': currentBike.lng
                };

                const similarBikeLoc = {
                    'latitude': similarBike[0].lat,
                    'longitude': similarBike[0].lng
                };

                if (!haversine(currentBikeLoc, similarBikeLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentBike);
                }
            }
        }
    });

    var idsToAdd = localBikes.filter(function (currentBike) {
        return !dbBikes.some(bike => bike.id == currentBike.id);
    });
    var idsToRemove = dbBikes.filter(function (currentBike) {
        return !localBikes.some(bike => bike.id == currentBike.id);
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    };
}