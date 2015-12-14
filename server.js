var express = require('express');
var config = require('./config');
var proxy = require('./HTTP_Client/HTTPClient');
var db = require('./db_Redis');
var api = require('./APIServer');
var notifier = require('./notifier');
var cron = require('node-schedule');
var contextBroker = require('./orion_context_broker/cb_handler');
var url = require('url');

var app = express();
var accounting_info = {},
    acc_modules = {};

app.set('port', config.accounting_proxy.port);

// Load accounting modules
for (var u in config.modules.accounting) {
    try {
        acc_modules[config.modules.accounting[u]] = require("./acc_modules/" + config.modules.accounting[u] + ".js").count;
    } catch (e) {
        console.log("[ERROR] No accounting module for unit '" + config.modules.accounting[u] + "': missing file " +
                    "'acc_modules\\" +  config.modules.accounting[u] + ".js'");
        process.exit(1);
    }
}

/**
 * Load all the information from the DB and stores in accounting_info
 *
 * @param {Object} err           DB error.
 * @param {Object} data          Data loaded from the DB
 */
db.loadFromDB(function(err, data) {
    if (err){ 
        console.log('Something went wrong');
    } else {
        accounting_info = data;
        if (Object.getOwnPropertyNames(data).length === 0) {
            console.log('[LOG] No data avaliable');
        } else {
            console.log(JSON.stringify(accounting_info, null, 2));

            for (var apiKey in accounting_info) {
                for (var publicPath in accounting_info[apiKey].accounting) {
                     if (accounting_info[apiKey].accounting[publicPath].num != 0) {
                        notifier.notify( { // Sacar a funcion
                            "actorID": accounting_info[apiKey].actorID,
                            "API_KEY": apiKey,
                            "publicPath": publicPath,
                            "organization": accounting_info[apiKey].organization,
                            "name": accounting_info[apiKey].name,
                            "version": accounting_info[apiKey].version,
                            "correlation_number": accounting_info[apiKey].accounting[publicPath].correlation_number,
                            "num": accounting_info[apiKey].accounting[publicPath].num,
                            "reference": accounting_info[apiKey].reference
                        }, function (API_KEY, puPath, num) {
                            accounting_info[API_KEY].accounting[puPath].num = num;
                            if (num === 0) {
                                accounting_info[API_KEY].accounting[puPath].correlation_number += 1;
                            }
                        });
                    }
                }
            }
        }
        app.listen(app.get('port'));
        // Start API Server
        api.run(accounting_info);
        // Start ContextBroker Server for subscription notifications if it is enabled in the config
        if (config.resources.contextBroker) {
            contextBroker.run();
        }
    }
});

app.use( function(request, response, next) {
    var data = '';
    // Receive data
    request.on('data', function(d) {
        data += d;
    });
    // Finish receiving data
    request.on('end', function() {
        request.body = data;
        next();
    });
});

app.use( function(request, response) {
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;
    if (userID === undefined) {
        console.log("[LOG] Undefined username");
        response.status(400).end();

    } else if (API_KEY === undefined) {
        console.log("[LOG] Undefined API_KEY");
        response.status(400).end();

    } else if (accounting_info[API_KEY] !== undefined) {
        var info = accounting_info[API_KEY];

        if (info.actorID === userID) {
            var accounting = info.accounting[publicPath];

            if (accounting !== undefined) {
                var options = {
                    host: url.parse(accounting.url).host,
                    port: accounting.port,
                    path: url.parse(accounting.url).pathname,
                    method: request.method,
                    headers: proxy.getClientIp(request, request.headers)
                };

                if (config.resources.contextBroker && /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/.test(options.path)) { // Orion ContextBroker request
                    contextBroker.CBSubscriptionPath(accounting.url, request, function(operation) {
                        if (operation === 'subscribe' || operation === 'unsubscribe') { // (un)subscription request
                            contextBroker.CBRequestHandler(request, response, accounting, operation);
                        } else {
                            proxy.sendData('http', options, request.body, response, function(status, resp, headers) { // Orion ConextBroker request ( no (un)subscription)
                                response.statusCode = status;
                                for(var idx in headers) {
                                    response.setHeader(idx, headers[idx]);
                                }
                                response.send(resp);
                                count(API_KEY, publicPath, accounting, resp, function(err){
                                    if(err) {
                                        console.log('[LOG] An error ocurred while making the accounting');
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
                        count(API_KEY, publicPath, accounting, resp, function(err){
                            if (err){
                                console.log('[LOG] An error ocurred while making the accounting');
                            }
                        });
                    });
                }
            } else {
                console.log("[LOG] Invalid resurce");
                response.status(404).end();
            }
        } else {
            console.log("[LOG] User has not access");
            response.status(403).end();
        }
    } else {
        console.log("[LOG] Invalid API_KEY");
        response.status(403).end();
    }
});

// Auxiliar function for accounting
count = function(API_KEY, publicPath, accounting, response, callback) {

    acc_modules[accounting.unit](response, function(err, amount) {
        if (err) {
            return callback(err);
        } else {
            accounting.num += amount;
            db.count(accounting_info[API_KEY].actorID, API_KEY, publicPath, amount, function(err, num){
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
};

exports.newBuy = function(api_key, data, callback) {
    accounting_info[api_key] = data;
    return callback(null);
};

exports.getMap = function(callback) {
    return callback(null, accounting_info);
};

/* Create daemon to update WStore every day
 * Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    console.log('[LOG] Sending accounting information...');
    // variable i is unused in this invocation.
    for (var apiKey in accounting_info) {
        for (var publicPath in accounting_info[apiKey].accounting) {
            if (accounting_info[apiKey].accounting[publicPath].num !== 0) {
                notifier.notify({ // Sacar a funcion
                    "actorID": accounting_info[apiKey].actorID,
                    "API_KEY": apiKey,
                    "publicPath": publicPath,
                    "organization": accounting_info[apiKey].organization,
                    "name": accounting_info[apiKey].name,
                    "version": accounting_info[apiKey].version,
                    "correlation_number": accounting_info[apiKey].accounting[publicPath].correlation_number,
                    "num": accounting_info[apiKey].accounting[publicPath].num,
                    "reference": accounting_info[apiKey].reference
                }, function (API_KEY, puPath, num) {
                    accounting_info[API_KEY].accounting[puPath].num = num;
                    if (num === 0) {
                        accounting_info[API_KEY].accounting[puPath].correlation_number += 1;  
                    }
                });
            }
        }
    }
});