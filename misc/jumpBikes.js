var constants = require('@config');
var request = require('request');
var sql = require('@sql');

module.exports = {
    update: function () {
        getBikes(constants.jump_bikes.url, function (response) {
            formattedBikes = [];
            response.forEach(function (currentBike) {
                formattedBikes.push(["jump", "Washington DC", currentBike.bike_id, currentBike.name, "hybrid_bike", currentBike.lat, currentBike.lon]);
            });
            sql.remove.regularDelete('bike_locs', ['company', 'type'], ['jump', 'hybrid_bike'], function (rows) {
                sqlKeys = ['company', 'region', 'id', 'num', 'type', 'lat', 'lng'];
                sql.insert.addObjects('bike_locs', sqlKeys, formattedBikes, function (results) {
                    console.log("Updated Jump Bikes for Washington DC at " + new Date());
                }, function (error) {})
            }, function (error) {});
        }, function (error) {});
    }
}

function getBikes(url, successCB, failCB) {
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
            successCB(JSON.parse(body).data.bikes);
        }
    });
}