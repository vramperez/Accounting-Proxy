var express = require('express'),
    bodyParser = require('body-parser'),
    config_test = require('../config_tests').integration,
    fs = require('fs'),
    data = require('../data');

var app = express();

var subscriptionId = data.DEFAULT_SUBS_ID;
var server;

exports.run = function (port) {
    console.log('[LOG]: starting an endpoint for testing (in port ' + port + ')...');
    server = app.listen(port);
};

exports.stop = function (callback) {
    console.log('[LOG]: stopping the endpoint for testing...');
    server.close(callback);
};

var returnHtml = function (res) {
    fs.readFile('./test/integration/ejemplo.html', function (err, html) {
        res.writeHeader(200,  {"Content-Type": "text/html"});
        res.write("" + html);
        res.end();
    });
};

var serviceHandler =  function (req, res) {
    returnHtml(res);
};

var createEntity = function (req, res) {
    res.status(200).json(data.newEntityResp);
}

var subscribeContext = function (req, res) {
    res.status(200).json(data.createSubscriptionResp);   
};

var unsubscribeContext = function (req, res) {
    res.status(200).json(data.cancelSubscriptionResp)
};

var unsubscribeContextDelete = function (req, res) {
    res.status(200).json(data.cancelSubscriptionResp)
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

var usageSpecificationHandler = function (req, res) {
    if (req.body.name === 'call') {
        req.body['href'] = 'http://localhost:9040/usageSpecification/1';
        res.status(201).json(req.body);
    } else {
        req.body['href'] = 'http://localhost:9040/usageSpecification/2';
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
app.post('/usageSpecification', usageSpecificationHandler);
app.post('/usage', usageHandler);