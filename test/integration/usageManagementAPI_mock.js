var express = require('express'),
    bodyParser = require('body-parser');

var app = express();

exports.run = function (port) {
    app.listen(port);
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

app.use(bodyParser.json());
app.post('/usageSpecification', usageSpecificationHandler);
app.post('/usage', usageHandler);