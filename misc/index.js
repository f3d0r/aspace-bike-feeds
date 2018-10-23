var request = require('request');
var HttpsProxyAgent = require('https-proxy-agent');
var cloudscraper = require('cloudscraper');
var sql = require('@sql');

var proxy = 'http://207.229.93.66:1027';
var agent = new HttpsProxyAgent(proxy);

var jar = request.jar();
jar.setCookie(request.cookie("__cfduid=de2977286a70a4b3af3852bb134274c711540257577"), "https://api.bird.co/user/login");

module.exports = {
    sleep: function (ms) {
        if (ms > 0) {
            return new Promise(resolve => setTimeout(resolve, ms));
        } else {
            return Promise.resolve();
        }
    },
    performRequest: function (requestOptions) {
        return new Promise(function (resolve, reject) {
            requestOptions.headers['User-Agent'] = "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.6) Gecko/20070725 Firefox/2.0.0.6";
            requestOptions.agent = agent;
            requestOptions.jar = 'JAR';
            cloudscraper.request(requestOptions, function (error, response, body) {
                if (error) {
                    console.log("HERE:")
                    console.log(JSON.stringify(error))
                    reject(error);
                } else {
                    resolve(response.body);
                }
            });
        });
    },
    getComparePromises: function (databaseName, lngKeyName, latKeyName, addObjectsKeys, systemName, compareResults, transportType = "bike", batteryLevelExists = false) {
        var toRemoveQueries = "";
        compareResults.idsToRemove.forEach(function (current) {
            toRemoveQueries += `DELETE FROM \`${databaseName}\` WHERE \`id\` = '${current.id}'; `;
        });
        var removePromise = sql.runRaw(toRemoveQueries);

        formattedObjects = [];
        compareResults.idsToAdd.forEach(function (current) {
            formattedObjects.push([systemName, 'US', current.bike_id, current.name, 1, transportType, current.lat, current.lon, current.jump_ebike_battery_level]);
        });
        var addPromise = sql.addObjects(databaseName, addObjectsKeys, formattedObjects);

        toUpdateQueries = "";
        compareResults.idsToUpdate.forEach(function (current) {
            toUpdateQueries += `UPDATE \`${databaseName}\` SET \`lat\`='${current[latKeyName]}', \`lng\`='${current[lngKeyName]}' WHERE \`id\`='${current.id}'; `
        });
        var updatePromise = sql.runRaw(toUpdateQueries);

        return {
            removePromise,
            addPromise,
            updatePromise
        }
    },
    getGBFSPromises: function () {

    }
}