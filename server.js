var express = require('express'),
    config = require('./config'),
    api = require('./APIServer'),
    notifier = require('./notifier'),
    cron = require('node-schedule'),
    contextBroker = require('./orion_context_broker/cb_handler'),
    url = require('url'),
    bodyParser = require('body-parser'),
    async = require('async'),
    request = require('request');

"use strict";

var db = require(config.database);
db.init(); // Initialize the database
var app = express();
var acc_modules = {};

exports.init = function() {
    app.listen(app.get('port'));
}

var loadAccModules = function(callback) {
    async.each(config.modules.accounting, function(module, task_callback) {
        try {
            acc_modules[module] = require('./acc_modules/' + module).count;
        } catch (e) {
            
        }
        task_callback();
    }, callback);
    for (var u in config.modules.accounting) {
        try {
            acc_modules[config.modules.accounting[u]] = require("./acc_modules/" + config.modules.accounting[u]).count;
        } catch (e) {
            logger.error("No accounting module for unit '%s': missing file acc_modules\/%s.js" +  config.modules.accounting[u], config.modules.accounting[u]);
        }
    }
} 

/**
 * Call the notifier to send the accounting information to the WStore.
 */
var notify = function(callback) {
    db.getNotificationInfo(function(err, notificationInfo) {
        if (err) {
            return callback(err);
        } else if (notificationInfo !== null) {
            return callback(null);
        } else {
            notifier.notify(notificationInfo);
            return callback(null);
        }
    });
}

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

// Auxiliar function for accounting
exports.count = function(user, API_KEY, publicPath, unit, response, callback) {
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

// Auxiliar functon that handles ContextBroker request
var CBrequestHandler = function(req, response, service, options, unit) {
    var userID = req.get('X-Actor-ID');
    var API_KEY = req.get('X-API-KEY');
    var publicPath = req.path;

    contextBroker.getOperation(service.url, req, function(err, operation) {
        if (err) {
            logger.error('Error obtaining the operation based on CB path %s', url.parse(options.url).pathname );
        } else if (operation === 'subscribe' || operation === 'unsubscribe') { // (un)subscription request
            contextBroker.requestHandler(req, response, service, unit, operation, function(err) {
                if (err) {
                    logger.error('Error processing CB request');
                } 
            });
        } else {
            request(options, function(error, resp, body) {
                if (error) {
                    response.status(500).send(error);
                    logger.warn("An error ocurred requesting Context-Broker");
                } else {
                    for (var i in resp.headers) {
                        response.setHeader(i, resp.headers[i])
                    }
                    exports.count(userID, API_KEY, publicPath, unit, body, function(err){
                        if(err) {
                            logger.warn("[%s] An error ocurred while making the accounting", API_KEY);
                        }
                        response.send(body);
                    });
                }
            });
        }
    });
}

// Auxiliar function that handles generic requests (no ContextBroker)
var requestHandler = function(req, response, options, unit) {
    var userID = req.get('X-Actor-ID');
    var API_KEY = req.get('X-API-KEY');
    var publicPath = req.path;

    request(options, function(error, resp, body) {
        if (error) {
            response.status(500).send(error);
            logger.warn("An error ocurred requesting the endpoint");
        } else {
            for (var i in resp.headers) {
                response.setHeader(i, resp.headers[i])
            }
            exports.count(userID, API_KEY, publicPath, unit, body, function(err){
                if(err) {
                    logger.warn("[%s] An error ocurred while making the accounting", API_KEY);
                }
                response.send(body);
            });
        }
    });
}

var handler = function(request, response) {
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;

    logger.log('debug', "[%s] New request", API_KEY); 
    if(userID === undefined) {
        logger.log('debug', "[%s] Undefined username", API_KEY);
        response.status(400).json({ error: 'Undefined "X-Actor-ID" header'});

    } else if (API_KEY === undefined) {
        logger.log('debug', "[%s] Undefined API_KEY", API_KEY);
        response.status(400).json({ error: 'Undefined "X-API-KEY" header'});

    } else {
        db.checkInfo(userID, API_KEY, publicPath, function(err, unit) {
            if (err) {
                response.status(500).end();
            } else if (unit === null) { // Invalid API_KEY, user or path
                response.status(401).json({ error: 'Invalid API_KEY, user or path'});
            } else {
                db.getService(publicPath ,function(err, service) {
                    if (err) {
                        response.status(500).end();
                    } else {
                        var options = {
                            url: service.url,
                            json: true,
                            method: request.method,
                            headers: request.headers,
                            body: request.body
                        };
                        if (config.resources.contextBroker && /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/.test(url.parse(options.url).pathname)) { // Orion ContextBroker request
                            CBrequestHandler(request, response, service, options, unit);
                        } else {
                            requestHandler(request, response, options, unit)
                        }
                    }
                });
            }
        });
    }
};

app.set('port', config.accounting_proxy.port);
app.use(bodyParser.json());
app.use('/', handler);
api.run();
module.exports.app = app;