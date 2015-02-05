/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 05 February 2015
 */

/* Requires */
var xmlhttprequest = require('./lib/xmlhttprequest').XMLHttpRequest;
var express = require('express');

/* Init app with express framework */
var app = express();

app.use(function(request, respond, next) {
	var data='';
	request.setEncoding('utf8');
	// Save data
	request.on('data', function(chunk) {
		data += chunk;
	});
	// Finish recieving data
	resquest.on('end', function() {
		request.body = data;
		next();
	});
});