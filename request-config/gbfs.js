var misc = require('@misc');

module.exports = {
    getStationInfo: async function (baseURL) {
        var formattedURL = await getFeedURL(baseURL, "station_information");
        return {
            method: 'GET',
            url: formattedURL,
            headers: {},
            timeout: 15000,
            json: true
        };
    },
    getStationStatus: async function (baseURL) {
        var formattedURL = await getFeedURL(baseURL, "station_status");
        return {
            method: 'GET',
            url: formattedURL,
            headers: {},
            timeout: 15000,
            json: true
        };
    },
    getFreeBikes: async function (baseURL) {
        var formattedURL = await getFeedURL(baseURL, "free_bike_status");
        return {
            method: 'GET',
            url: formattedURL,
            headers: {},
            timeout: 15000,
            json: true
        };
    }
}

async function getFeedURL(url, feedName) {
    var feedOptions = {
        method: 'GET',
        url: url,
        headers: {},
        timeout: 15000,
        json: true
    };
    results = await misc.performRequest(feedOptions);

    var matchingFeeds = undefined;
    if (typeof results.data.en == 'undefined') {
        matchingFeeds = results.data.feeds.filter(function (feed) {
            return feed.name == feedName;
        });
    } else {
        matchingFeeds = results.data.en.feeds.filter(function (feed) {
            return feed.name == feedName;
        });
    }
    if (matchingFeeds.length == 1) {
        return matchingFeeds[0].url;
    } else {
        throw new Error('No matching feeds found');
    }
}