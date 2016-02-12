var http = require('http'),
    config = require('./config'),
    request = require('request');

var db = require(config.database);

/**
 * Send the accounting information to the WStore.
 * 
 * @param  {string} apiKey              Identifies the product.
 * @param  {Object} notificationInfo    Information for notify the WStore.
 */
exports.notify = function(apiKey, notificationInfo) {
    var body = {
        customer: notificationInfo.customer,
        timestamp: (new Date()).toISOString(),
        value: notificationInfo.value,
        correlationNumber: notificationInfo.correlationNumber,
        recordType: notificationInfo.recordType,
        unit: notificationInfo.unit
    }
    
    var options = {
        url: config.WStore.url + '/' + notificationInfo.orderId + '/' + notificationInfo.productId,
        json: true,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length
            // Acces Token or something in the headers for the WStore pep-proxy
        },
        body: body
    }

    request(options, function(err, resp, body) {
        if (err) {
            // Log notification failed
        } else if (200 <= resp.statusCode && resp.statusCode <= 299 ) {
            db.resetAccounting(apiKey, function(err) {
                if (err) {
                    // Log resetAccounting failed
                }
            });
        } else {
            // Log notification failed
        }
    });
};