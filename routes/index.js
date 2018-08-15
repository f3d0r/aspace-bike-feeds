var router = require('express').Router();

router.use('/bike_data', require('./api/bikes'));

module.exports = router;