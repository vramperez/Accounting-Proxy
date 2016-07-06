var request = require('request'),
    subsUrls = require('./subsUrls'),
    config = require('../config'),
    express = require('express'),
    accounter = require('../accounter'),
    bodyParser = require('body-parser'),
    logger = require('winston'),
    async = require('async');

var app = express();
var db = require('../' + config.database.type);

var orionModules = {
    v1: require('./orionModule_v1'),
    v2: require('./orionModule_v2')
};

/**
 * Start the endopoint to receive CB notifications.
 */
exports.run = function () {
    app.listen(app.get('port'));
};

/**
 * Return the operation associated with the path passed as argument.
 *
 * @param  {string}   privatePath Path for the request.
 * @param  {Object}   req         Incoming request.
 */
exports.getOperation = function (privatePath, req, callback) {
    var operation = null;

    async.forEachOf(subsUrls, function (entry, i, taskCallback) {

        if (req.method === subsUrls[i][0] && privatePath.toLowerCase().match(subsUrls[i][1])) {
            operation = subsUrls[i][2];
            taskCallback();
        } else {
            taskCallback();
        }
    }, function () {

        return callback(operation);
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
exports.subscriptionHandler = function (req, res, options, operation, unit, version, callback) {

    switch (operation) {
        case 'create':
            orionModules[version].subscribe(req, res, unit, options, callback);
            break;
        case 'delete':
            orionModules[version].unsubscribe(req, res, options, callback);
            break;
        case 'update':
            orionModules[version].updateSubscription(req, res, options, callback);
    }
};

/**
 * Redirects the subscription information to the appropriate module for cancellation.
 *
 * @param  {Object}    subscriptionInfo  Subscription information for cancellation.
 */
exports.cancelSubscription = function (subscriptionInfo, callback) {
    orionModules[subscriptionInfo.version].cancelSubscription(subscriptionInfo, callback);
};

/**
 * Handles the notification from the CB; make the accounting and notify the user.
 *
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var notificationHandler = function (req, res) {
    var countInfo = {
        request: req,
        response: {}
    };
    var body = req.body;
    var subscriptionId = body.subscriptionId;

    db.getCBSubscription(subscriptionId, function (err, subscription) {

        if (err || subscription === null) {
            logger.error('An error ocurred while making the accounting: Invalid subscriptionId');
        } else {

            // Make accounting
            accounter.count(subscription.apiKey, subscription.unit, countInfo, 'count', function (err) {

                if (err) {
                    logger.error('An error ocurred while making the accounting');
                } else {

                    req.headers['content-length'] = undefined;

                    var options = {
                        url: subscription.notificationUrl,
                        method: req.method,
                        headers: req.headers,
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

app.use(bodyParser.json());
app.set('port', config.resources.notification_port);
app.use('/subscriptions', notificationHandler);