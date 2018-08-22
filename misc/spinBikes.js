var constants = require('@config');
var request = require('request');
var sql = require('@sql');

module.exports = {
    update: function () {
        getScooters(constants.skip_scooters.url, function (response) {
            formattedBikes = [];
            response.forEach(function (currentBike) {
                formattedBikes.push(["spin", "Washington DC", currentBike.bike_id, "bike", currentBike.lat, currentBike.lon]);
            });
            sql.remove.regularDelete('bike_locs', ['company'], ['spin'], function (rows) {
                sqlKeys = ['company', 'region', 'id', 'type', 'lat', 'lng'];
                sql.insert.addObjects('bike_locs', sqlKeys, formattedBikes, function (results) {
                    console.log("Updated Spin Bikes for Washington DC at " + new Date());
                }, function (error) {})
            }, function (error) {});
        }, function (error) {});
    }
}

function getScooters(url, successCB, failCB) {
    var options = {
        method: 'GET',
        headers: {
            'user-agent': 'insomnia/6.0.2'
        },
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