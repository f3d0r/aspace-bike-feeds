var request = require('request');

const express = require('express')
const app = express()
const port = 3000

const baseURL = 'https://web-production.lime.bike/api/rider/'
const phoneNumber = 'twilio_origin_phone_number'


startVerify();

function startVerify() {
    request(baseURL + 'v1/login?phone=' + phoneNumber, function (error, response, body) {
        console.log('body:', body); // Print the HTML for the Google homepage.
    });
}

app.get('/received_text', function(req, res) {

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));