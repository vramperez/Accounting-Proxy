var express = require('express');
var config = require('./config.json');
var proxy = require('./HTTP_Client/HTTPClient.js');
var db = require('./db.js');
var api = require('./APIServer.js');
var notifier = require('./notifier.js');
var cron = require('node-schedule');

var app = express();

var map = {},
    users = {};

app.set('port', 9000);

app.use(function(request, response, next) {
    // Define a time stamp for the request
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
    // Save information
    var userID = request.get('X-Actor-ID');
    var API_KEY = request.get('X-API-KEY');
    var publicPath = request.path;
    if (userID !== undefined) {
        if (map[publicPath] !== undefined) {
            var user;
            for (var idx in map[publicPath].users) {
                if (map[publicPath].users[idx].id === userID &&
                    map[publicPath].users[idx].API_KEY === API_KEY) {
                    user = map[publicPath].users[idx];
                    break;
                }
            }
            if (user === undefined) {
                console.log("[ERROR] User doesn't have access.");
                response.status(403).end();
            } else {
                var options = {
                    host: 'localhost',
                    port: map[publicPath].port,
                    path: map[publicPath].path,
                    method: request.method,
                    headers: proxy.getClientIp(request, request.headers)
                };

                proxy.sendData('http', options, request.body, response, function(status, resp, headers) {
                    response.statusCode = status;
                    for(var idx in headers)
                        response.setHeader(idx, headers[idx]);
                    response.send(resp);
                    user.num++;
                    db.count(userID, user.API_KEY); // Counter++
                    // console.log(JSON.stringify(map, null, 2));
                });
            }
        }
    }
    else {
        console.log("[LOG] Undefined username");
        response.status(401).end();
    }
});

exports.newUser = function(user, apiKey, paths) {

    // Add user if not exist.
    if (users[apiKey] === undefined)
        console.log("New user found!!");
        users[apiKey] = {
            API_KEY: api,
            id: user,
            num: 0
        };

    // Add user to paths
    for (var i in paths) {
        var found = false;
        for (var j in map[paths[i].publicPath].users) {
            if (map[paths[i].publicPath].users[j].id === user &&
                map[paths[i].publicPath].users[j].API_KEY === apiKey) {
                found = true;
                break;
            }
        }
        if (!found)
            map[paths[i].publicPath].users.push(users[apiKey]);
    }

    // console.log(JSON.stringify(map, null, 2));
};

db.init();

db.loadFromDB(function(err, data, usr) {
    if (err)
        console.log('Something went wrong');
    else {
        map = data;
        users = usr;
        if (Object.getOwnPropertyNames(data).length === 0)
            console.log("[LOG] No data avaliable");
        else {
            console.log(map);
            console.log(JSON.stringify(map, null, 2));
            for (var user in users) {
                notifier.notify(users[user].id, users[user].API_KEY, users[user].num, function(user, API_KEY, num) {
                    users[API_KEY].num = num;
                });
            }
        }
        app.listen(app.get('port'));
        // Start API Server
        api.run();
    }
});

/* Create daemon to update WStore every day */
/* Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 * DEPRECATED
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    console.log('[LOG] Sending accouting information...');
    // variable i is unused in this invocation.
    for (userID in map) {
        notifier.notify(0, map[userID], userID, function(i, user_id, requests, correlation_number) {
            map[user_id].requests = requests;
            map[user_id].correlation_number = correlation_number;
        });
    }
});
