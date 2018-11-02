require('module-alias/register');
var perfy = require('perfy');
var timber = require('timber');
var haversine = require('haversine');

var sql = require('@sql');
var misc = require('@misc');
var requestOptions = require('../request-config/gbfs');
var feeds = require('../config/gbfs-systems').systems;

const locUpdateThresholdMeters = process.env.LOC_UPDATE_THRESHOLD_METERS;

if (process.env.LOCAL == "FALSE") {
    const transport = new timber.transports.HTTPS(process.env.TIMBER_TOKEN);
    timber.install(transport);
}

async function execute() {
    while (true) {
        perfy.start('gbfs_reqs');
        try {
            await reloadGBFS();
            var resultTime = perfy.end('gbfs_reqs');
            await misc.sleep(45000 - resultTime.fullMilliseconds);
        } catch (e) {
            console.log("ERROR: " + JSON.stringify(e));
        }
    }
}
execute();

async function reloadGBFS() {
    var reqs = [];
    console.log("GBFS SYSTEMS || LOADING URLS");
    for (var feedIndex = 0; feedIndex < feeds.length; feedIndex++) {
        var stationInfoOptions = await requestOptions.getStationInfo(feeds[feedIndex]["Auto-Discovery URL"]);
        var stationStatusOptions = await requestOptions.getStationStatus(feeds[feedIndex]["Auto-Discovery URL"]);
        reqs.push(misc.performRequest(stationInfoOptions));
        reqs.push(misc.performRequest(stationStatusOptions));
    }

    console.log("GBFS SYSTEMS || LOADING STATIONS");
    responses = await Promise.all(reqs);

    localStations = [];
    var index = 0;
    var systemIndex = 0;
    while (index < responses.length) {
        stationInfo = responses[index];
        stationStatus = responses[index + 1];

        stationStatus.data.stations.forEach(function (currentStation) {
            var matchingStationInfo = stationInfo.filter(station => station.station_id == currentStation.station_id);
            if (matchingStationInfo.length != 1) {
                throw new Error("None or too many matching stations in cross-analysis of GBFS");
            }
            matchingStationInfo = matchingStationInfo[0];
            localStations.push({
                "id": matchingStationInfo.station_id,
                "company": feeds[systemIndex]["Name"],
                "region": feeds[systemIndex]["Country Code"],
                "bikes_available": currentStation.num_bikes_available,
                "type": "bike",
                "lat": matchingStationInfo.lat,
                "lng": matchingStationInfo.lon
            });
        });
        index += 2;
        systemIndex++;
    }
    console.log("GBFS SYSTEMS || RECEIVED " + localStations.length + " STATIONS");

    var companies = feeds.map(feed => feed["Name"]);
    var operators = Array.apply(null, Array(feeds.length)).map(function () {
        return '=';
    });
    var keys = Array.apply(null, Array(feeds.length)).map(function () {
        return 'company';
    });

    var dbGBFS = await sql.regularSelect('bike_locs', '*', keys, operators, companies);

    var results = compareGBFS(localStations, dbGBFS[0]);

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
        toUpdateQueries += `UPDATE \`bike_locs\` SET \`lat\`='${current.lat}', \`lng\`='${current.lng}' WHERE \`id\`='${current.id}'; `
    });

    var updatePromise = sql.runRaw(toUpdateQueries);

    await Promise.all([removePromise, addPromise, updatePromise]);
    console.log(`GBFS SYSTEMS || SUCCESS: ADDED: ${results.idsToAdd.length}, UPDATED: ${results.idsToUpdate.length}, REMOVED: ${results.idsToRemove.length}`);
}

function compareGBFS(localGBFS, dbGBFS) {
    idsToUpdate = [];

    localGBFS.forEach(function (currentStation) {
        if (dbGBFS.some(item => item.id == currentStation.id)) {
            var similarStation = dbGBFS.filter(station => station.id == currentStation.id);
            if (similarStation[0].lat != currentStation.lat || similarStation[0].lng != currentStation.lng) {
                const currentStationLoc = {
                    'latitude': currentStation.lat,
                    'longitude': currentStation.lng
                };

                const similarStationLoc = {
                    'latitude': similarStation[0].lat,
                    'longitude': similarStation[0].lng
                };

                if (!haversine(currentStationLoc, similarStationLoc, {
                        threshold: locUpdateThresholdMeters,
                        unit: 'meter'
                    })) {
                    idsToUpdate.push(currentStation);
                }
            }
        }
    });

    var idsToAdd = localGBFS.filter(function (currentStation) {
        return !dbGBFS.some(station => station.id == currentStation.id)
    });
    var idsToRemove = dbGBFS.filter(function (currentStation) {
        return !localGBFS.some(station => station.id == currentStation.id)
    });

    return {
        idsToUpdate,
        idsToAdd,
        idsToRemove
    }
}