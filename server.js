/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 24 February 2015
 */

/* Requires */
var xmlhttprequest = require('./lib/xmlhttprequest').XMLHttpRequest;
var express = require('express');
var config = require('./config');
var proxy = require('./lib/HTTPClient.js');
var sql = require('./sql.backup.js');
var s2 = require('./server2.js');

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
		map[user] = 1;
	else
		map[user] += 1;
};

app.set('port', 9000);

app.use(function(request, response, next) {
	// Define a time stamp for the request
	request.timeStamp = Date.now();
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
	var user = request.get('X-Nick-Name');
	if (user !== undefined) {
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
			// Counter ++
			count(user);
			// Update in DB
			sql.save(map[user], user);
		});
	}
	else
		console.log("[LOG] Undefined username");
});

/* Establish connection with DB */
sql.init();

/* Get data from DB if it is avaliable */
sql.loadFromDB(function(m) {
	map = m;
	console.log('[LOG] Data loaded.');
	// Listening at port 9000
	app.listen(app.get('port'));
	// Start second server
	s2.run();
});