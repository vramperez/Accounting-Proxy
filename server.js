var express = require('express'),
    config = require('./config'),
    proxy = require('./HTTP_Client/HTTPClient'),
    api = require('./APIServer'),
    notifier = require('./notifier'),
    cron = require('node-schedule'),
    contextBroker = require('./orion_context_broker/cb_handler'),
    url = require('url'),
    bodyParser = require('body-parser'),
    async = require('async'),
    winston = require('winston');

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: './logs/all-log',
            colorize: false
        }),
        new winston.transports.Console({
            level: 'info',
            colorize: true
        })
    ],
    exitOnError: false
});

var db = require(config.database);
var app = express();
var acc_modules = {};

var notify = function(callback) {
    db.getApiKeys(function(err, api_keys) {
        if (err) {
            return callback(err);
        } else if (api_keys.length == 0){
            logger.log('debug', "No data availiable");
            return callback(null);
        } else {
            async.each(api_keys, function(api_key, callback) {
                db.getResources(api_key, function(err, resources) {
                    if (err) {
                        return callback(err);
                    } else  if (resources.length == 0) {
                        logger.log('debug', "No data availiable");
                        return callback(null);
                    } else {
                        async.each(resources, function(resource, callback) {
                            db.getNotificationInfo(api_key, resource, function(err, info) {
                                if (err) {
                                    return callback(err);
                                } else {
                                    notifier.notify(info);
                                    return callback(err);
                                }
                            });
                        });
                    }
                });
            });
        }
    });
}

app.use( function(request, response) {
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;

    logger.log('debug', "[%s] New request", API_KEY); 

    if(serID === undefined) {
        logger.log('debug', "[%s] Undefined username", API_KEY);
        response.status(400).end();

    } else if (API_KEY === undefined) {
        logger.log('debug', "[%s] Undefined API_KEY", API_KEY);
        response.status(400).end();

    } else {
        db.checkInfo(userID, API_KEY, publicPath, function(err, unit) {
            if (err) {
                response.status(500).end();
            } else if (unit === null) { // Invalid API_KEY or user
                response.status(401).end();
            } else {
                db.getService(function(err, service) {
                    if (err) {
                        response.status(500).end();
                    } else {
                        var options = {
                            host: url.parse(service.url).host,
                            port: service.port,
                            path: url.parse(service.url).pathname,
                            method: request.method,
                            headers: proxy.getClientIp(request, request.headers)
                        };

                        if (config.resources.contextBroker && /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/.test(options.path)) { // Orion ContextBroker request
                            contextBroker.CBSubscriptionPath(service.url, request, function(operation) {
                                if (operation === 'subscribe' || operation === 'unsubscribe') { // (un)subscription request
                                    contextBroker.CBRequestHandler(request, response, servie, unit, operation);
                                } else {
                                    proxy.sendData('http', options, request.body, response, function(status, resp, headers) { // Orion ConextBroker request ( no (un)subscription)
                                        response.statusCode = status;
                                        for(var idx in headers) {
                                            response.setHeader(idx, headers[idx]);
                                        }
                                        response.send(resp);
                                        count(userID, API_KEY, publicPath, unit, resp, function(err){
                                            if(err) {
                                                logger.warn("[%s] An error ocurred while making the accounting", API_KEY);
                                            }
                                        });
                                    });
                                }
                            });
                            
                        } else {
                            proxy.sendData('http', options, request.body, response, function(status, resp, headers) { // Other requests
                                response.statusCode = status;
                                for (var idx in headers) {
                                    response.setHeader(idx, headers[idx]);
                                }
                                response.send(resp);
                                count(userID, API_KEY, publicPath, unit, resp, function(err){
                                    if (err){
                                        logger.log("[%s] An error ocurred while making the accounting", API_KEY);
                                    }
                                });
                            });
                        }
                    }
                });
            }
        });
    }
});

// Auxiliar function for accounting
var count = function(user, API_KEY, publicPath, unit, response, callback) {
    acc_modules[unit](response, function(err, amount) {
        if (err) {
            return callback(err);
        } else {
            db.count(user, API_KEY, publicPath, amount, function(err){
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        }
    });
};

/* Create daemon to update WStore every day
 * Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    logger.info('Sending accounting information...');
    notify(function(err) {
        if (err) {
            logger.error('Error while notifying the WStore');
        }
    });
});

logger.info("Loading accounting modules...");
// Load accounting modules
for (var u in config.modules.accounting) {
    try {
        acc_modules[config.modules.accounting[u]] = require("./acc_modules/" + config.modules.accounting[u] + ".js").count;
    } catch (e) {
        logger.error("No accounting module for unit '%s': missing file acc_modules\/%s.js" +  config.modules.accounting[u], config.modules.accounting[u]);
        process.exit(1);
    }
}

// Start ContextBroker Server for subscription notifications if it is enabled in the config
if (config.resources.contextBroker) {
    logger.info("Loading module for Orion Context Broker...");
    contextBroker.run();
}

notify(function(err) {
    logger.info("Notifying the WStore...");
    if (err){
        logger.warn("Notification to the WStore failed");
    }
});

app.set('port', config.accounting_proxy.port);
app.listen(app.get('port'));
app.use(bodyParser.json());
api.run();