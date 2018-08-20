var constants = require('@config');
var request = require('request');
var sql = require('@sql');

module.exports = {
    update: function () {
        constants.limebike.regions.forEach(function (currentCity) {
            getBikes(currentCity, function (response) {
                formattedBikes = [];
                response.forEach(function (currentBike) {
                    formattedBikes.push(["limebike", currentCity, currentBike.id, currentBike.attributes.plate_number, currentBike.attributes.vehicle_type, currentBike.attributes.latitude, currentBike.attributes.longitude]);
                });
                sql.remove.regularDelete('bike_locs', ['company', 'region'], ['limebike', currentCity], function (rows) {
                    sqlKeys = ['company', 'region', 'id', 'num', 'type', 'lat', 'lng'];
                    sql.insert.addObjects('bike_locs', sqlKeys, formattedBikes, function (results) {
                        console.log("Updated LimeBikes for " + currentCity + " at " + new Date());
                    }, function (error) {})
                }, function (error) {});
            }, function (error) {});
        });
    }
}

function getBikes(currentRegion, successCB, failCB) {
    var options = {
        method: 'GET',
        url: constants.limebike.url,
        qs: {
            region: currentRegion
        },
        headers: {
            authorization: constants.limebike.token_prefix + ' ' + constants.limebike.token
        }
    };
    request(options, function (error, response, body) {
        if (error) {
            failCB(error);
        } else {
            successCB(JSON.parse(body).data);
        }
    });
}