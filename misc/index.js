var request = require('request');

module.exports = {
    sleep: function (ms) {
        if (ms > 0) {
            return new Promise(resolve => setTimeout(resolve, ms));
        } else {
            return Promise.resolve();
        }
    },
    performRequest: function (requestOptions) {
        return new Promise(function (resolve, reject) {
            requestOptions.headers['User-Agent'] = "insomnia/6.0.2";
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