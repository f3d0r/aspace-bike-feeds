var request = require('request');
var fs = require('fs');
var uniqueString = require('unique-string');

module.exports = {
    getBikes: function (system, successCB, failCB) {
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
        tempStation = {};
        tempStation['id'] = stationInfo[index].station_id;
        tempStation['lat'] = stationInfo[index].lat;
        tempStation['lng'] = stationInfo[index].lon;
        if (typeof stationStatus[index] == 'undefined') {
            return failCB("KEY UNDEFINED ERROR, KEY: " + tempStation['id'] + ", station" + systemInfo.name);
        } else {
            tempStation['bikes_available'] = stationStatus[index].num_bikes_available;
            for (extraIndex = 0; extraIndex < extras.length; extraIndex++) {
                tempStation[extras[extraIndex]] = systemInfo[extras[extraIndex]];
            }
            merged.push(tempStation);
        }
    }
    successCB(merged);
}