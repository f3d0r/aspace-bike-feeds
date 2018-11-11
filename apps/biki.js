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
var requestOptions = require('../request-config/biki');

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
        perfy.start('biki_reqs');
        try {
            await reloadBiki();
            var resultTime = perfy.end('biki_reqs');
            await misc.sleep(45000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadBiki() {
    var reqs = [];
    reqs.push(misc.performRequest(requestOptions.getStationsStatus()));
    reqs.push(misc.performRequest(requestOptions.getStationInfo()));

    console.log("BIKI BIKES || LOADING BIKES");
    responses = await Promise.all(reqs);

    localBiki = [];
    responses[0].data.stations.forEach(function (currentStationStatus) {
        if (typeof currentStationStatus.is_installed != 'undefined' && currentStationStatus.is_installed == 1 &&
            typeof currentStationStatus.is_renting != 'undefined' && currentStationStatus.is_renting == 1 &&
            typeof currentStationStatus.is_returning != 'undefined' && currentStationStatus.is_returning == 1) {
            currentFormattedBike = {};
            currentFormattedBike.company = 'Biki';
            currentFormattedBike.region = 'US';
            currentFormattedBike.id = 'biki-' + currentStationStatus.station_id;
            currentFormattedBike.bikes_available = currentStationStatus.num_bikes_available;
            var similarStation = responses[1].data.stations.filter(station => 'biki-' + station.station_id == currentFormattedBike.id);
            if (similarStation.length == 1) {
                currentFormattedBike.lat = similarStation[0].lat;
                currentFormattedBike.lng = similarStation[0].lon;
            } else {
                console.log(similarStation.length);
            }
            localBiki.push(currentFormattedBike);
        }
    });

    console.log("BIKI BIKES || RECEIVED " + localBiki.length + " STATIONS");

    var dbBiki = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Biki']);

    var results = compareBiki(localBiki, dbBiki[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push([current.company, current.region, current.id, current.bikes_available, 'stationed_bikes', current.lat, current.lng]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}', \`bikes_available\`='${current.bikes_available}' WHERE \`id\`='${current.id}'; `;
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`BIKI BIKES || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareBiki(localBiki, dbBiki) {
    idsToUpdate = [];

    localBiki.forEach(function (currentBiki) {
        if (dbBiki.some(item => item.id == currentBiki.id)) {
            var similarBiki = dbBiki.filter(biki => biki.id == currentBiki.id);
            if (similarBiki[0].lat != currentBiki.lat || similarBiki[0].lng != currentBiki.lng) {
                const currentBikiLoc = {
                    'latitude': currentBiki.lat,
                    'longitude': currentBiki.lng
                };

                const similarBikiLoc = {
                    'latitude': similarBiki[0].lat,
                    'longitude': similarBiki[0].lng
                };

                if (!haversine(currentBikiLoc, similarBikiLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    }) || currentBiki.bikes_available != similarBiki[0].bikes_available) {
                    idsToUpdate.push(currentBiki);
                }
            }
        }
    });

    var idsToAdd = localBiki.filter(function (currentBiki) {
        return !dbBiki.some(biki => biki.id == currentBiki.id);
    });
    var idsToRemove = dbBiki.filter(function (currentBiki) {
        return !localBiki.some(biki => biki.id == currentBiki.id);
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    };
}