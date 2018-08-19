require('module-alias/register');
const fs = require('fs');
var limebike = require('@limebike');
var sql = require('@sql');
const constants = require('@config');
const gbfs = require('@gbfs');
const gbfsAnalyze = require('@gbfs-analyze');
const fileConversion = require('@file-conversion');

function updateLime() {
    constants.limebike.regions.forEach(function (currentCity) {
        limebike.getBikes(currentCity, function (response) {
            formattedBikes = [];
            response.forEach(function (currentBike) {
                newBike = {};
                newBike['company'] = "limebike";
                newBike['region'] = currentCity;
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
            sql.remove.regularDelete('bike_locs', ['company', 'region'], ['limebike', currentCity], function (rows) {
                sql.insert.addObjects('bike_locs', formattedBikes, function (results) {
                    console.log("Updated LimeBikes for " + currentCity + " at " + new Date());
                }, function (error) {})
            }, function (error) {});
        }, function (error) {});
    });
}

function updateGBFS() {
    gbfs.feed.systems.forEach(function (system) {
        gbfsAnalyze.getBikes(system, function (bikes) {
            console.log("URL: " + system.company + "\t\t SUCCESS!");
            // fs.writeFile("exports/export-" + system.company + ".json", JSON.stringify(bikes), function (err) {
            //     if (err) {
            //         console.log("ERROR SAVING FILE: " + err);
            //     }
            // });
        }, function (error) {
            console.log("URL: " + system.name + "\t\t ERROR : " + error);
        });
    });
}

// fileConversion.exportCSV();
// setInterval(updateLime, 10 * 1000);
updateGBFS();