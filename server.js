/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 06 February 2015
 */

/* Requires */
var xmlhttprequest = require('./lib/xmlhttprequest').XMLHttpRequest;
var express = require('express');
var config = require('./config');
var proxy = require('./lib/HTTPClient.js');

/* Init app with express framework */
var app = express();

/* Map for saving info */
var map = {};

// Show information
var print = function() {
	for(var item in map)
		console.log("user: " + item +  "\tnum: " + map[item]);
};

// Add a new request to the user
var count = function(user) {
	if (map[user] === undefined)
		map[user] = 1;
	else
		map[user] += 1;
};

app.set('port', 9000);

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
	// Debugging: Show request's headers
	// console.log(request.headers);
	// console.log(request.url);
	// 
	// Save information
	var user = request.get('X-Nick-Name');
	if (user !== undefined) {
		count(user);
		// Redirect request
		var options = {
			host: config.app_host,
			port: config.app_port,
			path: request.url,
			method: request.method,
			headers: proxy.getClientIp(request, request.headers)
		}
		proxy.sendData('http', options, request.body, response);
	}
	else
		console.log("Undefined username");

	// Debugging: Print number of request
	// print();
});

/* Listening at port 9000*/
app.listen(app.get('port'));