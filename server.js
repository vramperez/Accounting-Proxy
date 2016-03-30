var express = require('express'),
    config = require('./config'),
    api = require('./APIServer'),
    bodyParser = require('body-parser'),
    async = require('async'),
    url = require('url'),
    request = require('request'),
    contextBroker = require('./orion_context_broker/cb_handler'),
    logger = require('winston'),
    notifier = require('./notifier'),
    cron = require('node-schedule'),
    oauth2 = require('./OAuth2_authentication');

"use strict";

var db = require(config.database.type);
var app = express();
var acc_modules = {};
var admin_paths = config.api.administration_paths;

/**
 * Start and configure the server.
 */
exports.init = function (callback) {
    async.series([
        function (callback) {
            db.init(callback);
        },
        function (callback) {
            notifier.notifyUsageSpecification(callback);
        },
        function (callback) {
            notifier.notifyUsage(callback);
        }
    ], function (err) {
        if (err) {
            return callback('Error starting the accounting-proxy. Error: ' + err);
        } else {
            if (config.resources.contextBroker) { //Start ContextBroker Server for subscription notifications.
                logger.info('Loading module for Orion Context Broker...');
                contextBroker.run();
            }

            // Create daemon to update WStore every day. Cron format:
            // [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
            cron.scheduleJob('00 00 * * *', function () {
                logger.info('Sending accounting information...');
                notifier.notifyUsage(function (err) {
                    if (err) {
                        logger.error('Error while notifying the WStore: ' + err);
                    }
                });
            });
            app.listen(app.get('port'));
            return callback(null);
        }
    });
};

/**
 * Auxiliar function for making the accounting.
 *
 * @param  {string}   apiKey   Purchase identifier.
 * @param  {string}   unit     Unit for make the accounting.
 * @param  {Object}   body     Endpoint response body.
 */
exports.count = function (apiKey, unit, body, callback) {
    if (acc_modules[unit] === undefined) {
        try {
            acc_modules[unit] = require('./acc_modules/' + unit).count;
        } catch (e) {
            return callback('No accounting module for unit "%s": missing file acc_modules\/%s.js' + unit, unit);
        }
    }
    acc_modules[unit](body, function (err, amount) {
        if (err) {
            return callback(err);
        } else {
            db.makeAccounting(apiKey, amount, function (err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        }
    });
};

/**
 * Auxiliar functon that handles ContextBroker request.
 *
 * @param {Object} req      Incoming request.
 * @param {Object} res      Outgoing response.
 * @param {Object} options  Options for make the request to the endpoint.
 * @param {[type]} unit     Unit for the accounting.
 */
var CBrequestHandler = function(req, res, options, unit) {
    var apiKey = req.get('X-API-KEY');

    contextBroker.getOperation(url.parse(options.url).pathname, req, function (operation) {
        if (operation === 'subscribe' || operation === 'unsubscribe') { // (un)subscription request
            contextBroker.subscriptionHandler(req, res, options.url, operation, function (err) {
                if (err) {
                    logger.error(err);
                }
            });
        } else {
            requestHandler(options, res, apiKey, unit);
        }
    });
};

/**
 * Send the request to the endpoint, make the accounting and send the response to the user.
 *
 * @param  {Object} options Request options.
 * @param  {Object} res     Outgoing response to the user.
 * @param  {string} apiKey  Purchase identifier.
 * @param  {string} unit    Accounting unit.
 */
var requestHandler = function (options, res, apiKey, unit) {
    request(options, function (error, resp, body) {
        if (error) {
            res.status(504).send();
            logger.warn('An error ocurred requesting the endpoint: ' + options.url);
        } else {
            for (var header in resp.headers) {
                res.setHeader(header, resp.headers[header]);
            }
            if (apiKey === null && unit === null) { // No accounting (admin user)
                res.send(body);
            } else {
                exports.count(apiKey, unit, body, function (err) {
                    if(err) {
                        logger.warn('[%s] Error making the accounting: ' + err, apiKey);
                        res.status(500).send();
                    } else {
                        res.send(body);
                    }
                });
            }
        }
    });
};

/**
 * Read the data stream and store in the body property of the request.
 *
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 */
var getBody = function (req, res, next) {
    req.body = '';

    req.on('data', function (chunk) {
        req.body += chunk;
    });

    req.on('end', function () {
        next();
    });
};

/**
 * Prepare the options for the request.
 *
 * @param  {Object} req    Incoming request.
 * @param  {Object} res    Outgoing response.
 * @param  {string} apiKey Purchase identifier.
 * @param  {string} unit   Accounting unit.
 */
var prepareRequest = function (req, res, endpointUrl, apiKey, unit) {
    var isJSON = req.is('application/json');
    var createMehtods = ['PATCH', 'POST', 'PUT'];

    var options = {
        url: endpointUrl,
        method: req.method,
        headers: req.headers
    };

    if (createMehtods.indexOf(req.method) > -1 && isJSON) {
        options.headers['content-length'] = undefined; // Request module will set it.
        options.json = true;
        options.body = JSON.parse(req.body);
        req.body = JSON.parse(req.body);
    } else if (createMehtods.indexOf(req.method) > -1) {
        options.body = req.body;
    }

    if (apiKey === null && unit === null) { // redirect (admin user)
        requestHandler(options, res, apiKey, unit);
    } else {
        // Orion ContextBroker request
        if (config.resources.contextBroker &&
            (/\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/).test(url.parse(options.url).pathname)) {

                if (createMehtods.indexOf(req.method) > -1 && !isJSON) {
                    res.status(415).json({error: 'Content-Type must be "application/json"'});
                } else {
                    CBrequestHandler(req, res, options, unit);
                }

        } else {
            requestHandler(options, res, apiKey, unit);
        }
    }
}

/**
 * Request handler.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var handler = function (req, res) {
    var apiKey = req.get('X-API-KEY');
    var contentType = req.is('application/json');

    db.getAdminUrl(req.user.id, req.publicPath, function (err, endpointUrl) {
        if (err) {
            res.status(500).send();
        } else if (endpointUrl !== null) { // User is an admin

            prepareRequest(req, res, endpointUrl + req.restPath, null, null);

        } else { // User is not an admin

            if (apiKey === undefined) {
                logger.log('debug', 'Undefined API_KEY');
                res.status(401).json({ error: 'Undefined "X-API-KEY" header'});
            } else {
                db.checkRequest(req.user.id, apiKey, function (err, correct) {
                    if (err) {
                        res.status(500).send();
                    } else if (! correct) { // Invalid apiKey or user
                        res.status(401).json({ error: 'Invalid API_KEY or user'});
                    } else {
                        db.getAccountingInfo(apiKey, function(err, accountingInfo) {
                            if (err) {
                                res.status(500).send();
                            } else if (accountingInfo === null) {
                                res.status(500).send();
                            } else {

                                prepareRequest(req, res, accountingInfo.url + req.restPath, apiKey, accountingInfo.unit);

                            }
                        });
                    }
                });
            }
        }
    });
};

app.set('port', config.accounting_proxy.port);

app.post(admin_paths.checkUrl, api.checkIsJSON, bodyParser.json(), api.checkUrl);
app.post(admin_paths.newBuy, api.checkIsJSON, bodyParser.json(), api.newBuy);
app.get(admin_paths.keys, api.getApiKeys);
app.get(admin_paths.units, api.getUnits);

app.use('/', oauth2.headerAuthentication, getBody, handler);

module.exports.app = app;