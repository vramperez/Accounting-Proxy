var express = require('express');
var crypto = require('crypto');
var url = require('url');
var proxy = require('./server.js');
var config = require('./config');
var db = require('./db_Redis.js');

var app = express(),
    resources = {},
    offerResource = {},
    accounting_info;

app.set('port', config.accounting_proxy.store_port);

exports.run = function(d){
    accounting_info = d;
    db.loadResources(function(err, d) {
        if (err) {
            console.log('[ERROR] Error while load information from DB')
        } else {
            resources = d;
            db.loadUnits(function(err, data) {
                if (err) {
                    console.log('[ERROR] Error while load information from DB')
                } else {
                    for (var i in data) {
                        generateHash([data[i].publicPath, data[i].organization, data[i].name, data[i].version], function(err, id) {
                            if(err) {
                                console.log('[ERROR] Error generating API_KEY');
                            } else {
                                offerResource[id] = data[i].unit;
                            }
                        });
                    }
                }
            });
        }
    });
    app.listen(app.get('port'));
};

exports.resourcesHandler = function(req, res) {
    console.log("[LOG] New resource notification recieved");
    req.setEncoding('utf-8');

    var body = '';
    if (req.get('Content-Type').indexOf('application/json') > -1) { 
        req.on('data', function(d) {
            body += d;
        });

        req.on('end', function() {
            body = JSON.parse(body);
            if ( body.record_type === undefined || body.unit === undefined || 
                body.component_label === undefined || body.url === undefined ){
                    res.status(400).send();
            } else {
                var publicPath = url.parse(body.url).pathname;
                db.getService(publicPath, function(err, data) {
                    if ( data === undefined || err !== null){
                        res.status(400).send();
                    } else {
                        if (resources[publicPath] === undefined){
                            resources[publicPath] = {
                                url: data.url,
                                port: data.port
                            };
                        }

                        if (config.modules.accounting.indexOf(body.unit) === -1){
                            res.status(400).send("Unsupported accounting unit.");
                        } else {
                            // Save unit for the offerResource
                            generateHash([publicPath, body.offering.organization, body.offering.name, body.offering.version], function(err, id) {
                                if (err) {
                                    console.log('[ERROR] Error generating API_KEY');
                                } else {
                                    if (offerResource[id] === undefined){
                                        offerResource[id] = body.unit;
                                    }
                                }
                            });

                            db.addResource({
                                offering: body.offering,
                                publicPath: publicPath,
                                record_type: body.record_type,
                                unit: body.unit,
                                component_label: body.component_label
                            }, function(err) {
                                if (err) {
                                    res.status(400).send();
                                } else {
                                    res.status(201).send();
                                }
                            });
                        }
                    }
                });
            }
        });
    } else {
        res.status(415).send();
    }
};

exports.usersHandler = function(req, res){
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

            proxy.getMap(function(err, map) {
                if (err) {
                    console.log('Error getting the map');
                } else {
                    accounting_info = map;
                    db.getApiKey(user, offer, function(err, api_key) {
                        if (err) {
                            console.log('[ERROR] Error getting the api_key')
                        } else if (api_key === null) {
                            // Generate API_KEY
                            generateHash([user, offer.organization, offer.name, offer.version], function(err, id) {
                                if (err) {
                                    console.log('[ERROR] Error generating API_KEY');
                                } else {
                                    api_key = id;
                                }
                            });
                        }

                        if (accounting_info[api_key] === undefined) {
                            accounting_info[api_key] = {
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
                            generateHash([publicPath, offer.organization, offer.name, offer.version], function(err, id) {
                                if (err) {
                                    console.log('[ERROR] Error generating API_KEY');
                                } else {
                                    if (resources[publicPath] !== undefined &&
                                        offerResource[id] !== undefined &&
                                        accounting_info[api_key].accounting[publicPath] === undefined) {
                                            accounting_info[api_key].accounting[publicPath] = {
                                                url: resources[publicPath].url,
                                                port: resources[publicPath].port,
                                                num: 0,
                                                correlation_number: 0,
                                                unit: offerResource[id]
                                            };
                                    }
                                }
                            });
                        }

                        db.addInfo(api_key, accounting_info[api_key], function(err) {
                            if (err) {
                                res.status(400).send();
                            } else {
                                proxy.newBuy(api_key, accounting_info[api_key], function(err){
                                    if (err) {
                                        // Notify the error
                                    } else {
                                        res.status(201).send();
                                    }
                                });
                            }
                        });
                    });
                }
            });
        });
    } else {
        res.status(415).send();
    }
};

exports.keysHandler = function(req, res){
    var userID = req.get('X-Actor-ID');

    if (userID === undefined) {
        res.status(400).send();
    } else {
        db.getInfo(userID, function(err, data) {
            if (data === {} || err != undefined) {
                res.status(400).send();
            } else {
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
            }
        });
    }
};

generateHash = function(args, callback) {
    var string,
        counter = args.length;

    if(counter != 0) {
        for (i in args) {
            counter--;
            string += args[i];
            if (counter == 0) {
                var sha1 = crypto.createHash('sha1');
                sha1.update(string);
                var id = sha1.digest('hex');
                return callback(null, id);
            }
        }
    } else {
        return callback('Error', null);
    }
}

app.post('/api/resources', module.exports.resourcesHandler);
app.post('/api/users', module.exports.usersHandler);
app.get('/api/users/keys', module.exports.keysHandler);