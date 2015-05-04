/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last updated: 10 March 2015
 */

/* Requires */
var http = require('http');
var sql = require('./sql.backup');
var config = require('./config');
var info = require('./HTTP_Client/info.json');

/**
 * Send a request to WStore with accounting information of user.
 * @param {INTEGER}  i        [callback information]
 * @param {OBJECT}   user     [user object information]
 * @param {STRING}   userID   [user's id]
 * @param {FUNCTION} callback [callback to return request number]
 */
exports.notify = function(i, user, userID, callback) {
    if (user.requests !== 0) {
        sql.getOfferInfo(user.reference, function(data) {
            info.offering = data;
            info.customer = userID;
            info.time_stamp = (new Date()).toISOString();
            info.correlation_number = user.num;
            info.record_type = config.record_type;
            info.unit = config.unit;
            info.value = user.requests.toString();
            info.component_label = config.component_label;
            // Debug:
            // console.log(info);
            sendNotification(i, user, userID, callback)
        });
    }
    else {
        console.log('[LOG] NO request needed.');
        callback(i, userID, 0, user.correlation_number);
    }
}

/**
 * Send notification to accounting server
 * @param {INTEGER} i        [callback information]
 * @param {OBJECT}  user     [user object]
 * @param {STRING}  userID   [user's id]
 * @param {OBJECT}  body     [JSON based on 'info.json']
 */
var sendNotification = function(i, user, userID, callback) {
    // Parse info to create bodo for the post
    var body = JSON.stringify(info);
    // Configure post options
    var options = {
        host: config.accounting_host,
        port: config.accounting_port,
        path: '/api/contracting/' + body.reference + '/accounting',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length
        }
    }
    // Prepare request
    var request = http.request(options, function(res) {
        // Check response status code is valid
        // Debug:
        // if (true || ((200 <= res.statusCode) && (res.statusCode <= 299))) {
        if ((200 <= res.statusCode) && (res.statusCode <= 299)) {
            console.log('[LOG] Request WORK!');
            sql.resetRequest(user.userID, user.correlation_number+1);
            callback(i, userID, 0, user.correlation_number+1);
        }
        else  {
            console.log('[LOG] Request FAIL!');
            callback(i, userID, info.value, user.correlation_number);
        }
    });
    // Request error handler
    request.on('error', function(e) {
        console.log('[LOG] Request FAIL!');
        callback(i, userID, info.value, user.correlation_number);
    });
    // Send request
    request.write(body);
    // Finish request
    request.end();
}