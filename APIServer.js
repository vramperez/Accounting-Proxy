var express = require('express');
var crypto = require('crypto');
var mainSrv = require('./server');
var resource = require('./config').resource;
var db = require('./db.js');

var app = express(),
    router = express.Router(),
    resources = [];

app.set('port', 9001);

exports.run = function(){
    db.loadResources(function(res) {
        resources = res;
        // console.log(JSON.stringify(resources, null, 2));
        app.listen(app.get('port'));
    });
};

router.post('/users', function(req, res) {

    console.log("[LOG] WStore notification recieved.");
    req.setEncoding('utf-8');

    var body = '';

    if (req.get('Content-Type') === 'application/json') {
        req.on('data', function(data) {
            body += data;
        });
        req.on('end', function() {

            body = JSON.parse(body);

            var offer = body.offering,
                resrc = body.resources,
                user  = body.customer,
                ref   = body.reference,
                temRes = [],
                apiKey;

            db.getResources(offer.organization, offer.name, offer.version, function(data) {
                if (data) {
                    for (i in data) {
                        for (j in resrc) {
                            if (data[i].provider === resrc[j].provider &&
                                data[i].name === resrc[j].name &&
                                data[i].version === resrc[j].version) {
                                temRes.push(resrc[j]);
                            }
                        }
                    }
                } else {
                    console.log("New offer!!");
                    for (i in resources) {
                        for (j in resrc) {
                            if (resources[i].provider === resrc[j].provider &&
                                resources[i].name === resrc[j].name &&
                                resources[i].version == resrc[j].version) {
                                temRes.push(resrc[j]);
                            }
                        }
                    }
                }

                db.getApiKey(user, offer, ref, function(API_KEY) {
                    if (API_KEY === undefined){
                        var apiKeyBase = user + offer.organization + offer.name + offer.version;
                        var sha1 = crypto.createHash('sha1');
                        sha1.update(apiKeyBase);
                        apiKey = sha1.digest('hex');
                        console.log("Type: " + typeof(apiKey));
                    }
                    else
                        apiKey = API_KEY;
                    // console.log("API_KEY: " + apiKey);
                    db.addUser(user, ref, temRes, offer, apiKey);
                });

                for (var i in temRes) {
                    db.getPublicPaths(temRes[i], function(paths) {
                        mainSrv.newUser(user, apiKey, paths);
                    });
                }
            });

            res.send("API Server Woking!");
        });
    }
});

router.post('/resources', function(req, res) {

    console.log("[LOG] New resource notification recieved");
    req.setEncoding('utf-8');

    var body = '';

    if (req.get('Content-Type') === 'application/json') {
        req.on('data', function(data) {
            body += data;
        });

        req.on('end', function() {
            body = JSON.parse(body);
            // TODO: Treat new resource
            console.log(JSON.stringify(body, null, 2));
        });

        res.end();
    }
});

app.use('/api', router);
