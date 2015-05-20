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
                ref   = body.reference;
            db.getResources(offer.organization, offer.name, offer.version, function(data) {
                if (data) {
                    for (i in data) {
                        for (j in resrc) {
                            if (data[i].provider === resrc[j].provider &&
                                data[i].name === resrc[j].name &&
                                data[i].version === resrc[j].version) {
                                console.log('FOUND!!');
                                db.addUser(user, ref, resrc[j], offer);
                            }
                        }
                    }
                } else {
                    console.log("New offer");
                    for (i in resources) {
                        for (j in resrc) {
                            if (resources[i].provider === resrc[j].provider &&
                                resources[i].name === resrc[j].name &&
                                resources[i].version == resrc[j].version) {
                                console.log('found!!');
                                // TODO: Update DB
                            }
                        }
                    }
                }
            });
            // console.log(JSON.stringify(offer, null, 2));
            res.send("API Server Woking!");
        });
    }
});

app.post('/notifications/buyers',function(request, response, next) {
    if (request.originalUrl !== '/notifications/buyers')
        response.status(404).send('Cannot POST ' + request.originalUrl);
    else {
        var body = '';
        if (request.get('Content-Type') === 'application/json') {
            request.on('data', function(data) {
                body += data;
            });

            request.on('end', function() {
                // TODO: JSON.parse err
                body = JSON.parse(body);
                var r = body.resources;
                // Checks proxy's resource in the request resources list
                for (i in r) {
                    if (r[i].name === resource.name
                        && r[i].version === resource.version
                        && r[i].url === resource.url) {
                        console.log("[LOG] Resource OK!");
                        mainSrv.newUser(body.customer, body.customer_name, body.reference, body.offering);
                        return;
                    }
                }
                console.log("[LOG] Resource FAIL!");
            });
        }
        response.send('Server 2');
    }
});

app.use('/api', router);
