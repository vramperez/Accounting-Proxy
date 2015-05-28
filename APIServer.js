var express = require('express');
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
                    apiKey = API_KEY;
                    db.addUser(user, ref, temRes, offer, API_KEY);
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

app.use('/api', router);
