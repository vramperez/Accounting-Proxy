var express = require('express'),
	config_test = require('../config_tests'),
	bodyParser = require('body-parser'),
	fs = require('fs');

var app = express();

exports.run = function() {
	app.listen(config_test.integration.endpoint.port)
}

var example1_handler = function(req, res) {
	res.status(200).send();
}

var example2_handler =  function(req, res) {
	fs.readFile('./ejemplo.html', function(err, html) {
        res.writeHeader(200,  {"Content-Type": "text/html"});
        res.write("" + html);
        res.end();
    });
};

var wrong_handler = function(req, res) {
	res.status(400).send();
}

var updateContext = function(req, res) {
	if (req.body.correct == 'wrong') {
		res.status(400).send();
	} else if (req.body['updateAction'] = 'APPEND') {
		res.writeHeader(200,  {"Content-Type": "application/json"});
		res.write(JSON.stringify({
		    "contextResponses": [
		        {
		            "contextElement": {
		                "attributes": [
		                    {
		                        "name": "temperature",
		                        "type": "float",
		                        "value": ""
		                    },
		                    {
		                        "name": "pressure",
		                        "type": "integer",
		                        "value": ""
		                    }
		                ],
		                "id": "Room1",
		                "isPattern": "false",
		                "type": "Room"
		            },
		            "statusCode": {
		                "code": "200",
		                "reasonPhrase": "OK"
		            }
		        }
		    ]
			}
		));
		res.end();
	} else if (req.body['updateAction'] = 'UPDATE') {
		res.writeHeader(200,  {"Content-Type": "application/json"});
		res.write(JSON.stringify( {
		    "contextResponses": [
		        {
		            "contextElement": {
		                "attributes": [
		                    {
		                        "name": "temperature",
		                        "type": "float",
		                        "value": ""
		                    },
		                    {
		                        "name": "pressure",
		                        "type": "integer",
		                        "value": ""
		                    }
		                ],
		                "id": "Room1",
		                "isPattern": "false",
		                "type": "Room"
		            },
		            "statusCode": {
		                "code": "200",
		                "reasonPhrase": "OK"
		            }
		        }
		    ]
		}));
		res.end();
	}
}

var queryContext = function(req, res) {
	if (req.body.correct == 'wrong') {
		res.writeHeader(400, {"Content-Type": "application/json"});
		res.write(JSON.stringify({
		    "errorCode": {
		        "code": "404",
		        "reasonPhrase": "No context elements found"
		    }
		}));
		res.end();
	} else {
		res.writeHeader(200,  {"Content-Type": "application/json"});
		res.write(JSON.stringify( {
		    "contextResponses": [
		        {
		            "contextElement": {
		                "attributes": [
		                    {
		                        "name": "temperature",
		                        "type": "float",
		                        "value": "23"
		                    },
		                    {
		                        "name": "pressure",
		                        "type": "integer",
		                        "value": "720"
		                    }
		                ],
		                "id": "Room1",
		                "isPattern": "false",
		                "type": "Room"
		            },
		            "statusCode": {
		                "code": "200",
		                "reasonPhrase": "OK"
		            }
		        }
		    ]
		}
		));
		res.end();
	}
}

var subscribeContext_handler = function(req, res) {
	res.writeHeader(200,  {"Content-Type": "application/json"});
	res.write(JSON.stringify({
	    "subscribeResponse": {
	        "duration": "P1M",
	        "subscriptionId": "51c0ac9ed714fb3b37d7d5a8"
	    }
	}));
	res.end();
}

var unsubscribeContext_handler = function(req, res) {
	res.writeHeader(200,  {"Content-Type": "application/json"});
	res.write(JSON.stringify({
	    "statusCode": {
	        "code": "200",
	        "reasonPhrase": "OK"
	    },
	    "subscriptionId": "51c0ac9ed714fb3b37d7d5a8"
	}));
	res.end();
}

app.use(bodyParser.json());
app.get('/rest/example1', example1_handler);
app.get('/rest/example2', example2_handler);
app.get('/rest/wrong', wrong_handler);
app.post('/v1/updateContext', updateContext);
app.post('/v1/queryContext', queryContext);
app.post('/v1/subscribeContext', subscribeContext_handler);
app.post('/v1/unsubscribeContext', unsubscribeContext_handler)