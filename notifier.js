var http = require('http'),
    config = require('./config'),
    request = require('request');

var db = require(config.database.type);

/**
 * Send the accounting information to the WStore.
 * 
 * @param  {string} apiKey              Identifies the product.
 * @param  {Object} notificationInfo    Information for notify the WStore.
 */
exports.notify = function(notificationInfo, callback) {
    var body = {
        customer: notificationInfo.customer,
        timestamp: (new Date()).toISOString(),
        value: notificationInfo.value,
        correlationNumber: notificationInfo.correlationNumber,
        recordType: notificationInfo.recordType,
        unit: notificationInfo.unit
    }

    db.getToken(function(err, token) {
        if (err) {
            return callback('Error obtaining the token');
        } else {
            var options = {
                url: config.WStore.url + notificationInfo.orderId + '/' + notificationInfo.productId,
                json: true,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': token
                },
                body: body
            }

            request(options, function(err, resp, body) {
                if (err) {
                    return callback('Error notifying the WStore');
                } else if (200 <= resp.statusCode && resp.statusCode <= 299 ) {
                    db.resetAccounting(notificationInfo.apiKey, function(err) {
                        if (err) {
                            return callback('Error while reseting the accounting after notify the WStore');
                        } else {
                            return callback(null);
                        }
                    });
                } else {
                    return callback('Error notifying the WStore');
                }
            });
        }
    });
};