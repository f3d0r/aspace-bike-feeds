require('module-alias/register');
const constants = require('@config');
const lime = require('@limebike');
const gbfs = require('@gbfs');
const skip = require('@skip');
const spin = require('@spin');
const jump = require('@jump');

setInterval(lime.update, constants.general.update_interval);

setInterval(skip.update, constants.general.update_interval);

setInterval(spin.update, constants.general.update_interval);

setInterval(jump.update, constants.general.update_interval);

setInterval(gbfs.update, constants.general.update_interval);