var request = require('request');
const gbfs = require('@gbfs');
var sql = require('@sql');

module.exports = {
    updateGBFS: function () {
        gbfs.feed.systems.forEach(function (system) {
            getBikes(system, function (bikes) {
                sql.remove.regularDelete('bike_locs', ['company'], [system.company], function (rows) {
                    sqlKeys = ['company', 'region', 'id', 'num', 'type', 'lat', 'lng'];
                    sql.insert.addObjects('bike_locs', sqlKeys, bikes, function (results) {
                        console.log("Updated GBFS Data for " + system.company + " at " + new Date());
                    }, function (error) {})
                }, function (error) {});
            }, function (error) {
                console.log("URL: " + system.name + "\t\t ERROR : " + error);
            });
        });
    }
}

function getBikes(system, successCB, failCB) {
    var options = {
        method: 'GET',
        headers: {
            'user-agent': 'insomnia/6.0.2'
        },
        url: system.url
    };
    request(options, function (error, response, body) {
        if (error) {
            failCB(error);
        } else {
            getFeeds(system, body, function (feeds) {
                getInfo(feeds[0], function (parsedStationInfo) {
                        getInfo(feeds[1], function (parsedStationStatuses) {
                            mergeJSON(system, parsedStationInfo, parsedStationStatuses, ['company', 'region', 'type'], function (mergedBikes) {
                                successCB(mergedBikes);
                            }, function (error) {
                                failCB(error);
                            });
                        }, function (error) {
                            failCB(error);
                        });
                    },
                    function (error) {
                        failCB(error);
                    });
            }, function (error) {
                failCB(error);
            });
        }
    });
}

function getFeeds(system, unparsedBody, successCB, failCB) {
    feeds = JSON.parse(unparsedBody).data.en.feeds;
    var stationInfoFeed = "";
    var stationStatusFeed = "";
    feeds.forEach(function (currentFeed) {
        if (currentFeed.name == 'station_information') {
            stationInfoFeed = currentFeed.url;
        } else if (currentFeed.name == 'station_status') {
            stationStatusFeed = currentFeed.url;
        }
    });
    if (stationInfoFeed == "" || stationStatusFeed == "") {
        failCB("STATION INFO AND STATUS URLS NOT FOUND");
    } else {
        successCB([stationInfoFeed, stationStatusFeed]);
    }
}

function getInfo(feed, successCB, failCB) {
    var options = {
        method: 'GET',
        headers: {
            'user-agent': 'insomnia/6.0.2'
        },
        url: feed,
    };
    request(options, function (error, response, body) {
        if (error) {
            failCB(error);
        } else {
            successCB(JSON.parse(body).data.stations);
        }
    });
}

function mergeJSON(systemInfo, stationInfo, stationStatus, extras, successCB, failCB) {
    merged = [];
    for (var index = 0; index < stationInfo.length; index++) {
        tempStation = [];
        tempStation.push(systemInfo.company);
        tempStation.push(systemInfo.region);
        tempStation.push(stationInfo[index].station_id);
        if (typeof stationStatus[index] == 'undefined') {
            return failCB("KEY UNDEFINED ERROR, KEY: " + tempStation['id'] + ", station" + systemInfo.name);
        } else {
            tempStation.push(stationStatus[index].num_bikes_available);
            tempStation.push(systemInfo.type)
            tempStation.push(stationInfo[index].lat);
            tempStation.push(stationInfo[index].lon);
            merged.push(tempStation);
        }
    }
    successCB(merged);
}