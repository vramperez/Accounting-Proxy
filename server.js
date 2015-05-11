var express = require('express');
var config = require('./config');
var proxy = require('./HTTP_Client/HTTPClient.js');
var db = require('./db.js');
var s2 = require('./server2.js');
var notifier = require('./notifier.js');
var cron = require('node-schedule');

var app = express();

var map = {};

/**
 * Add a new request to the user
 * @param  {STRING} user [user's nickname]
 * DEPRECATED
 */
var count = function(user) {
    if (map[user] === undefined)
        console.log('[LOG] Unauthorized user: ' + user);
    else {
        map[user].requests += 1;
        db.save(user, map[user].requests);
    }
};

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
    var publicPath = request.path;
    if (userID !== undefined) {
        if (map[publicPath] !== undefined) {
            var user;
            for (var idx in map[publicPath].users) {
                // TODO: Use API_KEY from header
                if (map[publicPath].users[idx].id === userID &&
                    map[publicPath].users[idx].API_KEY === '1234') {
                    user = map[publicPath].users[idx];
                    break;
                }
            }
            if (i === undefined) {
                console.log("[ERROR] User doesn't have access.");
                response.status(403).end();
            } else {
                var options = {
                    host: 'localhost',
                    port: map[publicPath].port,
                    path: map[publicPath].path,
                    method: request.method,
                    headers: proxy.getClientIp(request, request.headers)
                }

                proxy.sendData('http', options, request.body, response, function(status, resp, headers) {
                    response.statusCode = status;
                    for(var idx in headers)
                        response.setHeader(idx, headers[idx]);
                    response.send(resp);
                    user.num++;
                    db.count(userID, map[publicPath].path, map[publicPath].port); // Counter++
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

/**
 * Update users list with new user
 * @param {STRING} userID    [user ID]
 * @param {STRING} user      [user's nickname]
 * @param {STRING} reference [purchase reference]
 * @param {OBJECT} offer     [offer data]
 * DEPRECATED
 */
exports.newUser = function(userID, user, reference, offer) {
    // Add user only if he isn't exists already.
    if (map[userID] === undefined) {
        // Update local list
        map[userID] = {
            requests: 0,
            username: user,
            reference: reference,
            correlation_number: 0
        }
        // Update DB
        db.newUser(userID, user, reference, offer);
        console.log('[LOG] New user ' + user + ' added.');
    }
    else {
        console.log('[LOG] User ' + user + ' already exists');
        console.log('[LOG] Checking purchase reference...');
        if (map[userID].reference !== reference) {
            console.log('[LOG] New purchase reference. Updating...');
            // i parameter is unused in this invocation
            notifier.notify(0, map[userID], userID, function(i, user_id, request, correlation_number) {
                map[user_id].correlation_number = correlation_number;
                db.updateReference(user_id, reference, function(r){
                    map[user_id].reference = r;
                    map[user_id].requests = 0;
                });
            });
        }
        else
            console.log('[LOG] Reference is already up to date');

}}

db.init();

db.loadFromDB(function(err, data) {
    if (err)
        console.log('Something went wrong');
    else {
        map = data;
        if (Object.getOwnPropertyNames(data).length === 0) // isEmpty
            console.log("[LOG] No data avaliable")
        else {
            console.log(map);
            console.log(JSON.stringify(map, null, 2));
        }
        app.listen(app.get('port'));
        // Start API Server
        s2.run();
    }
});

/* Create daemon to update WStore every day */
/* Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
 * DEPRECATED
 */
var job = cron.scheduleJob('00 00 * * *', function() {
    console.log('[LOG] Sending accouting information...')
    // variable i is unused in this invocation.
    for (userID in map) {
        notifier.notify(0, map[userID], userID, function(i, user_id, requests, correlation_number) {
            map[user_id].requests = requests;
            map[user_id].correlation_number = correlation_number;
        });
    }
});