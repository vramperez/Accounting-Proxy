var request = require('request'),
    config = require('../config'),
    accounter = require('../accounter'),
    async = require('async'),
    url = require('url');

var db = require('../' + config.database.type);

/**
 * Return the notification URL contained in the notification object.
 *
 * @param  {Object} notification Notification object (part of subscriptions body).
 */
var getNotificationUrl = function (notification) {

    var notificationUrl;

    if (notification.http) {
        notificationUrl = notification.http.url;
    } else {
        notificationUrl = notification.httpCustom.url;
    }

    return notificationUrl;
};

/**
 * Save the subscription in the db and redirect the response to the user.
 *
 * @param  {Object}     req          Incoming request.
 * @param  {Object}     res          Outgoing response.
 * @param  {string}     unit        Accounting unit.
 * @param  {Object}     options  Context Broker request options.
 */
exports.subscribe = function (req, res, unit, options, callback) { 

    var subscription = JSON.parse(JSON.stringify(req.body)); // Save the subscription
    var response = {};

    // Change the notification endpoint to accounting endpoint
    options.body.notification = {
        http: {
            url: 'http://localhost:' + config.resources.notification_port + '/subscriptions'
        }
    };

    // Send the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the subscription to the CB', response);

        } else if (resp.statusCode !== 201) {
            response = {
                status: resp.statusCode,
                body: body
            };
            return callback(null, response);

        } else {

            var location = resp.headers['location'];
            var subscriptionId = location.substr(location.lastIndexOf('/') + 1);
            var notificationUrl = getNotificationUrl(subscription.notification);

            response.status = resp.statusCode;
            response.body = body;

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                var apiKey = req.get("X-API-KEY");

                // Store the endpoint information of the subscriber to be notified
                db.addCBSubscription(apiKey, subscriptionId, notificationUrl, 'v2', function (err) {

                    if (err) {
                        return callback(err, response);
                    } else {
                        return callback(null, response);
                    }
                });
            });
        }
    });
};

/**
 * Delete the subscription from the database and redirect the response
 * to the user.
 *
 * @param  {Object}     req          Incoming object.
 * @param  {Object}     res          Outgoing object.
 * @param  {Object}     options  Context Broker request options.
 */
exports.unsubscribe = function (req, res, options, callback) {

    var subscriptionId = req.path.substr(req.path.lastIndexOf('/') + 1);
    var response = {};

    // Sends the request to the CB and redirect the response to the subscriber
    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the unsubscription to the CB', response);

        } else {

            response.status = resp.statusCode;
            response.body = body;

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                if (resp.statusCode === 204) {

                    db.deleteCBSubscription(subscriptionId, function (err) {
                        if (err) {
                            return callback(err, response);
                        } else {
                            return callback(null, response);
                        }
                    });

                } else {
                    return callback(null, response);
                }
            });
        }
    });
};

/**
 * Update the subscription and redirect the response to the client.
 *
 * @param  {Object}     req          Incoming request.
 * @param  {Object}     res          Outgoing response.
 * @param  {Object}     options  Context Broker request options.
 */
exports.updateSubscription = function (req, res, options, callback) {

    var subscriptionId = req.path.substr(req.path.lastIndexOf('/') + 1);
    var update = JSON.parse(JSON.stringify(req.body)); // Save the update
    var response = {};

    request(options, function (err, resp, body) {

        if (err) {
            response = {
                status: 504,
                body: ''
            };
            return callback('Error sending the subscription to the CB', response);

        } else if (resp.statusCode !== 204) {
            response = {
                status: resp.statusCode,
                body: body
            };
            return callback(null, response);

        } else {

            response.status = resp.statusCode;
            response.body = body;
            var error = null;

            async.forEachOf(resp.headers, function (header, key, taskCallback) {
                res.setHeader(key, header);
                taskCallback();
            }, function () {

                var notificationUrl = update.notification ? getNotificationUrl(update.notification) : undefined;

                if (notificationUrl) {
                    db.updateNotificationUrl(subscriptionId, notificationUrl, function (err) {
                        error = err;
                    });
                }

                return callback(error, response);
            });
        }
    });
};

/**
 * Send the request to cancel the subscription.
 *
 * @param  {Object}    subscriptionInfo  Subscription information
 */
exports.cancelSubscription = function (subscriptionInfo, callback) {
    
    var serviceUrl = url.parse(subscriptionInfo.url);
    var cancelUrl = serviceUrl.protocol + '//' + serviceUrl.host + '/v2/subscriptions/' + subscriptionInfo.subscriptionId;

    var options = {
        url: cancelUrl,
        method: 'DELETE'
    };

    request(options, function (err, resp, body) {
        if (err || resp.statusCode != 204) {
            return callback('Error cancelling the subscription with Id: ' + subscriptionInfo.subscriptionId);
        } else {
            return callback(null);
        }
    });
};