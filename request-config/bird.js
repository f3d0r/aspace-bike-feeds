module.exports = {
    loginOptions: function (email, deviceId) {
        return {
            method: 'POST',
            url: 'https://api.bird.co/user/login',
            headers: {
                'app-version': '3.0.5',
                'platform': 'ios',
                'device-id': deviceId,
                'content-type': 'application/json'
            },
            body: {
                email: email
            },
            timeout: 5000,
            json: true
        }
    },
    scooterOptions: function (lat, lng, radius, authToken, deviceId) {
        var location = {
            "latitude": lat,
            "longitude": lng,
            "altitude": 500,
            "accuracy": 100,
            "speed": -1,
            "heading": -1
        }
        return {
            method: 'GET',
            url: 'https://api.bird.co/bird/nearby',
            qs: {
                latitude: lat,
                longitude: lng,
                radius: radius
            },
            headers: {
                'location': JSON.stringify(location),
                'app-version': '3.0.5',
                'device-id': deviceId,
                'authorization': 'Bird ' + authToken
            },
            timeout: 30000,
            json: true
        };
    },
    verifyOptions: function (token, deviceId) {
        return {
            method: 'PUT',
            url: 'https://api.bird.co/request/accept',
            headers: {
                'app-version': '3.0.5',
                'platform': 'ios',
                'device-id': deviceId,
                'content-type': 'application/json'
            },
            body: {
                token: token
            },
            timeout: 5000,
            json: true
        };
    },
    userOptions: function (authToken, deviceId) {
        return {
            method: 'GET',
            url: 'https://api.bird.co/user',
            headers: {
                'location': '{"latitude":37.77249,"longitude":-122.40910,"altitude":500,"accuracy":100,"speed":-1,"heading":-1}',
                'app-version': '3.0.5',
                'device-id': deviceId,
                'authorization': 'Bird ' + authToken
            },
            timeout: 5000,
            json: true
        };
    }
}
