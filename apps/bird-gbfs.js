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
var requestOptions = require('../request-config/bird-gbfs');

//CONSTANTS
const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;
const birdGBFSCities = ['austin', 'dc'];

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
        perfy.start('bird_gbfs_reqs');
        try {
            await reloadBirdGBFS();
            var resultTime = perfy.end('bird_gbfs_reqs');
            await misc.sleep(45000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadBirdGBFS() {
    var reqs = [];
    birdGBFSCities.forEach(function (currentCity) {
        reqs.push(misc.performRequest(requestOptions.getBikes(currentCity)));
    });

    console.log("BIRD GBFS || LOADING SCOOTERS");
    responses = await Promise.all(reqs);

    localBirds = [];
    responses.forEach(function (currentResponse) {
        currentResponse.data.bikes.forEach(function (currentBird) {
            if (!currentBird.reserved && !currentBird.disabled) {
                localBirds.push({
                    'company': 'Bird GBFS',
                    'region': 'US',
                    'id': currentBird.bike_id,
                    'bikes_available': 1,
                    'type': 'scooter',
                    'lat': currentBird.lat,
                    'lng': currentBird.lng
                });
            }
        });
    });

    console.log("BIRD GBFS || RECEIVED " + localBirds.length + " SCOOTERS");

    var dbBirds = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Bird GBFS']);

    var results = compareBikes(localBirds, dbBirds[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push([current.company, current.region, current.id, current.bikes_available, current.type, current.lat, current.lng]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}', \`bikes_available\`='${current.bikes_available}' WHERE \`id\`='${current.id}'; `;
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`BIRD GBFS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareBikes(localBikes, dbBikes) {
    idsToUpdate = [];

    localBikes.forEach(function (currentBike) {
        if (dbBikes.some(item => item.id == currentBike.id)) {
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
                    }) || currentBike.bikes_available != similarBike[0].bikes_available) {
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