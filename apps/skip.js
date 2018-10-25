require('module-alias/register');
var perfy = require('perfy');
var timber = require('timber');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/skip');

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

async function execute() {
    while (true) {
        perfy.start('skip_reqs');
        try {
            await reloadSkip();
            var resultTime = perfy.end('skip_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {}
    }
}
execute();

async function reloadSkip() {
    var reqs = [];
    reqs.push(misc.performRequest(requestOptions.getBikes()));

    console.log("SKIP SCOOTERS || LOADING SCOOTERS");
    responses = await Promise.all(reqs);

    localSkips = [];
    responses.forEach(function (currentResponse) {
        localSkips = localSkips.concat(currentResponse.bikes);
    });
    console.log("SKIP SCOOTERS || RECEIVED " + localSkips.length + " SCOOTERS");

    var dbSkips = await sql.runRaw(`SELECT * FROM \`bike_locs\` WHERE \`COMPANY\` = 'SKIP'`, true);
    var results = compareSkip(localSkips, dbSkips[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries, false);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Skip', 'US', current.bike_id, 1, "scooter", current.lat, current.lon]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lon}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries, false);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`SKIP SCOOTERS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareSkip(localSkip, dbSkip) {
    idsToUpdate = [];

    localSkip.forEach(function (currentSkip) {
        if (dbSkip.some(item => item.id == currentSkip.id)) {
            var similarSkip = dbSkip.filter(skip => skip.id == currentSkip.id);
            if (similarSkip[0].lat != currentSkip.lat || similarSkip[0].lng != currentSkip.lon) {
                const currentSkipLoc = {
                    'latitude': currentSkip.lat,
                    'longitude': currentSkip.lon
                };

                const similarSkipLoc = {
                    'latitude': similarSkip[0].lat,
                    'longitude': similarSkip[0].lng
                };

                if (!haversine(currentSkipLoc, similarSkipLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentSkip);
                }
            }
        }
    });

    var idsToAdd = localSkip.filter(function (currentSkip) {
        return !dbSkip.some(skip => skip.id == currentSkip.bike_id)
    });
    var idsToRemove = dbSkip.filter(function (currentSkip) {
        return !localSkip.some(skip => skip.bike_id == currentSkip.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}