/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last updated: 05 March 2015
 */

/* Requires */
var http = require('http');
var sql = require('./sql.backup');
var config = require('./config');
var info = require('./lib/info.json');

/**
 * Send a request to WStore with accounting information of user.
 * @param {OBJECT}   user     [user object information]
 * @param {STRING}   nickname [user nickname]
 * @param {FUNCTION} callback [callback to return request number]
 */
exports.notify = function(user, nickname, callback) {
    if (user.requests !== 0) {
        sql.getOfferInfo(user.reference, function(data) {
            info.offering = data;
            info.customer = user.userID;
            info.time_stamp = (new Date()).toISOString();
            // TODO: correlation_number
            info.record_type = config.record_type;
            info.unit = config.unit;
            info.value = user.requests.toString();
            info.component_label = config.component_label;
            // Debug:
            // console.log(info);
            sendNotification(user, nickname, callback)
        });
    }
    else {
        console.log('[LOG] NO request needed.');
        callback(nickname, 0);
    }
}

/**
 * Send notification to accounting server
 * @param {OBJECT} user     [user object]
 * @param {STRING} nickname [description]
 * @param {OBJECT} body     [JSON based on 'info.json']
 */
var sendNotification = function(user, nickname, callback) {
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
        if ((200 <= res.statusCode) && (res.statusCode <= 299)) {
            console.log('[LOG] Request WORK!');
            sql.resetRequest(user.userID);
            callback(nickname, 0);
        }
        else  {
            console.log('[LOG] Request FAIL!');
            callback(nickname, info.value);
        }
    });
    // Request error handler
    request.on('error', function(e) {
        console.log('[LOG] Request FAIL!');
        callback(nickname, info.value);
    });
    // Send request
    request.write(body);
    // Finish request
    request.end();
}