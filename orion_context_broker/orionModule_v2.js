var request = require('request'),
config = require('../config'),
accounter = require('../accounter'),
async = require('async'),
moment = require('moment');

var db = require('../' + config.database.type);

/**
 * Return the duration in ISO8601 format between the two dates passed as argument.
 *
 * @param  {String} date1 Date in ISO8601 format
 * @param  {String} date2 Date in ISO8601 format
 */
var getDuration = function (date1, date2) {

    var moment1 = moment(date1);
    var moment2 = moment(date2);
    var duration = moment2.diff(moment1);

    return moment.duration(duration).toISOString();
};

/**
 * Return true if newDate is after oldDate.
 * 
 * @param  {String} oldDate Date in ISO8601 format
 * @param  {[type]} newDate Date in ISO8601 format
 */
var extendSubscription = function (oldDate, newDate) {

    var now = moment(oldDate);
    var then = moment(newDate);

    return then.isAfter(now);
};

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
 * If the accounting unit is millisecond, extract the subscription duration
 * and make the accounting.
 *
 * @param  {Object}     req          Incoming request.
 * @param  {Object}     res          Outgoing response.
 * @param  {string}     unit        Accounting unit.
 * @param  {Object}     options  Context Broker request options.
 */
exports.subscribe = function (req, res, unit, options, callback) { 

    var subscription = JSON.parse(JSON.stringify(req.body)); // Save the subscription

	// Change the notification endpoint to accounting endpoint
	options.body.notification = {
		http: {
			url: 'http://localhost:' + config.resources.notification_port + '/subscriptions'
		}
	};

	// Send the request to the CB and redirect the response to the subscriber
	request(options, function (err, resp, body) {

		if (err) {
			res.status(504).send();
			return callback('Error sending the subscription to the CB');

		} else if (resp.statusCode !== 201) {
			res.status(resp.statusCode).send(body);
			return callback(null);

		} else {

			var location = resp.headers['location'];
			var subscriptionId = location.substr(location.lastIndexOf('/') + 1);
            var expires = subscription.expires;
			var duration = expires ? getDuration(moment(), expires) : null; // TODO: null --> unlimited duration
			var notificationUrl = getNotificationUrl(subscription.notification);

			res.status(resp.statusCode);

			async.forEachOf(resp.headers, function (header, key, taskCallback) {
				res.setHeader(key, header);
				taskCallback();
			}, function () {

				var apiKey = req.get("X-API-KEY");

                // Store the endpoint information of the subscriber to be notified
                db.addCBSubscription(apiKey, subscriptionId, notificationUrl, expires, function (err) {

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

                if (resp.statusCode === 204) {

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
 * Update the subscription and redirect the response to the client.
 *
 * @param  {Object}     req          Incoming request.
 * @param  {Object}     res          Outgoing response.
 * @param  {Object}     options  Context Broker request options.
 */
exports.updateSubscription = function (req, res, options, callback) {

    var subscriptionId = req.path.substr(req.path.lastIndexOf('/') + 1);
	var update = JSON.parse(JSON.stringify(req.body)); // Save the update

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

				} else if (resp.statusCode !== 204) {
					res.status(resp.statusCode).send(body);
					return callback(null);

				} else {

					res.status(resp.statusCode);
					async.forEachOf(resp.headers, function (header, key, taskCallback) {
						res.setHeader(key, header);
						taskCallback();
					}, function () {

						res.send(body);

						var notificationUrl = update.notification ? getNotificationUrl(update.notification) : undefined;
                        var expires = update.expires

						async.series([
							function (callback) {

                                // Save new notification URL
                                if (notificationUrl) {
                                    db.updateNotificationUrl(subscriptionId, notificationUrl, callback);
                                } else {
                                    callback();
                                }
                            },
                            function (callback) {

                                // Make the accounting if the subscription time is increased and save the new expiration date
                                if (expires && extendSubscription(subscriptionInfo.expires, expires)) {

                                    db.updateExpirationDate(subscriptionId, expires, function (err) {
                                        if (err) {
                                            callback(err);
                                        } else {

                                            var apiKey = req.get('X-API-KEY');
                                            var duration = getDuration(subscriptionInfo.expires, expires);

                                            accounter.count(apiKey, subscriptionInfo.unit, {request: { duration: duration}}, 'subscriptionCount', function (err) {
                                                if (err && err.code !== 'invalidFunction') {
                                                    callback(err.msg);
                                                } else {
                                                    callback(null);
                                                }
                                            });
                                        }
                                    });

                                } else {
                                    callback(null);
                                }
                            }
                        ], callback);
					});
				}
			});
		}
	});
};