var request = require('request');
var HttpsProxyAgent = require('https-proxy-agent');
var sql = require('@sql');
const constants = require('@config');

var nextProxy = 0;
module.exports = {
    sleep: function (ms) {
        if (ms > 0) {
            return new Promise(resolve => setTimeout(resolve, ms));
        } else {
            return Promise.resolve();
        }
    },
    performRequest: function (requestOptions, useProxy = false, proxyIndex = undefined) {
        return new Promise(function (resolve, reject) {
            requestOptions.headers['User-Agent'] = "insomnia/6.0.2";
            var proxy = getProxy(5);
            var agent = new HttpsProxyAgent(proxy);
            // if (useProxy) {
                // console.log("HERE PROXY!");
                requestOptions.agent = agent;
            // }
            request(requestOptions, function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });
    }
};

function getProxy(proxyIndex) {
    if (typeof proxyIndex == 'undefined') {
        if (nextProxy == constants.PROXIES.length)
            nextProxy = 0;
        return "http://" + constants.PROXIES[nextProxy++] + ":8889";
    } else {
        return "http://" + constants.PROXIES[proxyIndex] + ":8889";
    }

}