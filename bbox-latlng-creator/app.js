var turf = require('@turf/turf');
var fs = require('fs');
var path = require('path');
var request = require('request');
var csv = require('csvtojson');
var rootPath = require('app-root-path');

const feetSpace = 1500;

const milesChunk = feetSpace / 5280;
const locationsCSVLoc = "locations.csv";

csv()
    .fromFile(locationsCSVLoc)
    .then((jsonOut) => {
        var geojsonReqs = getGeojsonReqs(jsonOut);
        resolvePromises(geojsonReqs, function (resolvedGeojson) {
            var combinedGeoJson = turf.featureCollection(
                resolvedGeojson.map(val => turf.bboxPolygon(turf.bbox(val.reqResult)))
            );
            latLngs = getSpacedLatLngs(combinedGeoJson);
            output = "";
            latLngs.forEach(function(currentLatLng) {
                output += currentLatLng + "\n";
            })
            fs.writeFile(path.join(rootPath.path, 'fullLatLngs.txt'), output, function(err) {
                if (err) {
                    throw err;
                } else {
                    console.log("FILE WRITTEN! TOTAL LENGTH: " + latLngs.length);
                }
            });
            console.log(rootPath.path);
        });
    });


function getGeojsonReqs(cityGeoJSON) {
    for (var index = 0; index < cityGeoJSON.length; index++) {
        cityGeoJSON[index].reqProm = new Promise(function (resolve, reject) {
            const currURL = 'http://polygons.openstreetmap.fr/get_geojson.py?id=' + cityGeoJSON[index].id + '&params=0';
            request(currURL, function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(JSON.parse(body));
                }
            });
        });
    }
    return cityGeoJSON;
}

function resolvePromises(cityGeoJSON, cb) {
    Promise.all(cityGeoJSON.map(val => val.reqProm))
        .then(function (responses) {
            for (var index = 0; index < cityGeoJSON.length; index++) {
                cityGeoJSON[index].reqResult = responses[index];
            }
            cb(cityGeoJSON);
        })
        .catch(function (error) {
            throw error;
        });
}

function getSpacedLatLngs(geojson) {
    var latLngs = []
    geojson.features.forEach(function (currentFeature) {
        allCoordinates = currentFeature.geometry.coordinates[0];
        coordinates = [
            [allCoordinates[0], allCoordinates[1]],
            [allCoordinates[0], allCoordinates[3]]
        ];
        var lines = coordinates.map(val => turf.lineString(val));
        var chunks = lines.map(val => turf.lineChunk(val, milesChunk, {
            units: 'miles'
        }));
        var lngs = chunks[0].features.map(val => val.geometry.coordinates[0][0]);
        var lats = chunks[1].features.map(val => val.geometry.coordinates[0][1]);
        for (var i = 0; i < lngs.length; i++) {
            for (var j = 0; j < lats.length; j++) {
                latLngs.push([lngs[i], lats[j]]);
            }
        }
    });
    return latLngs;
}