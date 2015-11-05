var express = require('express');
var crypto = require('crypto');
var url = require('url');
var proxy = require('./server.js');
var config = require('./config');
var db = require('./db_Redis.js');

var app = express(),
    router = express.Router(),
    resources = {},
    offerResource = {},
    map;

app.set('port', config.accounting_proxy.store_port);

exports.run = function(d){
    map = d;
    db.loadResources(function(d) {
        resources = d;
        db.loadUnits(function(data) {
            for (var i in data) {
                var offerResourceBase = data[i].publicPath + data[i].organization + data[i].name + data[i].version;
                var sha1 = crypto.createHash('sha1');
                sha1.update(offerResourceBase);
                var id = sha1.digest('hex');
                offerResource[id] = data[i].unit;
            }
        });
    });
    app.listen(app.get('port'));
};

router.post('/users', function(req, res) {

    console.log("[LOG] WStore notification recieved.");
    req.setEncoding('utf-8');

    var body = '';

    if (req.get('Content-Type').indexOf('application/json') > -1) {

        req.on('data', function(d) {
            body += d;
        });

        req.on('end', function() {

            body = JSON.parse(body);

            var offer = body.offering,
                resrc = body.resources,
                user  = body.customer,
                ref   = body.reference,
                temRes = []

            proxy.getMap(function(m) {
                map = m;
                db.getApiKey(user, offer, function(api_key) {

                    if (api_key === undefined) {
                        // Generate API_KEY
                        var apiKeyBase = user + offer.organization + offer.name + offer.version;
                        var sha1 = crypto.createHash('sha1');
                        sha1.update(apiKeyBase);
                        api_key = sha1.digest('hex');
                    }

                    if (map[api_key] === undefined) {
                        map[api_key] = {
                            actorID: user,
                            organization: offer.organization,
                            name: offer.name,
                            version: offer.version,
                            accounting: {},
                            reference: ref
                        };
                    }

                    for (var i in resrc) {
                        var publicPath = url.parse(resrc[i].url).pathname;
                        var offerResourceBase = publicPath + offer.organization + offer.name + offer.version;
                        var sha1 = crypto.createHash('sha1');
                        sha1.update(offerResourceBase);
                        var id = sha1.digest('hex');

                        if (resources[publicPath] !== undefined &&
                            offerResource[id] !== undefined &&
                            map[api_key].accounting[publicPath] === undefined) {
                            map[api_key].accounting[publicPath] = {
                                privatePath: resources[publicPath].privatePath,
                                port: resources[publicPath].port,
                                num: 0,
                                correlation_number: 0,
                                unit: offerResource[id]
                            };
                        }
                    }

                    db.addInfo(api_key, map[api_key], function(err) {
                        console.log(err)
                        if (err)
                            res.status(400).send();
                        else {
                            proxy.newBuy(api_key, map[api_key]);
                            res.status(201).send();
                        }
                    });

                });
            });
        });
    } else
        res.status(400).send();
});

router.post('/resources', function(req, res) {

    console.log("[LOG] New resource notification recieved");
    req.setEncoding('utf-8');

    var body = '';

    if (req.get('Content-Type').indexOf('application/json') > -1) {
        req.on('data', function(d) {
            body += d;
        });

        req.on('end', function() {
            body = JSON.parse(body);

            var publicPath = url.parse(body.url).pathname;

            db.getService(publicPath, function(data) {


                if (data === undefined || body.record_type === undefined ||
                    body.unit === undefined || body.component_label === undefined)
                    res.status(400).send();

                else{
                    if (resources[publicPath] === undefined) {
                        resources[publicPath] = {
                        
                            privatePath: data.privatePath,
                            port: data.port
                        };
                    }

                    if (config.modules.accounting.indexOf(body.unit) === -1)
                        res.status(400).send("Unsupported accounting unit.");

                    // Save unit for the offerResource
                    var offerResourceBase = publicPath + body.offering.organization + body.offering.name + body.offering.version;
                    var sha1 = crypto.createHash('sha1');
                    sha1.update(offerResourceBase);
                    var id = sha1.digest('hex');
                    if (offerResource[id] === undefined)
                        offerResource[id] = body.unit;

                    db.addResource({
                        offering: body.offering,
                        publicPath: publicPath,
                        record_type: body.record_type,
                        unit: body.unit,
                        component_label: body.component_label
                    }, function(err) {
                        if (err !== undefined)
                            res.status(400).send();
                        else
                            res.status(201).send();
                    });
                }
            });

        });
    } else
        res.status(415).send();
});

router.get('/users/keys', function(req, res) {
    var userID = req.get('X-Actor-ID');

    if (userID === undefined)
        res.status(400).end();

    db.getInfo(userID, function(err, data) {

        if (err || data.length === 0)
            res.status(400).end();

        var msg = [];
        for (var i in data) {
            msg.push({
                offering: {
                    organization: data[i].organization,
                    name: data[i].name,
                    version: data[i].version
                },
                API_KEY: data[i].API_KEY
            });
        }

        res.json(msg);
    });
});

app.use('/api', router);
