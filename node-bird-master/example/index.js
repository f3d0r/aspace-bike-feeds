var Bird = require('..')
const bird = new Bird();
var cloudscraper = require('cloudscraper');
var readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function init(email) {
    try {
        var options = {
            method: 'POST',
            url: 'https://api.birdapp.com/user/login',
            headers: {
                'content-type': 'application/json',
                'app-version': '3.0.5',
                'device-id': '1',
                platform: 'ios'
            },
            body: {
                email: email
            },
            json: true
        };

        cloudscraper.request(options, function (err, response, body) {
            if (err) {
                console.log(JSON.stringify(err));
            } else {
                response = JSON.stringify(response) + "";
                var begString = "\"id\":\"";
                var endString = "\",\"expires_at\"";
                var id = response.substring(response.indexOf(begString) + begString.length, response.indexOf(endString));
                if (id.indexOf("statusCode") == -1) {
                    console.log(id);
                    rl.question('Please enter the verifyCode: ', (verifyCode) => {
                        rl.close();
                        bird.verifyEmail(verifyCode)
                            .then(function (response) {
                                console.log(response);
                                var reqs = [];
                                for (var index = 1; index <= 1; index++) {
                                    reqs.push(bird.getScootersNearby(45.512794, -122.679565, 5000));
                                }
                                Promise.all(reqs)
                                    .then(function (responses) {
                                        var index = 0
                                        responses.forEach(function (response) {
                                            console.log(response.length + "\t" + index++);
                                        });
                                    })
                                    .catch(function (error) {
                                        throw error;
                                    });
                            }).catch(function (error) {
                                throw error;
                            });
                    });
                } else {
                    throw Error("Unable to login!");
                }
            }
        });
    } catch (err) {
        console.log("ERROR: ");
        console.log(err)
    }
}


rl.question('Please enter your email: ', (email) => {
    init(email);
});
