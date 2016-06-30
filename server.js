var express = require('express'),
    config = require('./config'),
    api = require('./APIServer'),
    bodyParser = require('body-parser'),
    async = require('async'),
    url = require('url'),
    request = require('request'),
    logger = require('winston'),
    accounter = require('./accounter'),
    cbHandler = require('./orion_context_broker/cbHandler'),
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
            if (config.resources.contextBroker) { //Start ContextBroker Server for subscription notifications
                logger.info('Loading modules for Orion Context Broker...');

                cbHandler.run();
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
 * @param {string} unit     Unit for the accounting.
 */
var cbRequestHandler = function(req, res, options, unit, version) {
    var apiKey = req.get('X-API-KEY');

    cbHandler.getOperation(url.parse(options.url).pathname, req, function (operation) {

        if (operation === 'create' || operation === 'delete' || operation === 'update') {

            cbHandler.subscriptionHandler(req, res, options, operation, unit, version, function (err, response) {

                if (err) {
                    logger.warn('[%s] ' + err, apiKey);
                }
                res.status(response.status).send(response.body);
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
                        logger.warn('[%s] Error making the accounting: ' + err.msg, apiKey);
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
 * Return the Context Broker API version of the URL passed as argument. If the context broker
 *  configuration option is false or the request is not a context broker request, it return null.
 *
 * @param  {String} reqUrl Request URL
 */
var getCBVersion = function (publicPath, reqUrl, callback) {

    if (!config.resources.contextBroker) {
        return callback(null, null);
    } else {

        db.isCBService(publicPath, function (err, isCBService) {
            if (err) {
                return callback(err, null);
            } else if (!isCBService) {
                return callback(null, null);
            } else {

                var v1RegEx = /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/;
                var v2RegEx = /\/(v2)\/((\w+)\/?)*$/;
                var version = null;

                var path = url.parse(reqUrl).pathname;

                version = v1RegEx.test(path) ? 'v1' : v2RegEx.test(path) ? 'v2' : null;

                return callback(null, version);
            }
        });
    }
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

        try {
            req.body = JSON.parse(req.body);
            options.body = req.body;
        } catch (e) {
            return res.status(400).json({error: 'Invalid JSON'});
        }
    } else if (createMehtods.indexOf(req.method) > -1) {
        options.body = req.body;
    }

    if (apiKey === null && unit === null) { // redirect (admin user)
        requestHandler(options, res, apiKey, unit);
    } else {

        getCBVersion(req.publicPath, options.url, function (err, version) {
            if (err) {
                logger.warn('[%s] ' + err, apiKey);
                res.status(500).send();

            } else if (!version) { // No Context Broker request
                requestHandler(options, res, apiKey, unit);

            } else { // Context Broker request

                if (createMehtods.indexOf(req.method) > -1 && !isJSON) {
                    res.status(415).json({error: 'Content-Type must be "application/json"'});

                } else {
                    cbRequestHandler(req, res, options, unit, version);
                }
            }
        });
    }
};

/**
 * Request handler.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var handler = function (req, res) {
    var apiKey = req.get('X-API-KEY');

    db.getAdminURL(req.user.id, req.publicPath, req.method, function (err, adminRes) {

        if (err) {
            res.status(500).json({error: err});

        } else if (adminRes.isAdmin) { // Admin request

            if (adminRes.errorCode === 'method') {
                res.status(405).json({error: adminRes.errorMsg});
            } else {
                prepareRequest(req, res, adminRes.url + req.restURL, null, null);
            }

        } else { // Not admin request

            if (!apiKey) {
                logger.log('debug', 'Undefined API_KEY');
                res.status(401).json({ error: 'Undefined "X-API-KEY" header'});

            } else {

                db.checkRequest(req.user.id, apiKey, req.publicPath, req.method, function (err, result) {

                    if (err) {
                        res.status(500).send();
                    } else if (!result.isCorrect && result.errorCode === 'apiKey') {
                        res.status(401).json({ error: result.errorMsg});
                    } else if (!result.isCorrect && result.errorCode === 'method'){
                        res.status(405).json({ error: result.errorMsg});
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