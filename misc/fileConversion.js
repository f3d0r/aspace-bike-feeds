const csvFilePath = 'config/systems.csv'
const csv = require('csvtojson')
const fs = require('fs');

module.exports = {
    exportCSV: function () {
        csv()
            .fromFile(csvFilePath)
            .then((jsonObj) => {
                parsedOutput = "module.exports = { feed: { systems:"
                parsedSystems = [];
                jsonObj.forEach(function (currentSystem) {
                    resObject = {};
                    resObject['url'] = currentSystem.gbfs_url;
                    resObject['company'] = currentSystem.system_id;
                    resObject['region'] = currentSystem.location;
                    resObject['type'] = "station_bike";
                    if (currentSystem.country_code == "US") {
                        parsedSystems.push(resObject);
                    }
                });
                parsedOutput += (JSON.stringify(parsedSystems) + "} }");
                fs.writeFile("config/gbfs.js", parsedOutput, function (err) {
                    if (err) {
                        console.log("ERROR SAVING FILE: " + err);
                    }
                });
            });
    }
}