var constants = require('@config');
var request = require('request');
var sql = require('@sql');

module.exports = {
    update: function () {
        getScooters(constants.skip_scooters.url, function (response) {
            formattedBikes = [];
            response.forEach(function (currentScooter) {
                formattedBikes.push(["skip", "Washington DC", currentScooter.bike_id, "scooter", currentScooter.lat, currentScooter.lon]);
            });
            sql.remove.regularDelete('bike_locs', ['company'], ['skip'], function (rows) {
                sqlKeys = ['company', 'region', 'id', 'type', 'lat', 'lng'];
                sql.insert.addObjects('bike_locs', sqlKeys, formattedBikes, function (results) {
                    console.log("Updated Skip Scooters for Washington DC at " + new Date());
                }, function (error) {})
            }, function (error) {});
        }, function (error) {});
    }
}

function getScooters(url, successCB, failCB) {
    var options = {
        method: 'GET',
        url: url,
    };
    request(options, function (error, response, body) {
        if (error) {
            failCB(error);
        } else {
            successCB(JSON.parse(body).bikes);
        }
    });
}