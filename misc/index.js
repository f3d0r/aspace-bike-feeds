var request = require('request');

module.exports = {
    sleep: function (ms) {
        if (ms > 0) {
            return new Promise(resolve => setTimeout(resolve, ms));
        } else {
            return new Promise(resolve => setTimeout(resolve, 2000));
        }
    },
    performRequest: function (requestOptions) {
        return new Promise(function (resolve, reject) {
            request(requestOptions, function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });
    }
}