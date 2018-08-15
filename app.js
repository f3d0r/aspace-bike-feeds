require('module-alias/register');
var limebike = require('@limebike');
var sql = require('@sql')

function updateLime() {
    limebike.getBikes(function (response) {
        formattedBikes = [];
        response.forEach(function (currentBike) {
            newBike = {};
            newBike['company'] = "limebike";
            newBike['id'] = currentBike.id;
            newBike['num'] = currentBike.attributes.plate_number;
            if (newBike.num == "" || newBike.num == null) {
                newBike['num'] = "";
            }
            newBike['type'] = currentBike.attributes.vehicle_type;
            newBike['lat'] = currentBike.attributes.latitude;
            newBike['lng'] = currentBike.attributes.longitude;

            formattedBikes.push(newBike)
        });
        sql.remove.regularDelete('stationless_bikes', ['company'], ['limebike'], function (rows) {
            sql.insert.addObjects('stationless_bikes', formattedBikes, function (results) {
                console.log("Updated LimeBikes at " + new Date());
            }, function (error) {})
        }, function (error) {});
    }, function (error) {});
}

setInterval(updateLime, 10 * 1000);