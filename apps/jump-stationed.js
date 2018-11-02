require('module-alias/register');
var perfy = require('perfy');
var timber = require('timber');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/jump-stationed');

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

const jumpBikeCities = ['den', 'sac', 'sf', 'sc'];
const jumpMobilityCities = ['dc'];

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

async function execute() {
    while (true) {
        perfy.start('jump_stationed_reqs');
        try {
            await reloadJump();
            var resultTime = perfy.end('jump_stationed_reqs');
            await misc.sleep(30000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadJump() {
    var reqs = [];
    jumpBikeCities.forEach(function (currentCity) {
        reqs.push(misc.performRequest(requestOptions.getStationsStatus(currentCity, false)));
        reqs.push(misc.performRequest(requestOptions.getStationInfo(currentCity, false)));
        reqs.push(misc.performRequest(requestOptions.getFreeBikes(currentCity, false)));
    });

    jumpMobilityCities.forEach(function (currentCity) {
        reqs.push(misc.performRequest(requestOptions.getStationsStatus(currentCity, true)));
        reqs.push(misc.performRequest(requestOptions.getStationInfo(currentCity, true)));
        reqs.push(misc.performRequest(requestOptions.getFreeBikes(currentCity, true)));
    });

    console.log("JUMP STATIONED || LOADING BIKES");
    responses = await Promise.all(reqs);

    localBikes = [];
    for (var index = 0; index < reqs.length; index += 3) {
        responses[index].data.stations.forEach(function (currentStationStatus) {
            if (typeof currentStationStatus.is_installed != 'undefined' && currentStationStatus.is_installed == 1 &&
                typeof currentStationStatus.is_renting != 'undefined' && currentStationStatus.is_renting == 1 &&
                typeof currentStationStatus.is_returning != 'undefined' && currentStationStatus.is_returning == 1) {
                currentFormattedBike = {};
                currentFormattedBike['company'] = 'Jump Stationed';
                currentFormattedBike['region'] = 'US';
                currentFormattedBike['id'] = currentStationStatus.station_id;
                currentFormattedBike['bikes_available'] = currentStationStatus.num_bikes_available;
                var similarStation = responses[index + 1].data.stations.filter(station => station.station_id == currentFormattedBike.id);
                if (similarStation.length == 1) {
                    currentFormattedBike['lat'] = similarStation[0].lat;
                    currentFormattedBike['lng'] = similarStation[0].lon;
                }
                localBikes.push(currentFormattedBike);
            }
        })
    }

    for (var index = 2; index < reqs.length; index += 3) {
        responses[index].data.bikes.forEach(function (currentBike) {
            if (typeof currentBike.is_reserved != 'undefined' && currentBike.is_reserved == 0 &&
                typeof currentBike.is_disabled != 'undefined' && currentBike.is_disabled == 0) {
                currentFormattedBike = {};
                currentFormattedBike['company'] = 'Jump Stationed';
                currentFormattedBike['region'] = 'US';
                currentFormattedBike['id'] = currentBike.bike_id;
                currentFormattedBike['name'] = currentBike.name;
                currentFormattedBike['bikes_available'] = 1;
                currentFormattedBike['lat'] = currentBike.lat;
                currentFormattedBike['lng'] = currentBike.lon;
                localBikes.push(currentFormattedBike);
            }
        });
    }

    console.log("JUMP STATIONED || RECEIVED " + localBikes.length + " BIKES AND STATIONS");

    var dbBikes = await sql.regularSelect('bike_locs', '*', ['company'], ['='], ['Jump Stationed']);

    var results = compareJump(localBikes, dbBikes[0]);

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
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}', \`bikes_available\`='${current.bikes_available}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`JUMP STATIONED || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareJump(localBikes, dbBikes) {
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
        return !dbBikes.some(bike => bike.id == currentBike.id)
    });
    var idsToRemove = dbBikes.filter(function (currentBike) {
        return !localBikes.some(bike => bike.id == currentBike.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}