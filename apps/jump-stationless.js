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
var requestOptions = require('../request-config/jump-stationless');

//CONSTANTS
const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;
const cities = ['atx', 'chi', 'nyc'];

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
        perfy.start('jump_stationless_reqs');
        try {
            await reloadJump();
            var resultTime = perfy.end('jump_stationless_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadJump() {
    var reqs = [];
    cities.forEach(function (currentCity) {
        reqs.push(misc.performRequest(requestOptions.getBikes(currentCity)));
    });

    console.log("JUMP STATIONLESS || LOADING BIKES");
    responses = await Promise.all(reqs);

    localJumps = [];
    responses.forEach(function (currentResponse) {
        var validJumps = currentResponse.data.bikes.filter(function (jump) {
            return jump.bike_id != 'null' && typeof jump.bike_id != 'undefined' &&
                jump.name != 'null' && typeof jump.name != 'undefined' &&
                jump.lat != 'null' && typeof jump.lat != 'undefined' &&
                jump.lat != 'null' && typeof jump.lon != 'undefined' &&
                jump.is_reserved == 0 &&
                jump.is_disabled == 0;
        });
        localJumps = localJumps.concat(validJumps);
    });
    console.log("JUMP STATIONLESS || RECEIVED " + localJumps.length + " BIKES");

    var dbJumps = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Jump-Stationless']);

    var results = compareJump(localJumps, dbJumps[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Jump-Stationless', 'US', current.bike_id, current.name, 1, "bike", current.lat, current.lon, current.jump_ebike_battery_level]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'name', 'bikes_available', 'type', 'lat', 'lng', 'battery_level'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lon}' WHERE \`id\`='${current.id}'; `;
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`JUMP STATIONLESS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareJump(localJump, dbJump) {
    idsToUpdate = [];

    localJump.forEach(function (currentJump) {
        if (dbJump.some(item => item.id == currentJump.id)) {
            var similarJump = dbJump.filter(jump => jump.id == currentJump.id);
            if (similarJump[0].lat != currentJump.lat || similarJump[0].lng != currentJump.lon) {
                const currentJumpLoc = {
                    'latitude': currentJump.lat,
                    'longitude': currentJump.lon
                };

                const similarJumpLoc = {
                    'latitude': similarJump[0].lat,
                    'longitude': similarJump[0].lng
                };

                if (!haversine(currentJumpLoc, similarJumpLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentJump);
                }
            }
        }
    });

    var idsToAdd = localJump.filter(function (currentJump) {
        return !dbJump.some(jump => jump.id == currentJump.bike_id);
    });
    var idsToRemove = dbJump.filter(function (currentJump) {
        return !localJump.some(jump => jump.bike_id == currentJump.id);
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    };
}