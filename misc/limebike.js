var constants = require('@config');
var request = require('request');

module.exports = {
    getBikes: function (currentRegion, successCB, failCB) {
        var options = {
            method: 'GET',
            url: constants.limebike.url,
            qs: {
                region: currentRegion
            },
            headers: {
                authorization: constants.limebike.token_prefix + ' ' + constants.limebike.token
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                failCB(error);
            } else {
                successCB(JSON.parse(body).data);
            }
        });
    }
}