var request = require('request');
var HttpsProxyAgent = require('https-proxy-agent');
var sql = require('@sql');

var proxy = 'http://fedor:3Q$Y&Q$K&zfBEZEHxay7Q9@us-wa.proxymesh.com:31280';
var agent = new HttpsProxyAgent(proxy);

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
            requestOptions.headers['User-Agent'] = "insomnia/6.0.2";
            requestOptions.agent = agent;
            request(requestOptions, function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
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