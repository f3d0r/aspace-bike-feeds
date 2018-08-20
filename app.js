require('module-alias/register');
const constants = require('@config');
var lime = require('@limebike');
const gbfs = require('@gbfs-analyze');

setInterval(lime.updateLime, constants.general.update_interval);
setInterval(gbfs.updateGBFS, constants.general.update_interval);