//GLOBAL IMPORTS
require('module-alias/register');
require('sqreen');

//PACKAGE IMPORTS
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
var rootPath = require('app-root-path');

//EXPRESS SETUP
var app = express();
app.use(bodyParser.urlencoded({
    extended: false
}));

//CONSTANTS
const port = 3005;
const baseURL = 'https://web-production.lime.bike/api/rider/'
const phoneNumber = 'twilio_origin_phone_number'

//LIME VARS
var jar = request.jar();
var currToken = undefined;
var latLngs = undefined;

//LOGGING SETUP
var logger = Logger.setupDefaultLogger(process.env.LOG_DNA_API_KEY, {
    hostname: os.hostname(),
    ip: ip.address(),
    app: process.env.APP_NAME,
    env: process.env.ENV_NAME,
    index_meta: true,
    tags: process.env.APP_NAME + ',' + process.env.ENV_NAME + ',' + os.hostname()
});
console.log = function (d) {
    process.stdout.write(d + '\n');
    logger.log(d);
}
logger.write = function (d) {
    console.log(d)
}

//MAIN SCRIPT
fs.readFile(path.join(rootPath.path, 'fullLatLngs.txt'), 'utf-8', function (err, data) {
    latLngs = data.split("\n");
    latLngs = latLngs.map(val => [val.substring(0, val.indexOf(',')), val.substring(val.indexOf(',') + 1, val.length)]);
    startVerify();
});

function startVerify() {
    request(baseURL + 'v1/login?phone=' + phoneNumber, function (error, response, body) {
        console.log('body:', body); // Print the HTML for the Google homepage.
    });
}

app.post('/received_text', function (req, res) {
    var response = req.body.Body;
    var code = response.substring(0, response.indexOf(' '));
    console.log("CODE: \'" + code + '\'');
    confirmPhone(code);
    res.send("OK");
});

app.get('/', function (req, res) {
    res.send("OK!");
});

app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});

function confirmPhone(code) {
    var options = {
        method: 'POST',
        url: baseURL + 'v1/login',
        qs: {
            phone: phoneNumber,
            login_code: code
        },
        headers: {
            'content-type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        body = JSON.parse(body);
        console.log(body);
        var cookies = response.headers['set-cookie'];
        setCookie(cookies[0].key, cookies[0].value)

        currToken = body.token;

        var reqs = [];
        latLngs.forEach(function (currentLatLng) {
            reqs.push(getBikes(currentLatLng[1], currentLatLng[0]));
        });
        Promise.all(reqs)
            .then(function (responses) {
                console.log(responses.length);
            })
            .catch(function (error) {
                console.log("ERROR: " + error);
            });
    });
}

function setCookie(cookieKey, cookieValue) {
    console.log("NEW COOKIE:");
    console.log(cookieKey + "=" + cookieValue);
    jar.setCookie(request.cookie(cookieKey + "=" + cookieValue), "https://web-production.lime.bike/api/rider/v1/views/main");
}

function getBikes(lat, lng) {
    var options = {
        method: 'GET',
        url: baseURL + 'v1/views/main',
        qs: {
            map_center_latitude: lat,
            map_center_longitude: lng,
            user_latitude: lat,
            user_longitude: lng
        },
        headers: {
            authorization: 'Bearer ' + currToken
        },
        jar: 'JAR'
    };

    return new Promise(function (resolve, reject) {
        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(JSON.parse(body).data);
            }
        });
    });
}