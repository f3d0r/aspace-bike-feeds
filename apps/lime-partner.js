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
var requestOptions = require('../request-config/lime-partner');

//CONSTANTS
const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;
const partnerCities = ['Seattle', 'Washington DC Proper'];

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
        perfy.start('lime_partner_reqs');
        try {
            await reloadLime();
            var resultTime = perfy.end('lime_partner_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadLime() {
    var reqs = [];
    partnerCities.forEach(function (currentRegion) {
        reqs.push(misc.performRequest(requestOptions.getBikes(currentRegion)));
    });

    console.log("LIME PARTNERS || LOADING BIKES");
    responses = await Promise.all(reqs);

    localLimes = [];
    responses.forEach(function (currentResponse) {
        localLimes = localLimes.concat(currentResponse.data);
    });
    console.log("LIME PARTNERS || RECEIVED " + localLimes.length + " BIKES");

    var dbLimes = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Lime-Partner']);

    var results = compareLime(localLimes, dbLimes[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Lime-Partner', 'US', current.id, 1, current.attributes.vehicle_type, current.attributes.latitude, current.attributes.longitude]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.attributes.latitude}', \`lng\`='${current.attributes.longitude}' WHERE \`id\`='${current.id}'; `;
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`LIME PARTNERS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareLime(localLime, dbLime) {
    idsToUpdate = [];

    localLime.forEach(function (currentLime) {
        if (dbLime.some(item => item.id == currentLime.id)) {
            var similarLime = dbLime.filter(lime => lime.id == currentLime.id);
            if (similarLime[0].lat != currentLime.attributes.latitude || similarLime[0].lng != currentLime.attributes.longitude) {
                const currentLimeLoc = {
                    'latitude': currentLime.attributes.latitude,
                    'longitude': currentLime.attributes.longitude
                };

                const similarLimeLoc = {
                    'latitude': similarLime[0].lat,
                    'longitude': similarLime[0].lng
                };

                if (!haversine(currentLimeLoc, similarLimeLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentLime);
                }
            }
        }
    });

    var idsToAdd = localLime.filter(function (currentLime) {
        return !dbLime.some(lime => lime.id == currentLime.id);
    });
    var idsToRemove = dbLime.filter(function (currentLime) {
        return !localLime.some(lime => lime.id == currentLime.id);
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    };
}