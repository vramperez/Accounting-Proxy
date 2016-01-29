var proxy = require('../HTTP_Client/HTTPClient'),
    http = require('http'),
 	subsUrls = require('./subsUrls'),
 	config = require('../config'),
 	express = require('express'),
 	acc_proxy = require('../server'),
 	url = require('url'),
 	bodyParser = require('body-parser'),
 	async = require('async'),
 	winston = require('winston');

var app = express();
var db = require('../' + config.database);
var logger = new winston.Logger( {
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: '../logs/all-log',
            colorize: false
        }),
        new winston.transports.Console({
            level: 'info',
            colorize: true
        })
    ],
    exitOnError: false
});

// Initialize the endpoint
exports.run = function() {
	app.listen(app.get('port'));
};

// Receive and manage CB subscribe notifications
var notificationHandler = function(req, response) {
	var body = req.body;
	var subscriptionId = body.subscriptionId;

	db.getCBSubscription(subscriptionId, function(err, subscription) {
		if (err != null || subscription == null) {
			logger.error('An error ocurred while making the accounting: Invalid subscriptionId');
		} else {
			// Make accounting
			acc_proxy.count(subscription.API_KEY, subscription.publicPath, subscription.unit, body, function(err) {
				if (err) {
					logger.error('An error ocurred while making the accounting');
				} else {
					var options = {
						host: subscription.ref_host,
						port: subscription.ref_port,
						path: subscription.ref_path,
						method: 'POST',
						headers: {
							'content-type': 'application/json'
						}
					}

			    	// Send the response to the client
			    	proxy.sendData('http', options, JSON.stringify(body), response, function(status, resp, headers) { 
			    		response.statusCode = status;
			    		for (var i in headers) {
			    			response.setHeader(i, headers[i]);
			    		}
			    		response.send(resp);
			    		if (status !== 200) {
			    			logger.error('An error ocurred while notifying the subscription to: http://' + 
			    				subscription.ref_host + ':' + subscription.ref_port + subscription.ref_path + '. Status: ' + status + ' ' + resp.statusMessage);
			    		}
			    	});
			    }
			});
		}
	});
};

// Return the operation (subscribe/unsubscribe) based on the path
exports.getOperation = function(privatePath, request, callback) {
	var operation = null;

	async.forEachOf(subsUrls, function(entry, i, task_callback) {
		if (request.method === subsUrls[i][0] && privatePath.toLowerCase().match(subsUrls[i][1])) {
			operation = subsUrls[i][2];
			task_callback();
		} else {
			task_callback();
		}
	}, function() {
		return callback(null, operation);
	});
};


// Manage the subscribe/unsubscribe Context Broker requests
exports.requestHandler = function(request, response, service, unit, operation, callback) {
	var options = {
		host: config.resources.host,
		port: service.port,
		path: url.parse(service.url).pathname,
		method: request.method,
		headers: {
			'content-type': 'application/json',
			'accept': 'application/json'
		}
	}

	switch (operation) {
		case 'subscribe':
			var req_body = request.body;
			var reference_url = req_body.reference;
			req_body.reference = 'http://localhost:/' + config.resources.notification_port + '/subscriptions'; // Change the notification endpoint to accounting endpoint

			// Send the request to the CB and redirect the response to the subscriber
			proxy.sendData('http', options, JSON.stringify(req_body), response, function(status, resp, headers) {
				var subscriptionId = resp.subscribeResponse.subscriptionId;
				response.statusCode = status;
				for (var i in headers) {
					response.setHeader(i, headers[i]);
				}
				response.send(resp);
				if (status === 200) {
					// Store the endpoint information of the subscriber to be notified
					db.addCBSubscription(request.get('X-API-KEY'), request.path, subscriptionId, url.parse(reference_url).host, 
						url.parse(reference_url).port, url.parse(reference_url).pathname, unit, function(err){
							if (err) {
								return callback(err);
							} else {
								return callback(null);
							}
					});
				}
			});
			break;

		case 'unsubscribe':
			var subscriptionId = '';
			if (request.method === 'POST') {
				subscriptionId = request.body.subscriptionId;
			} else if (request.method === 'DELETE') {
				var pattern = /\/(\w+)$/;
				var match = pattern.exec(request.path);
				subscriptionId = match[0];
				subscriptionId = subscriptionId.replace('/', '');
			}

			// Sends the request to the CB and redirect the response to the subscriber
			proxy.sendData('http', options, request, response, function(status, resp, headers) {
				response.statusCode = status;
				for (var idx in headers) {
					response.setHeader(idx, headers[idx]);
				}
				response.send(resp);
				if (status === 200) {
					db.deleteCBSubscription(subscriptionId, function(err){
						if (err) {
							return callback(err);
						} else {
							return callback(null);
						}
					});
				}
			});
			break;
	}   
};

app.use(bodyParser.json());
app.set('port', config.resources.notification_port);
app.post('/subscriptions', notificationHandler);