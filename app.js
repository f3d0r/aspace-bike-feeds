require('module-alias/register');
var lime = require('@limebike');
const gbfs = require('@gbfs-analyze');

setInterval(lime.updateLime, 20 * 1000);
setInterval(gbfs.updateGBFS, 20 * 1000);