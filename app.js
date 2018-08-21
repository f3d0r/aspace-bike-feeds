require('module-alias/register');
const constants = require('@config');
const lime = require('@limebike');
const gbfs = require('@gbfs');
const skip = require('@skip');
const spin = require('@spin');
const jump = require('@jump');

setTimeout(function () {
    setInterval(lime.update, constants.general.update_interval);
}, 0);

setTimeout(function () {
    setInterval(skip.update, constants.general.update_interval);
}, 2500);

setTimeout(function () {
    setInterval(spin.update, constants.general.update_interval);
}, 5000);

setTimeout(function () {
    setInterval(jump.update, constants.general.update_interval);
}, 7500);

setTimeout(function () {
    setInterval(gbfs.update, constants.general.update_interval);
}, 10000);