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
var requestOptions = require('../request-config/biketown');

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
        perfy.start('biketown_reqs');
        try {
            await reloadBikeTown();
            var resultTime = perfy.end('biketown_reqs');
            await misc.sleep(45000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadBikeTown() {
    var reqs = [];
    reqs.push(misc.performRequest(requestOptions.getStationsStatus()));
    reqs.push(misc.performRequest(requestOptions.getStationInfo()));
    reqs.push(misc.performRequest(requestOptions.getFreeBikes()));

    console.log("BIKETOWN BIKES || LOADING BIKES");
    responses = await Promise.all(reqs);

    localBikes = [];
    responses[0].data.stations.forEach(function (currentStationStatus) {
        if (typeof currentStationStatus.is_installed != 'undefined' && currentStationStatus.is_installed == 1 &&
            typeof currentStationStatus.is_renting != 'undefined' && currentStationStatus.is_renting == 1 &&
            typeof currentStationStatus.is_returning != 'undefined' && currentStationStatus.is_returning == 1) {
            currentFormattedBike = {};
            currentFormattedBike.company = 'Biketown PDX';
            currentFormattedBike.region = 'US';
            currentFormattedBike.id = currentStationStatus.station_id;
            currentFormattedBike.bikes_available = currentStationStatus.num_bikes_available;
            var similarStation = responses[1].data.stations.filter(station => station.station_id == currentFormattedBike.id);
            if (similarStation.length == 1) {
                currentFormattedBike.lat = similarStation[0].lat;
                currentFormattedBike.lng = similarStation[0].lon;
            }
            localBikes.push(currentFormattedBike);
        }
    });
    responses[2].data.bikes.forEach(function (currentBike) {
        if (typeof currentBike.is_reserved != 'undefined' && currentBike.is_reserved == 0 &&
            typeof currentBike.is_disabled != 'undefined' && currentBike.is_disabled == 0) {
            currentFormattedBike = {};
            currentFormattedBike.company = 'Biketown PDX';
            currentFormattedBike.region = 'US';
            currentFormattedBike.id = currentBike.bike_id;
            currentFormattedBike.name = currentBike.name;
            currentFormattedBike.bikes_available = 1;
            currentFormattedBike.lat = currentBike.lat;
            currentFormattedBike.lng = currentBike.lon;
            localBikes.push(currentFormattedBike);
        }
    });

    console.log("BIKETOWN BIKES || RECEIVED " + localBikes.length + " BIKES AND STATIONS");

    var dbBikes = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Biketown PDX']);

    var results = compareBikes(localBikes, dbBikes[0]);

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
    console.log(`BIKETOWN BIKES || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
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