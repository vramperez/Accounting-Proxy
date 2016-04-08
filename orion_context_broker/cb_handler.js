var request = require('request'),
    subsUrls = require('./subsUrls'),
    config = require('../config'),
    express = require('express'),
    acc_proxy = require('../server'),
    bodyParser = require('body-parser'),
    logger = require('winston'),
    async = require('async'),
    notifier = require('../notifier');

var app = express();
var db = require('../' + config.database.type);
var acc_modules = notifier.acc_modules;

/**
 * Start the endopoint to receive CB notifications.
 */
exports.run = function () {
    app.listen(app.get('port'));
};

/**
 * Handles the notification from the CB; make the accounting and notify the user.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var notificationHandler = function (req, res) {
    var requestInfo = {
        request: req,
        response: {}
    };
    var body = req.body;
    var subscriptionId = body.subscriptionId;

    db.getCBSubscription(subscriptionId, function (err, subscription) {
        if (err !== null || subscription === null) {
            logger.error('An error ocurred while making the accounting: Invalid subscriptionId');
        } else {
            // Make accounting
            acc_proxy.count(subscription.apiKey, subscription.unit, requestInfo, 'count', function (err) {
                if (err) {
                    logger.error('An error ocurred while making the accounting');
                } else {
                    var options = {
                        url: subscription.notificationUrl,
                        method: req.method,
                        json: true,
                        body: body
                    };

                    request(options, function (error, resp, body) {
                        if (error) {
                            logger.error('An error ocurred notifying the user, url: ' + options.url);
                            res.status(504).send();
                        } else {
                            res.status(resp.statusCode).send();
                        }
                    });
                }
            });
        }
    });
};

/**
 * Return the operation associated with the path passed as argument.
 *
 * @param  {string}   privatePath Path for the request.
 * @param  {Object}   req         Incoming request.
 */
exports.getOperation = function (privatePath, req, callback) {
    var operation = null;

    async.forEachOf(subsUrls, function (entry, i, task_callback) {
        if (req.method === subsUrls[i][0] && privatePath.toLowerCase().match(subsUrls[i][1])) {
            operation = subsUrls[i][2];
            task_callback();
        } else {
            task_callback();
        }
    }, function () {
        return callback(operation);
    });
};

/**
 * Auxiliar function that handles subscriptions.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {string}   unit     Accounting unit.
 * @param  {Object}   options  Context Broker request options.
 */
var subscribe = function (req, res, unit, options, callback) {
    var req_body = req.body;
    var reference_url = req_body.reference;

    req_body.reference = 'http://localhost:' + config.resources.notification_port + '/subscriptions'; // Change the notification endpoint to accounting endpoint
    options.body = req_body;

    // Send the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {
        if (err) {
            res.status(504).send();
            return callback('Error sending the subscription to the CB');
        } else if (body.subscribeResponse !== undefined) {

            var subscriptionId = body.subscribeResponse.subscriptionId;
            var duration = body.subscribeResponse.duration;
            res.status(resp.statusCode);
            async.forEachOf(resp.headers, function (header, key, task_callback) {
                res.setHeader(key, header);
                task_callback();
            }, function () {

                res.send(body);
                var apiKey = req.get('X-API-KEY');

                // Store the endpoint information of the subscriber to be notified
                db.addCBSubscription(apiKey, subscriptionId, reference_url, function (err) {
                    if (err) {
                        return callback(err);
                    } else {
                        if (acc_modules[unit].subscriptionCount !== undefined) {
                            acc_proxy.count(apiKey, unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                                if (err) {
                                    return callback(err);
                                } else {
                                    return callback(null);
                                }
                            });
                        } else {
                            return callback(null);
                        }
                    }
                });
            });
        } else {
            res.status(resp.statusCode).send(body);
            return callback(null);
        }
    });
};

/**
 * Auxiliar function that handles unsubscriptions.
 *
 * @param  {Object}   req      Incoming object.
 * @param  {Object}   res      Outgoing object.
 * @param  {Object}   options  Context Broker request options.
 */
var unsubscribe = function (req, res, options, callback) {
    var subscriptionId = '';
    if (req.method === 'POST') {
        subscriptionId = req.body.subscriptionId;
    } else if (req.method === 'DELETE') {
        var pattern = /\/(\w+)$/;
        var match = pattern.exec(req.path);
        subscriptionId = match[0];
        subscriptionId = subscriptionId.replace('/', '');
    }
    options.body = req.body;

    // Sends the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {
        if (err) {
            res.status(504).send();
            return callback('Error sending the unsubscription to the CB');
        } else {
            res.status(resp.statusCode);
            async.forEachOf(resp.headers, function (header, key, task_callback) {
                res.setHeader(key, header);
                task_callback();
            }, function () {
                if (resp.statusCode === 200) {
                    db.deleteCBSubscription(subscriptionId, function (err) {
                        if (err) {
                            res.send(body);
                            return callback(err);
                        } else {
                            res.send(body);
                            return callback(null);
                        }
                    });
                } else {
                    res.send(body);
                    return callback(null);
                }
            });
        }
    });
};

/**
 * Auxiliar function that handles subscriptions updates.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {Object}   options  Context Broker request options.
 */
var updateSubscription = function (req, res, options, callback) {
    options.body = req.body;

    request(options, function (err, resp, body) { 
        if (err) {
            res.status(504).send();
            return callback('Error sending the subscription to the CB');

        } else if (body.subscribeResponse !== undefined) {

            var subscriptionId = body.subscribeResponse.subscriptionId;
            var duration = body.subscribeResponse.duration;
            res.status(resp.statusCode);
            async.forEachOf(resp.headers, function (header, key, task_callback) {
                res.setHeader(key, header);
                task_callback();
            }, function () {

                res.send(body);
                var apiKey = req.get('X-API-KEY');

                db.getCBSubscription(subscriptionId, function (err, subscriptionInfo) {
                    if (err) {
                        return callback(err);
                    } else if (subscriptionInfo === null) {
                        return callback(null);
                    } else {
                        if (acc_modules[subscriptionInfo.unit].subscriptionCount !== undefined) {
                            acc_proxy.count(apiKey, subscriptionInfo.unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                                if (err) {
                                    return callback(err);
                                } else {
                                    return callback(null);
                                }
                            });
                        }
                    }
                });
            });
        } else {
            res.status(resp.statusCode).send(body);
            return callback(null);
        }
    });
};

/**
 * Manage the subscribe/unsubscribe Context Broker requests.
 *
 * @param  {Object}   req       Incoming request.
 * @param  {Object}   res       Outgoing response.
 * @param  {string}   url       Context-Broker url.
 * @param  {string}   operation Context Broker operation (subscribe, unsubscribe).
 */
exports.subscriptionHandler = function (req, res, url, operation, unit, callback) {
    var options = {
        url: url,
        method: req.method,
        json: true,
        headers: req.headers
    };

    switch (operation) {
        case 'subscribe':
            subscribe(req, res, unit, options, callback);
            break;
        case 'unsubscribe':
            unsubscribe(req, res, options, callback);
            break;
        case 'updateSubscription':
            updateSubscription(req, res, options, callback);
    }
};

app.use(bodyParser.json());
app.set('port', config.resources.notification_port);
app.post('/subscriptions', notificationHandler);