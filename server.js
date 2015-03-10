/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 10 March 2015
 */

/* Requires */
var xmlhttprequest = require('./lib/xmlhttprequest').XMLHttpRequest;
var express = require('express');
var config = require('./config');
var proxy = require('./lib/HTTPClient.js');
var sql = require('./sql.backup.js');
var s2 = require('./server2.js');
var notifier = require('./notifier.js');
var cron = require('node-schedule');

/* Create app with Express Framework */
var app = express();

/* Map for saving users' requests */
var map = {};

/**
 * Add a new request to the user
 * @param  {STRING} user [user's nickname]
 */
var count = function(user) {
	if (map[user] === undefined)
		console.log('[LOG] Unauthorized user: ' + user);
	else {
		map[user].requests += 1;
		sql.save(user, map[user].requests);
	}
};

app.set('port', 9000);

app.use(function(request, response, next) {
	// Define a time stamp for the request
	// request.timeStamp = Date.now();
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
	var userID = request.get('X-Nick-Name'); ///// HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	if (userID !== undefined) {
		// Redirect request
		var options = {
			host: config.app_host,
			port: config.app_port,
			path: request.url,
			method: request.method,
			headers: proxy.getClientIp(request, request.headers)
		}
		// Redirect the request
		proxy.sendData('http', options, request.body, response, function(status, resp, headers) {
			response.statusCode = status;
			for(var idx in headers)
				response.setHeader(idx, headers[idx]);
			response.send(resp);
			// Counter ++ and update DB
			count(userID);
		});
	}
	else
		console.log("[LOG] Undefined username");
});

/**
 * Update users list with new user
 * @param {STRING} userID 	 [user ID]
 * @param {STRING} user   	 [user's nickname]
 * @param {STRING} reference [purchase reference]
 * @param {OBJECT} offer     [offer data]
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
		sql.newUser(userID, user, reference, offer);
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
				sql.updateReference(user_id, reference, function(r){
					map[user_id].reference = r;
					map[user_id].requests = 0;
				});
			});
		}
		else
			console.log('[LOG] Reference is already up to date');
	}
}

/* Establish connection with DB */
sql.init();

/* Get data from DB if it is avaliable */
sql.loadFromDB(function(m) {
	map = m;
	console.log(map);
	console.log('[LOG] Data loaded.');
	// Listening at port 9000
	app.listen(app.get('port'));
	// Start second server
	s2.run()
});

/* Create daemon to update WStore every day */
/* Cron format:
 * [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
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