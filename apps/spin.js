require('module-alias/register');
var request = require('request');
var perfy = require('perfy');
var timber = require('timber');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/spin');

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

async function execute() {
    while (true) {
        perfy.start('spin_reqs');
        try {
            await reloadSpin();
            var resultTime = perfy.end('spin_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {}
    }
}
execute();

async function reloadSpin() {
    var reqs = [];
    reqs.push(misc.performRequest(requestOptions.getBikes()));

    console.log("SPIN BIKES || LOADING BIKES");
    responses = await Promise.all(reqs);

    localSpins = [];
    responses.forEach(function (currentResponse) {
        var validSpins = currentResponse.data.bikes.filter(function (spin) {
            return typeof spin.bike_id != 'undefined' & spin.lat != null && typeof spin.lat != 'undefined' & spin.lat != null && typeof spin.lon != 'undefined' & spin.lon != null && spin.is_reserved == 0 && spin.is_disabled == 0;
        });
        localSpins = localSpins.concat(validSpins);
    });
    console.log("SPIN BIKES || RECEIVED " + localSpins.length + " BIKES");

    var dbSpins = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Spin']);

    var results = compareSpin(localSpins, dbSpins[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Spin', 'US', current.bike_id, 1, "bike", current.lat, current.lon]);
    });
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lon}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`SPIN BIKES || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareSpin(localSpin, dbSpin) {
    idsToUpdate = [];

    localSpin.forEach(function (currentSpin) {
        if (dbSpin.some(item => item.id == currentSpin.id)) {
            var similarSpin = dbSpin.filter(spin => spin.id == currentSpin.id);
            if (similarSpin[0].lat != currentSpin.lat || similarSpin[0].lng != currentSpin.lon) {
                const currentSpinLoc = {
                    'latitude': currentSpin.lat,
                    'longitude': currentSpin.lon
                };

                const similarSpinLoc = {
                    'latitude': similarSpin[0].lat,
                    'longitude': similarSpin[0].lng
                };

                if (!haversine(currentSpinLoc, similarSpinLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentSpin);
                }
            }
        }
    });

    var idsToAdd = localSpin.filter(function (currentSpin) {
        return !dbSpin.some(spin => spin.id == currentSpin.bike_id)
    });
    var idsToRemove = dbSpin.filter(function (currentSpin) {
        return !localSpin.some(spin => spin.bike_id == currentSpin.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}