var proxy = require('../HTTP_Client/HTTPClient.js');
var http = require('http');
var db = require('../db_Redis.js');
var subsUrls = require('./subsUrls');
var config = require('../config');
var express = require('express');
var acc_proxy = require('../server');

var app = express();

app.set('port', config.resources.notification_port);

app.post('/subscriptions', function(req, response) { // Probar la contestacion

	var body = '';
	req.on('data', function(d) {
		body += d;
	}).on('end', function(){

	var req_body = JSON.parse(body);
	var subscriptionId = req_body.subscriptionId
    	db.getCBSubscription(subscriptionId, function(subscription) {
    		if(subscription === null)
    			console.log('[LOG] An error ocurred while making the accounting: Invalid subscriptionId');
    		else{
    			acc_proxy.count(subscription.API_KEY, subscription.publicPath, subscription.unit, body, function(err) {
    				if(err)
    					console.log('[LOG] An error ocurred while making the accounting');
    			});

    			var options = {
    				host: subscription.ref_host,
    				port: subscription.ref_port,
    				path: subscription.ref_path,
    				method: 'POST',
    				headers: {
    					'content-type': 'application/json'
    				}
    			}
    			
    			proxy.sendData('http', options, JSON.stringify(req_body), response, function(status, resp, headers) {
    				response.statusCode = status;
    				for (var i in headers)
    					response.setHeader(i, headers[i]);
    				response.send(resp);
    				if( status !== 200)
    					console.log('[LOG] An error ocurred while notifying the subscription to: http://' + 
    						subscription.ref_host + ':' + subscription.ref_port + subscription.ref_path + '. Status: ' + status + ' ' + resp.statusMessage);
    			});
    		}
    	});
	});

});	

exports.run = function(){
	app.listen(app.get('port'));
};

exports.CBSubscriptionPath = function(privatePath, request, callback) {

	var operation = undefined;

	for (var i = 0; i < subsUrls.length; i++) {
        if (request.method === subsUrls[i][0] &&
            privatePath.toLowerCase().match(subsUrls[i][1])){
        		break;
        		operation = subsUrls[i][2];
            }
    }
    callback(operation);
};

exports.CBRequestHandler = function(request, response, accounting, operation) {

	var options = {
		host: config.resources.host,
		port: accounting.port,
		path: accounting.privatePath,
		method: request.method,
		headers: {
			'content-type': 'application/json',
			'accept': 'application/json'
		}
	}

	switch (operation) {
		case 'subscribe':
			var req_body = JSON.parse(request.body);
			var reference_url = req_body.reference;
			req_body.reference = 'http://localhost:/' + config.accounting_proxy.port + '/subscriptions';

			proxy.sendData('http', options, JSON.stringify(req_body), response, function(status, resp, headers) {
				var subscriptionId = JSON.parse(resp).subscribeResponse.subscriptionId;
				response.statusCode = status;
				for (var i in headers)
					response.setHeader(i, headers[i]);
				response.send(resp);
				if(status === 200){
					db.addCBSubscription(request.get('X-API-KEY'), request.path, subscriptionId, url.parse(reference_url).host, 
						url.parse(reference_url).port, url.parse(reference_url).pathname, accounting.unit, function(err){
							if(err)
								console.log('[LOG] An error ocurred while processing the subscription');
						});
				}
			});
		break;

		case 'unsubscribe':
			var subscriptionId = '';
			if (request.method === 'POST') {
				subscriptiionID = JSON.parse(request.body).subscriptionId;
			} else if (request.method === 'DELETE') {
				var pattern = /\/(\w+)$/;
				var match = pattern.exec(request.path);
				subscriptionId = match[0];
			}

			proxy.sendData('http', options, request, response, function(status, resp, headers) {
				response.statusCode = status;
				for(var idx in headers)
					response.setHeader(idx, headers[idx]);
				response.send(resp);
				if (status === 200){
					db.deleteCBSubscription(subscriptionId, function(err){
						if(err)
							console.log('[LOG] An error occurred while cancelling the subscription');
					});
				}
			});
			break;
	}   
};