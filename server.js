var express = require('express'),
    config = require('./config'),
    api = require('./APIServer'),
    notifier = require('./notifier'),
    cron = require('node-schedule'),
    bodyParser = require('body-parser'),
    async = require('async'),
    url = require('url'),
    request = require('request'),
    contextBroker = require('./orion_context_broker/cb_handler'),
    logger = require('winston');

"use strict";

var db = require(config.database.type); 
var app = express();
var acc_modules = {};

/**
 * Start and configure the server.
 */
exports.init = function(callback) {
    async.series([
        function(callback) {
            db.init(callback);
        },
        function(callback) {
            notify(callback);
        }
    ], function(err) {
        if (err) {
            return callback(err);
        } else {
            if (config.resources.contextBroker) { //Start ContextBroker Server for subscription notifications.
                logger.info('Loading module for Orion Context Broker...');
                contextBroker.run();
            }
            /* Create daemon to update WStore every day
             * Cron format:
             * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
             */
            cron.scheduleJob('00 00 * * *', function() {
                logger.info('Sending accounting information...');
                notify(function(err) {
                    if (err) {
                        logger.error('Error while notifying the WStore: ' + err);
                    }
                });
            });
            app.listen(app.get('port'));
            return callback(null);
        }
    });
}

/**
 * Call the notifier to send the accounting information to the WStore.
 */
var notify = function(callback) {
    db.getNotificationInfo(function(err, notificationInfo) {
        if (err) {
            return callback(err);
        } else if (notificationInfo === null) { // Not notify
            return callback(null);
        } else {
            logger.info('Notifying the WStore...');
            async.each(notificationInfo, function(info, task_callback) {
                notifier.notify(info, function(err) {
                    if (err) {
                        task_callback(err);
                    } else {
                        task_callback(null);
                    }
                })
            }, callback);
        }
    });
}

/**
 * Auxiliar function for making the accounting.
 * 
 * @param  {string}   apiKey   Product identifier.
 * @param  {string}   unit     Unit for make the accounting.
 * @param  {Object}   body     Endpoint response body.
 */
exports.count = function(apiKey, unit, body, callback) {
    if (acc_modules[unit] === undefined) {
        try {
            acc_modules[unit] = require('./acc_modules/' + unit).count;
        } catch (e) {
            return callback('No accounting module for unit "%s": missing file acc_modules\/%s.js' +  unit, unit);
        }
    }
    acc_modules[unit](body, function(err, amount) {
        if (err) {
            return callback(err);
        } else {
            db.makeAccounting(apiKey, amount, function(err) {
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
    var user = req.get('X-Actor-ID');
    var apiKey = req.get('X-API-KEY');
    
    contextBroker.getOperation(url.parse(options.url).pathname, req, function(operation) {
        if (operation === 'subscribe' || operation === 'unsubscribe') { // (un)subscription request
            contextBroker.subscriptionHandler(req, res, options.url, unit, operation, function(err) {
                if (err) {
                    logger.error(err);
                } 
            });
        } else {
            requestHandler(options, res, apiKey, unit);
        }
    });
}

/**
 * Send the request to the endpoint, make the accounting and send the response to the user.
 * 
 * @param  {Object} options Request options.
 * @param  {Object} res     Outgoing response to the user.
 * @param  {string} apiKey  Product identifier.
 * @param  {string} unit    Accounting unit.
 */
var requestHandler = function(options, res, apiKey, unit) {
    request(options, function(error, resp, body) {
        if (error) {
            res.status(504).send();
            logger.warn('An error ocurred requesting the endpoint: ' + options.url);
        } else {
            for (var header in resp.headers) {
                res.setHeader(header, resp.headers[header]);
            }
            exports.count(apiKey, unit, body, function(err){
                if(err) {
                    logger.warn('[%s] Error making the accounting: ' + err, apiKey);
                    res.status(500).send();
                } else {
                    res.send(body);
                }
            });
        }
    });
}

/**
 * Return the endpoint path for the request.
 * 
 * @param  {string}   reqPath    Complete request path.
 * @param  {string}   publicPath Public path associated with the product.
 */
var getEndpointPath = function(reqPath, publicPath, callback) {
    if (reqPath === publicPath) { // Public path is the same
        return callback(null, publicPath);
    } else {
        var splitPath = reqPath.split('/');
        if ('/' + splitPath[1] === publicPath) {
            return callback(null, '/' + reqPath.substring(splitPath[1].length + 2));
        } else {
            return callback('Invalid path', null);
        }
    }
}

/**
 * Request handler.
 * 
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var handler = function(req, res) {
    var user = req.get('X-Actor-ID');
    var apiKey = req.get('X-API-KEY');

    if(user === undefined) {
        logger.log('debug', 'Undefined username');
        res.status(401).json({ error: 'Undefined "X-Actor-ID" header'});

    } else if (apiKey === undefined) {
        logger.log('debug', 'Undefined API_KEY');
        res.status(401).json({ error: 'Undefined "X-API-KEY" header'});

    } else {
        db.checkRequest(user, apiKey, function(err, correct) {
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
                        getEndpointPath(req.path, accountingInfo.publicPath, function(err, path) {
                            if (err) {
                                res.status(400).json({ error: 'Invalid public path ' + req.path});
                            } else {
                                var options = {
                                    url: accountingInfo.url + path,
                                    method: req.method,
                                    headers: req.headers
                                }

                                if (config.resources.contextBroker && 
                                    /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/.test(url.parse(options.url).pathname)) { // Orion ContextBroker request
                                        CBrequestHandler(req, res, options, accountingInfo.unit);
                                } else {
                                    requestHandler(options, res, apiKey, accountingInfo.unit);
                                }
                            }
                        });
                    }
                });
            }
        });
    }
};

app.set('port', config.accounting_proxy.port);
app.use(bodyParser.json());

app.post('/api/resources', api.checkIsJSON, api.checkUrl);
app.post('/api/users', api.checkIsJSON, api.newBuy);
app.get('/api/users/keys', api.getApiKeys);
app.get('/api/units', api.getUnits);

app.use('/', handler);

module.exports.app = app;
module.exports.logger = logger;