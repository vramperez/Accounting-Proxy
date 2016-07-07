var async = require('async'),
    cbHandler = require('./orion_context_broker/cbHandler'),
    config = require('./config'),
    crypto = require('crypto'),
    db = require(config.database.type),
    logger = require('winston'),
    notifier = require('./notifier'),
    url = require('url'),
    validation = require('./validation');

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
                res.status(401).json({error: 'Access restricted to administrators of the service only'});

            } else{
                //Save the token to notify the WStore
                if (apiKey) {

                    db.addToken(apiKey, function (err) {
                        if (err) {
                            logger.error(err);
                        }
                        res.status(200).send();
                    });
                } else {
                    res.status(200).send();
                }
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
    var body = req.body;

    validation.validate('newBuy', body, function (err) { // Check if the json is correct
        if (err) {
            res.status(422).json({error: 'Invalid json: ' + err});
        } else {

            var apiKey = generateApiKey(body.productId, body.orderId, body.customer);

            db.newBuy({
                apiKey: apiKey,
                publicPath: url.parse(body.productSpecification.url).path,
                orderId: body.orderId,
                productId: body.productId,
                customer: body.customer,
                unit: body.productSpecification.unit,
                recordType: body.productSpecification.recordType
            }, function (err) {
                if (err) {
                    res.status(500).send();
                } else {
                    res.status(201).json({'API-KEY': apiKey});
                }
            });
        }
    });
};

/**
 * Cancel all the Context Broker subscriptions associated with the API key.
 *
 * @param  {string}    apiKey    API key.
 */
var cancelSubscriptions = function (apiKey, callback) {
    db.getCBSubscriptions(apiKey, function (err, subscriptions) {
        if (err) {
            return callback(err);
        } else {

            async.eachSeries(subscriptions, function (subscription, taskCallback) {

                db.getCBSubscription(subscription.subscriptionId, function (err, subsInfo) {
                    if (err) {
                        return callback(err);
                    } else {
                        cbHandler.cancelSubscription(subsInfo, callback);
                    }
                })
            }, callback);
        }
    });
};

/**
 * Notify the accounting information to the usage management API and delete the buy and all the
 *  accounting information associated.
 *
 * @param      {Object}  req     Incoming request.
 * @param      {Object}  res     Outgoing response.
 */
exports.deleteBuy = function (req, res) {
    var body = req.body;

    validation.validate('deleteBuy', body, function (err) {
        if (err) {
            res.status(422).json({error: 'Invalid json: ' + err});
        } else {

            var apiKey = generateApiKey(body.productId, body.orderId, body.customer);

            async.series([
                function (callback) {
                    if (config.resources.contextBroker) {
                        cancelSubscriptions(apiKey, callback);
                    } else {
                        callback();
                    }
                },
                function (callback) {
                    notifier.notifyUsage(apiKey, callback);
                },
                function (callback) {
                    db.deleteBuy(apiKey, callback);
                },
            ], function (err) {
                if (err) {
                    logger.error(err);
                    res.status(500).send();
                } else {
                    res.status(204).send();
                }
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
var generateApiKey = function (productId, orderId, customer) {
    var sha1 = crypto.createHash('sha1');

    sha1.update(productId + orderId + customer);
    return sha1.digest('hex');
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