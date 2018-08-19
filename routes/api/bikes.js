var router = require('express').Router();
var multer = require('multer');
var sharp = require('sharp');
var fs = require('fs');
var uniqueString = require('unique-string');
var errors = require('@errors');
const constants = require('@config');
var sql = require('@sql');
var userAuth = require('@auth-user');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profile_pic_temp');
    },
    filename: function (req, file, cb) {
        cb(null, 'profile-pic-' + uniqueString());
    }
})

var upload = multer({
    storage: storage
});

router.get('/', function (req, res, next) {
    next(errors.getResponseJSON('USER_ENDPOINT_FUNCTION_SUCCESS', "This is the user info sub-API for aspace! :)"));
});

router.get('/ping', function (req, res, next) {
    next(errors.getResponseJSON('USER_ENDPOINT_FUNCTION_SUCCESS', "pong"));
});

module.exports = router;