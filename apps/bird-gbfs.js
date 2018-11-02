require('module-alias/register');
var perfy = require('perfy');
var timber = require('timber');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/bird-gbfs');

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

const birdGBFSCities = ['austin', 'dc']

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

async function execute() {
    while (true) {
        perfy.start('bird_gbfs_reqs');
        try {
            await reloadBirdGBFS();
            var resultTime = perfy.end('bird_gbfs_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {
            throw e;
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
    responses.forEach(function(currentResponse) {
        localBirds = localBirds.concat(currentResponse.data.bikes.filter(bike => !bike.reserved && !bike.disabled))
    });
    console.log("BIRD GBFS || RECEIVED " + localBirds.length + " SCOOTERS ");

    var dbBirds = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Bird GBFS']);

    var results = compareBirds(localBirds, dbBirds[0]);

    var toRemoveQueries = "";
    results.idsToRemove.forEach(function (current) {
        toRemoveQueries += `DELETE FROM \`bike_locs\` WHERE \`id\` = '${current.id}'; `;
    });
    var removePromise = sql.runRaw(toRemoveQueries);

    formattedObjects = [];
    results.idsToAdd.forEach(function (current) {
        formattedObjects.push(['Bird GBFS', 'US', current.bike_id, 1, 'scooter', current.lat, current.lng, current.battery_level]);
    })
    var addPromise = sql.addObjects('bike_locs', ['company', 'region', 'id', 'bikes_available', 'type', 'lat', 'lng', 'battery_level'], formattedObjects);

    toUpdateQueries = "";
    results.idsToUpdate.forEach(function (current) {
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}', \`battery_level\`='${current.battery_level}' WHERE \`id\`='${current.bike_id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`BIRD GBFS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareBirds(localBirds, dbBirds) {
    idsToUpdate = [];

    localBirds.forEach(function (currentBird) {
        if (dbBirds.some(item => item.id == currentBird.bike_id)) {
            var similarBird = dbBirds.filter(bird => bird.id == currentBird.bike_id);
            if (similarBird[0].lat != currentBird.lat || similarBird[0].lng != currentBird.lng || similarBird[0].battery_level != currentBird.battery_level) {
                const currentBirdLoc = {
                    'latitude': currentBird.lat,
                    'longitude': currentBird.lng
                };

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
        return !dbBirds.some(bird => bird.id == currentBird.bike_id)
    });
    var idsToRemove = dbBirds.filter(function (currentBird) {
        return !localBirds.some(bird => bird.bike_id == currentBird.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}