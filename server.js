var express = require('express'),
    config = require('./config'),
    api = require('./APIServer'),
    bodyParser = require('body-parser'),
    async = require('async'),
    url = require('url'),
    request = require('request'),
    contextBroker = require('./orion_context_broker/cb_handler'),
    logger = require('winston'),
    accounter = require('./accounter'),
    cron = require('node-schedule'),
    oauth2 = require('./OAuth2_authentication'),
    notifier = require('./notifier'),
    expressWinston = require('express-winston');

"use strict";

var db = require(config.database.type);
var app = express();
var admin_paths = config.api.administration_paths;
var accountingModules = {};
var server;

/**
 * Load all the accounting modules for the supported accounting units.
 */
var loadAccountingModules = function (callback) {
    var units = config.modules.accounting;

    async.each(units, function (unit, taskCallback) { 
        try {
            accountingModules[unit] = require('./acc_modules/' + unit);
            taskCallback();
        } catch (e) {
            taskCallback('No accounting module for unit "' + unit + '" : missing file acc_modules/' + unit + '.js');
        }
    }, callback);
};

/**
 * Start and configure the server.
 */
exports.init = function (callback) {
    async.series([
        function (callback) {
            db.init(callback);
        },
        function (callback) {
            loadAccountingModules(callback)
        },
        function (callback) {
            notifier.notifyUsage(callback);
        }
    ], function (err) {
        if (err) {
            return callback('Error starting the accounting-proxy. ' + err);
        } else {
            if (config.resources.contextBroker) { //Start ContextBroker Server for subscription notifications.
                logger.info('Loading module for Orion Context Broker...');
                contextBroker.run();
            }

            cron.scheduleJob(config.usageAPI.schedule, function () {
                notifier.notifyUsage(function (err) {
                    if (err) {
                        logger.error('Error while notifying the accounting: ' + err);
                    }
                });
            });

            server = app.listen(app.get('port'));

            return callback(null);
        }
    });
};

/**
 * Stop the server
 */
exports.stop = function (callback) {
    server.close(callback);
};

exports.getAccountingModules = function() {
    return accountingModules;
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
        if (operation === 'subscribe' || operation === 'unsubscribe' || operation === 'updateSubscription') {
            contextBroker.subscriptionHandler(req, res, options.url, operation, unit, function (err) {
                if (err) {
                    logger.warn('[%s] ' + err, apiKey);
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
    var requestInfo = {};

    // Save request Info
    requestInfo.request = JSON.parse(JSON.stringify(options));
    requestInfo.request.time = new Date().getTime();

    request(options, function (error, resp, body) {

        if (error) {
            res.status(504).send();
            logger.warn('[%s] An error ocurred requesting the endpoint: ' + options.url, apiKey);

        } else {
            requestInfo.response = resp; // Save response info
            requestInfo.response.time = new Date().getTime();

            for (var header in resp.headers) {
                res.setHeader(header, resp.headers[header]);
            }
            if (apiKey === null && unit === null) { // No accounting (admin user)
                res.status(resp.statusCode).send(body);
            } else {

                accounter.count(apiKey, unit, requestInfo, 'count', function (err) {

                    if(err) {
                        logger.warn('[%s] Error making the accounting: ' + err, apiKey);
                        res.status(500).send();
                    } else {
                        res.status(resp.statusCode).send(body);
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

    db.getAdminURL(req.user.id, req.publicPath, function (err, endpointURL) {

        if (err) {
            res.status(500).json({error: err});

        } else if (endpointURL) { // Admin
            prepareRequest(req, res, endpointURL + req.restURL, null, null);

        } else{ // Not admin user

            if (!apiKey) {
                logger.log('debug', 'Undefined API_KEY');
                res.status(401).json({ error: 'Undefined "X-API-KEY" header'});

            } else {

                db.checkRequest(req.user.id, apiKey, req.publicPath, function (err, correct) {

                    if (err) {
                        res.status(500).send();
                    } else if (! correct) { // Invalid apiKey or user for the requested service
                        res.status(401).json({ error: 'Invalid API_KEY or user'});
                    } else {

                        db.getAccountingInfo(apiKey, function(err, accountingInfo) {

                            if (err || !accountingInfo) {
                                res.status(500).send();
                            } else {
                                prepareRequest(req, res, accountingInfo.url + req.restURL, apiKey, accountingInfo.unit);
                            }
                        });
                    }
                });
            }
        }
    });
};

app.use(expressWinston.logger({
    transports: [
        new logger.transports.File({
            level: 'debug',
            filename: config.log.file,
            colorize: false
        })
    ]
}));

app.set('port', config.accounting_proxy.port);

app.post(admin_paths.checkURL, oauth2.headerAuthentication, api.checkIsJSON, bodyParser.json(), api.checkURL);
app.post(admin_paths.newBuy, api.checkIsJSON, bodyParser.json(), api.newBuy);
app.get(admin_paths.units, api.getUnits);
app.get(admin_paths.keys, oauth2.headerAuthentication, api.getApiKeys);

app.use('/', oauth2.headerAuthentication, getBody, handler);

module.exports.app = app;