var express = require('express');
var config = require('./config');
var proxy = require('./HTTP_Client/HTTPClient.js');
var db = require('./db_Redis.js');
var api = require('./APIServer.js');
var notifier = require('./notifier.js');
var cron = require('node-schedule');
var contextBroker = require('./orion_context_broker/cb_handler')

var app = express();

var map = {},
    acc_modules = {};

app.set('port', config.accounting_proxy.port);


if(config.resources.contextBroker){

    app.get('/subscriptions', function(req, res) {
        var subscriptionID = JSON.parse(req).subscriptionID;
        db.getCBSubscription(subscriptionID, function(subscription) {
            var API_KEY = subscription.API_KEY;
            var publicPath = subscription.publicPath;
            var info = map[API_KEY];
            var accounting = info.accounting[publicPath];
            acc_modules[subscription.unit](req.body, function(err, amount) {
                if (!err) {
                    accounting.num += amount; //Refactorizar
                    db.count(userID, API_KEY, publicPath, amount);
                }
            });
        });
    });

}

app.use(function(request, response, next) {
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

app.use(function(request, response) {
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;

    if (userID === undefined) {
        console.log("[LOG] Undefined username");
        response.status(400).end();
    }

    if (API_KEY === undefined) {
        console.log("[LOG] Undefined API_KEY");
        response.status(400).end();
    }

    if (map[API_KEY] !== undefined) {
        var info = map[API_KEY];

        if (info.actorID === userID) {
            var accounting = info.accounting[publicPath];

            if (accounting !== undefined) {
                var options = {
                    host: config.resources.host,
                    port: accounting.port,
                    path: accounting.privatePath,
                    method: request.method,
                    headers: proxy.getClientIp(request, request.headers)
                };

                if(config.resources.contextBroker && /\/(v1|v1\/registry|ngsi10|ngsi9)\/((\w+)\/?)*$/.test(options.path) ) // ContextBroker (un)subscription request
                    contextBroker.CBRequestHandler(request, response, accounting, options); 
                    

                else {
                    proxy.sendData('http', options, request.body, response, function(status, resp, headers) {
                        response.statusCode = status;
                        for(var idx in headers)
                            response.setHeader(idx, headers[idx]);
                        response.send(resp);
                        acc_modules[accounting.unit](resp, function(err, amount) {
                            if (!err) {
                                accounting.num += amount;
                                db.count(userID, API_KEY, publicPath, amount);
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


exports.newBuy = function(api_key, data) {
    map[api_key] = data;
    // console.log("PROXY MAP: \n", map);
};

exports.getMap = function(callback) {
    callback(map);
};

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

db.init();

db.loadFromDB(function(err, data) {
    if (err)
        console.log('Something went wrong');
    else {
        map = data;
        if (Object.getOwnPropertyNames(data).length === 0)
            console.log("[LOG] No data avaliable");
        else {

            console.log(JSON.stringify(map, null, 2));

            for (var apiKey in map)
                for (var publicPath in map[apiKey].accounting)
                    if (map[apiKey].accounting[publicPath].num !== 0)
                        notifier.notify({
                            "actorID": map[apiKey].actorID,
                            "API_KEY": apiKey,
                            "publicPath": publicPath,
                            "organization": map[apiKey].organization,
                            "name": map[apiKey].name,
                            "version": map[apiKey].version,
                            "correlation_number": map[apiKey].accounting[publicPath].correlation_number,
                            "num": map[apiKey].accounting[publicPath].num,
                            "reference": map[apiKey].reference
                        }, function (API_KEY, puPath, num) {
                            map[API_KEY].accounting[puPath].num = num;
                            if (num === 0) map[API_KEY].accounting[puPath].correlation_number += 1;
                        });
        }
        app.listen(app.get('port'));
        // Start API Server
        api.run(map);
    }
});


/* Create daemon to update WStore every day
 * Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    console.log('[LOG] Sending accounting information...');
    // variable i is unused in this invocation.
    for (var apiKey in map)
        for (var publicPath in map[apiKey].accounting)
            if (map[apiKey].accounting[publicPath].num !== 0)
                notifier.notify({
                    "actorID": map[apiKey].actorID,
                    "API_KEY": apiKey,
                    "publicPath": publicPath,
                    "organization": map[apiKey].organization,
                    "name": map[apiKey].name,
                    "version": map[apiKey].version,
                    "correlation_number": map[apiKey].accounting[publicPath].correlation_number,
                    "num": map[apiKey].accounting[publicPath].num,
                    "reference": map[apiKey].reference
                }, function (API_KEY, puPath, num) {
                    map[API_KEY].accounting[puPath].num = num;
                    if (num === 0) map[API_KEY].accounting[puPath].correlation_number += 1;
                });
});