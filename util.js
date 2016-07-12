var async = require('async'),
    config = require('./config');

var pathRegExp = /^\/([\w#!:.?+=&%@!\-\/])/;
var invalidPathError = 'Invalid path format.';
var admin_paths = config.api.administration_paths;

exports.administrationPath = function (path, callback) {
    var is_admin_path = false;

    async.forEachOf(admin_paths, function(admin_path, key, taskCallback) {
        if (path === admin_path  && ! is_admin_path) {
            is_admin_path = true;
        }
        taskCallback();
    }, function() {
        return callback(is_admin_path);
    });
};

/**
 * Middleware that reads the data stream and stores in the body property of the request.
 *
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 */
exports.getBody = function (req, res, next) {
    req.body = '';

    req.on('data', function (chunk) {
        req.body += chunk;
    });

    req.on('end', function () {
        next();
    });
};

/**
 * Middleware that verifies the client certificate.
 *
 * @param      {Object}    req     Incoming request.
 * @param      {Object}    res     Outgoing response.
 */
exports.validateCert = function (req, res, next) {
    if (config.api.verifyCert && !req.client.authorized) {
        res.status(401).json({error: 'Unauthorized: Client certificate required ' + req.client.authorizationError});
    } else {
        next();
    }
};

exports.pathRegExp = pathRegExp;
exports.invalidPathError = invalidPathError;