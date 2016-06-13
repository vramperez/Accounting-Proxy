var request = require('request'),
    config = require('../config'),
    accounter = require('../accounter'),
    async = require('async');

var db = require('../' + config.database.type);

/**
 * Save the subscription in the db and redirect the response to the user.
 * If the accounting unit is millisecond, extract the subscription duration
 * and make the accounting.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {string}   unit     Accounting unit.
 * @param  {Object}   options  Context Broker request options.
 */
exports.subscribe = function (req, res, unit, options, callback) {

    var reqBody = req.body;
    var referenceUrl = reqBody.reference;

    // Change the notification endpoint to accounting endpoint
    reqBody.reference = 'http://localhost:' + config.resources.notification_port + '/subscriptions';
    options.body = reqBody;

    // Send the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            res.status(504).send();
            return callback('Error sending the subscription to the CB');

        } else if (body.subscribeResponse) {

            var subscriptionId = body.subscribeResponse.subscriptionId;
            var duration = body.subscribeResponse.duration;
            res.status(resp.statusCode);

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                var apiKey = req.get('X-API-KEY');

                // Store the endpoint information of the subscriber to be notified
                db.addCBSubscription(apiKey, subscriptionId, referenceUrl, function (err) {

                    if (err) {
                        res.send(body);
                        return callback(err);
                    } else {

                        accounter.count(apiKey, unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                            if (err && err.code !== 'invalidFunction') {
                                res.send(body);
                                return callback(err.msg);
                            } else {
                                res.send(body);
                                return callback(null);
                            }
                        });
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
 * Delete the subscription from the database and redirect the response
 * to the user.
 *
 * @param  {Object}   req      Incoming object.
 * @param  {Object}   res      Outgoing object.
 * @param  {Object}   options  Context Broker request options.
 */
exports.unsubscribe = function (req, res, options, callback) {

    var subscriptionId = '';

    if (req.method === 'POST') {
        subscriptionId = req.body.subscriptionId;
    } else if (req.method === 'DELETE') {
        subscriptionId = req.path.substr(req.path.lastIndexOf('/') + 1);
    }

    options.body = req.body;

    // Sends the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            res.status(504).send();
            return callback('Error sending the unsubscription to the CB');

        } else {

            res.status(resp.statusCode);
            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                if (!resp.orionError) {

                    db.deleteCBSubscription(subscriptionId, function (err) {
                    	console.log(err)
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
 * Update the subscription and redirect the response to the client.
 * If the accounting unit is millisecond, the accounting value will be 
 * increased according the new subscription duration.
 *
 * @param  {Object}   req      Incoming request.
 * @param  {Object}   res      Outgoing response.
 * @param  {Object}   options  Context Broker request options.
 */
exports.updateSubscription = function (req, res, options, callback) {

    options.body = req.body;
    var subscriptionId = req.body.subscriptionId;

    db.getCBSubscription(subscriptionId, function (err, subscriptionInfo) {

        if (err) {
            return callback(err);
        } else if (!subscriptionInfo) {
            return callback('Subscription "' + subscriptionId + '" not in database.')
        } else {

            request(options, function (err, resp, body) {

                if (err) {
                    res.status(504).send();
                    return callback('Error sending the subscription to the CB');

                } else if (body.subscribeResponse) {

                    var subscriptionId = body.subscribeResponse.subscriptionId;
                    var duration = body.subscribeResponse.duration;
                    res.status(resp.statusCode);
                    async.forEachOf(resp.headers, function (header, key, taskCallback) {
                        res.setHeader(key, header);
                        taskCallback();
                    }, function () {

                        res.send(body);
                        var apiKey = req.get('X-API-KEY');

                        accounter.count(apiKey, subscriptionInfo.unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                            if (err && err.code !== 'invalidFunction') {
                                return callback(err);
                            } else {
                                return callback(null);
                            }
                        });
                    });

                } else {
                    res.status(resp.statusCode).send(body);
                    return callback(null);
                }
            });
        }
    });
};