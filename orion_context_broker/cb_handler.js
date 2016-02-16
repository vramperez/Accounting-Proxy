var request = require('request'),
 	subsUrls = require('./subsUrls'),
 	config = require('../config'),
 	express = require('express'),
 	acc_proxy = require('../server'),
 	url = require('url'),
 	bodyParser = require('body-parser'),
 	async = require('async');

var app = express();
var db = require('../' + config.database);

/**
 * Start the endopoint to receive CB notifications. 
 */
exports.run = function() {
	app.listen(app.get('port'));
};

/**
 * Handles the notification from the CB; make the accounting and notify the user.
 * 
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var notificationHandler = function(req, res) {
	var body = req.body;
	var subscriptionId = body.subscriptionId;

	db.getCBSubscription(subscriptionId, function(err, subscription) {
		if (err != null || subscription === null) {
			//logger.error('An error ocurred while making the accounting: Invalid subscriptionId');
		} else {
			// Make accounting
			acc_proxy.count(subscription.apiKey, subscription.unit, body, function(err) {
				if (err) {
					//logger.error('An error ocurred while making the accounting');
				} else {
					var options = {
						url: subscription.notificationUrl,
						method: req.method,
						headers: req.headers,
						json: true,
						body: body
					}
					
					request(options, function(error, resp, body) {
						if (error)  {
							// Logger.
						}
					});
			    }
			});
		}
	});
};

/**
 * Return the operation associated with the path passed as argument.
 * 
 * @param  {string}   privatePath Path for the request.
 * @param  {Object}   req         Incoming request.
 */
exports.getOperation = function(privatePath, req, callback) {
	var operation = null;

	async.forEachOf(subsUrls, function(entry, i, task_callback) {
		if (req.method === subsUrls[i][0] && privatePath.toLowerCase().match(subsUrls[i][1])) {
			operation = subsUrls[i][2];
			task_callback();
		} else {
			task_callback();
		}
	}, function() {
		return callback(null, operation);
	});
};

/**
 * Manage the subscribe/unsubscribe Context Broker requests.
 * 
 * @param  {Object}   req       Incoming request.
 * @param  {Object}   res       Outgoing response.
 * @param  {string}   url  		Context-Broker url. 
 * @param  {string}   unit      Accounting unit.
 * @param  {string}   operation Context Broker operation (subscribe, unsubscribe).
 */
exports.requestHandler = function(req, res, url, unit, operation, callback) {
	var options = {
		url: url,
		method: req.method,
		json: true,
		headers: {
			'content-type': 'application/json',
			'accept': 'application/json'
		},
		body: req.body
	}

	if (operation === 'subscribe') {
		var req_body = req.body;
		var reference_url = req_body.reference;
		req_body.reference = 'http://localhost:' + config.resources.notification_port + '/subscriptions'; // Change the notification endpoint to accounting endpoint

		// Send the request to the CB and redirect the response to the subscriber
		request(options, function(error, resp, body) {
			if (error) {
				// Logger
			} else {
				var subscriptionId = body.subscribeResponse.subscriptionId;
				res.status(resp.statusCode);
				async.forEachOf(resp.headers, function(header, key, task_callback) {
	                res.setHeader(key, header);
	                task_callback();
	            }, function() { 
	            	res.send(body);
	            	if (resp.statusCode === 200) {
	            		// Store the endpoint information of the subscriber to be notified
	            		db.addCBSubscription(req.get('X-API-KEY'), subscriptionId, reference_url, function(err) {
	            			if (err) {
	            				return callback(err);
	            			} else {
	            				return callback(null);
	            			}
	            		})
	            	} else {
	            		return callback(null);
	            	}
	            });
			}
		});

	} else if(operation === 'unsubscribe') {
		var subscriptionId = '';
		if (req.method === 'POST') {
			subscriptionId = req.body.subscriptionId;
		} else if (req.method === 'DELETE') {
			var pattern = /\/(\w+)$/;
			var match = pattern.exec(req.path);
			subscriptionId = match[0];
			subscriptionId = subscriptionId.replace('/', '');
		}

		// Sends the request to the CB and redirect the response to the subscriber
		request(options, function(error, resp, body) {
			if (error) {
				// Logger
			} else {
				res.status(resp.statusCode);
				async.forEachOf(resp.headers, function(header, key, task_callback) {
	                res.setHeader(key, header);
	                task_callback();
	            }, function() { 
	            	res.send(body);
	            	if (resp.statusCode === 200) {
	            		db.deleteCBSubscription(subscriptionId, function(err) {
	            			if (err) {
	            				return callback(err);
	            			} else {
	            				return callback(null);
	            			}
	            		});
	            	}
	            });
			}
		});
	}   
};

app.use(bodyParser.json());
app.set('port', config.resources.notification_port);
app.post('/subscriptions', notificationHandler);