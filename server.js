/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 06 February 2015
 */

/* Requires */
var xmlhttprequest = require('./lib/xmlhttprequest').XMLHttpRequest;
var express = require('express');

/* Init app with express framework */
var app = express();

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
	console.log("method: " + request.method);
	for (item in request.headers) {
		console.log(item + ': ' + request.headers[item]);
	}
	response.send("RECIEVED!!\n"); // END
});

/* Listening at port 9000*/
app.listen(app.get('port'));