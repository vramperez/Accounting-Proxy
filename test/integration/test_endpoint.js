var express = require('express'),
    bodyParser = require('body-parser'),
    configTest = require('../config_tests').integration,
    fs = require('fs'),
    data = require('../data');

var app = express();

var subscriptionId = data.DEFAULT_SUBS_ID;
var server;
var port = configTest.test_endpoint_port;

exports.run = function () {
    console.log('[LOG]: starting an endpoint for testing (in port ' + port + ')...');
    server = app.listen(port);
};

exports.stop = function (callback) {
    console.log('[LOG]: stopping the endpoint for testing...');
    server.close(callback);
};

var returnHtml = function (callback) {
    fs.readFile('./test/integration/ejemplo.html', function (err, html) {
        if (err) {
            return callback(err, null);
        } else {
            return callback(null, html);
        }
    });
};

var serviceHandler =  function (req, res) {
    returnHtml(function (err, html) {
        if (err) {
            res.status(500).send();
        } else {
            res.status(200).send(html);
        }
    });
};

var createEntity = function (req, res) {
    res.status(200).json(data.newEntityResp);
};

var subscribeContext = function (req, res) {
    res.status(200).json(data.createSubscriptionRespV1);   
};

var unsubscribeContext = function (req, res) {
    res.status(200).json(data.cancelSubscriptionResp);
};

var unsubscribeContextDelete = function (req, res) {
    res.status(200).json(data.cancelSubscriptionResp);
};

var updateContextSubscription = function (req, res) {
    res.status(200).json(data.updateSubscriptionResp);
};

var contextEntity = function (req, res) {
    res.status(200).json(data.room1);
};

var contextEntities = function (req, res) {
    res.status(200).json(data.allEntities);
};

var createSubscription = function (req, res) {
    res.setHeader('Location', '/v2/subscriptions/' + subscriptionId);
    res.status(201).send();
};

var deleteSubscription = function (req, res) {
    res.status(204).send();
};

var updateSubscription = function (req, res) {
    res.status(204).send();  
}

var usageSpecificationHandler = function (req, res) {
    if (req.body.name === 'call') {
        req.body['href'] = data.DEFAULT_HREFS[0];
        res.status(201).json(req.body);
    } else {
        req.body['href'] = data.DEFAULT_HREFS[1];
        res.status(201).json(req.body);
    }
};

var usageHandler = function (req, res) {
    res.status(201).send();
};

app.delete('/v1/contextSubscriptions/' + subscriptionId, unsubscribeContextDelete);

app.use(bodyParser.json());

app.get('/rest/*', serviceHandler);

app.get('/v1/contextEntity/Room1', contextEntity);
app.get('/v1/contextEntities', contextEntities);
app.post('/v1/contextEntities/Room1', createEntity);
app.post('/v1/subscribeContext', subscribeContext);
app.post('/v1/unsubscribeContext', unsubscribeContext);
app.post('/v1/updatecontextsubscription', updateContextSubscription);
app.post('/v2/subscriptions', createSubscription);
app.delete('/v2/subscriptions/' + data.DEFAULT_SUBS_ID, deleteSubscription);
app.patch('/v2/subscriptions/' + data.DEFAULT_SUBS_ID, updateSubscription);
app.post('/usageSpecification', usageSpecificationHandler);
app.post('/usage', usageHandler);