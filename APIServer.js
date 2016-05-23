var crypto = require('crypto'),
    config = require('./config'),
    validation = require('./validation'),
    url = require('url'),
    db = require(config.database.type),
    logger = require('winston');

"use strict";

/**
 * Return true if the user is an administrator of the service identified by the path.
 *  Otherwise return false.
 *
 * @param  {string}   userId   User identifier.
 * @param  {string}   path     Public path of the service.
 */
var isAdmin = function (userId, path, callback) {
    db.getAdmins(path, function (err, admins) {
        if (err) {
            return callback(err, null);

        } else if (!admins){
            return callback(null, false);

        } else {
            var isAdmin = admins.indexOf(userId) > -1;
            return callback(null, isAdmin);
        }
    });
}

/**
 * Check if the url in the request body is a registered url (registered public path).
 *
 * @param  {Object} req     Incoming request.
 * @param  {Object} res     Outgoing response.
 */
exports.checkURL = function (req, res) {
    req.setEncoding('utf-8');

    var bodyUrl = req.body.url;
    var apiKey = req.get('X-API-KEY');

    if (!bodyUrl) {
        res.status(422).json({error: 'Missing URL'});

    } else {

        var path = url.parse(bodyUrl).path;

        isAdmin(req.user.id, path, function (err, isAdmin) {

            if (err) {
                res.status(500).json({error: err});

            } else if (!isAdmin) {
                res.status(401).json({error: 'Access restricted to administrators of the service only'})

            } else{
                //Save the token to notify the WStore
                if (apiKey) {

                    db.addToken(apiKey, function (err) {
                        if (err) {
                            logger.error(err);
                        }
                    });
                }

                // Only check the path because the host and port are the same used for make this request,
                // so they must be correct
                db.checkPath(path, function (err, correct) {
                    if (err) {
                        res.status(500).send();
                    } else if (correct) {
                        res.status(200).send();
                    } else {
                        res.status(400).json({error: 'Incorrect url ' + bodyUrl});
                    }
                });
            }
        });
    }
};

/**
 * Add the new buy information to the database.
 *
 * @param  {Object} req     Incoming request.
 * @param  {Object} res     Outgoing request.
 */
exports.newBuy = function (req, res) {
    req.setEncoding('utf-8');
    var body = req.body;

    validation.validate('product', body, function (err) { // Check if the json is correct
        if (err) {
            res.status(400).json({error: 'Invalid json. ' + err}); // More specific error? (wich field is undefined)
        } else {
            generateApiKey(body.productId, body.orderId, body.customer, function (apiKey) {
                db.newBuy({
                    apiKey: apiKey,
                    publicPath: url.parse(body.productSpecification.url).pathname,
                    orderId: body.orderId,
                    productId: body.productId,
                    customer: body.customer,
                    unit: body.productSpecification.unit,
                    recordType: body.productSpecification.recordType
                }, function (err) {
                    if (err) {
                        res.status(400).send();
                    } else {
                        res.status(201).json({'API-KEY': apiKey});
                    }
                });
            });
        }
    });
};

/**
 * Return the apiKey, productId and orderId for each product bought by the user.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
exports.getApiKeys = function (req, res) {
    var user = req.user.id;

    db.getApiKeys(user, function (err, apiKeysInfo) {
        if (err) {
            res.status(500).send();
        } else if (!apiKeysInfo) {
            res.status(404).json({error: 'No api-keys available for the user ' + user});
        } else {
            res.status(200).json(apiKeysInfo);
        }
    });
};

/**
 * Return the accounting units soported.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
exports.getUnits = function (req, res) {
    res.status(200).json({units: config.modules.accounting});
};

/**
 * Generates an api-key based on the productId, orderId and customer passed as argument.
 *
 * @param  {string} productId   product identifier.
 * @param  {string} orderId     order identifier.
 * @param  {string} customer    user identifier.
 */
var generateApiKey = function (productId, orderId, customer, callback) {
    var sha1 = crypto.createHash('sha1');

    sha1.update(productId + orderId + customer);
    var apiKey = sha1.digest('hex');
    return callback(apiKey);
};

/**
 * Check if the content-type of the request is "application/json".
 *
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 * @param  {Function} next Next function to call.
 */
exports.checkIsJSON = function (req, res, next) {
    if (!req.is('application/json')) {
        res.status(415).json({error: 'Content-Type must be "application/json"'});
    } else {
        next();
    }
};