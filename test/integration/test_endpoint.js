var express = require('express'),
    bodyParser = require('body-parser'),
    fs = require('fs');

var app = express();

var subscriptionId = "51c0ac9ed714fb3b37d7d5a8";

exports.run = function (port) {
    app.listen(port);
};

var call_handler = function (req, res) {
    res.status(200).send();
};

var megabyte_handler =  function (req, res) {
    fs.readFile('./ejemplo.html', function (err, html) {
        res.writeHeader(200,  {"Content-Type": "text/html"});
        res.write("" + html);
        res.end();
    });
};

var subscribeContext = function (req, res) {
    res.writeHeader(200,  {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        subscribeResponse: {
            duration: "P1M",
            subscriptionId: subscriptionId
        }
    }));
    res.end();
};

var unsubscribeContext = function (req, res) {
    res.writeHeader(200,  {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        statusCode: {
            code: "200",
            reasonPhrase: "OK"
        },
        subscriptionId: subscriptionId
    }));
    res.end();
};

var unsubscribeContextDelete = function (req, res) {
    res.writeHeader(200,  {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        statusCode: {
            code: "200",
            reasonPhrase: "OK"
        },
        subscriptionId: subscriptionId
    }));
    res.end();
};

var contextEntity = function (req, res) {
    res.writeHeader(200, {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        contextElement: {
            attributes: [
                {
                    name: "temperature",
                    type: "float",
                    value: "23"
                },
                {
                    name: "pressure",
                    type: "integer",
                    value: "720"
                }
            ],
            id: "Room1",
            isPattern: "false",
            type: "Room"
        },
        statusCode: {
            code: "200",
            reasonPhrase: "OK"
        }
    }));
    res.end();
};

var contextEntities = function (req, res) {
    res.writeHeader(200, {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        contextResponses: [
        {
            contextElement: {
                attributes: [
                    {
                        name: "temperature",
                        type: "float",
                        value: "23"
                    },
                    {
                        name: "pressure",
                        type: "integer",
                        value: "720"
                    }
                ],
                id: "Room1",
                isPattern: "false",
                type: ""
            },
            statusCode: {
                code: "200",
                reasonPhrase: "OK"
            }
        },
        {
            contextElement: {
                attributes: [
                    {
                        name: "temperature",
                        type: "float",
                        value: "21"
                    },
                    {
                        name: "pressure",
                        type: "integer",
                        value: "711"
                    }
                ],
                id: "Room2",
                isPattern: "false",
                type: ""
            },
            statusCode: {
                code: "200",
                reasonPhrase: "OK"
            }
        }
    ]
    }));
    res.end();
};

var contextTypes = function (req, res) {
    res.writeHeader(200, {"Content-Type": "application/json"});
    res.write(JSON.stringify({
        statusCode: {
        code: "200",
        reasonPhrase: "OK"
        },
        types: [
            {
                attributes: [
                    "speed",
                    "fuel",
                    "temperature"
                ],
                name: "Car"
            },
            {
                attributes: [
                    "pressure",
                    "hummidity",
                    "temperature"
                ],
                name: "Room"
            }
        ]
    }));
    res.end();
};

app.use(bodyParser.json());
app.get('/rest/call*', call_handler);
app.get('/rest/megabyte*', megabyte_handler);
app.get('/v1/contextEntity/Room1', contextEntity);
app.get('/v1/contextEntities', contextEntities);
app.get('/v1/contextTypes', contextTypes);
app.post('/v1/subscribeContext', subscribeContext);
app.post('/v1/unsubscribeContext', unsubscribeContext);
app.delete('/v1/contextSubscriptions/' + subscriptionId, unsubscribeContextDelete);