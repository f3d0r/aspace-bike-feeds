var cloudscraper = require('cloudscraper');

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
        email: 'me@f3d0r.com'
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
        console.log(id);
    }
});