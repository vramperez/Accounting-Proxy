var http = require('http');
var db = require('./db.js');
var info = require('./HTTP_Client/info.json');
var config = require('./config.json');

exports.notify = function(user, API_KEY, ref, num, callback) {
    // console.log(user, API_KEY, num);
    if (num === 0){
        console.log('[LOG] NO request needed.');
        callback(user, API_KEY, 0);
    } else {
        console.log('[LOG] Request needed.');
        db.getOffer(API_KEY, function(offering) {

            if (offering === undefined)
                callback(user, API_KEY, num);

            info.offering = offering;
            info.customer = user;
            info.time_stamp = (new Date()).toISOString();
            info.value = num.toString();
            // info.correlation_number = user.num;
            // info.record_type = config.record_type;
            // info.unit = config.unit;
            // info.component_label = config.component_label;

            var body = JSON.stringify(info);

            console.log(config.accounting_host, config.accounting_port);
            var options = {
                host: config.accounting_host,
                port: config.accounting_port,
                path: '/api/contracting/' + ref + '/accounting',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': body.length
                }
            };

            var request = http.request(options, function(res) {
                if (200 <= res.statusCode && res.statusCode <= 299) {
                    console.log('[LOG] Resquest worked!');
                    db.resetCount(user, API_KEY);
                    callback(user, API_KEY, 0);
                } else {
                    console.log('[LOG] Resquest failed!');
                    callback(user, API_KEY, num);
                }
            });
            request.write(body);
            request.end();
        });
    }
};

// DEPRECATED
// var sendNotification = function(i, user, userID, callback) {
//     // Parse info to create bodo for the post
//     var body = JSON.stringify(info);
//     // Configure post options
//     var options = {
//         host: config.accounting_host,
//         port: config.accounting_port,
//         path: '/api/contracting/' + body.reference + '/accounting',
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//             'Content-Length': body.length
//         }
//     };
//     // Prepare request
//     var request = http.request(options, function(res) {
//         // Check response status code is valid
//         // Debug:
//         // if (true || ((200 <= res.statusCode) && (res.statusCode <= 299))) {
//         if ((200 <= res.statusCode) && (res.statusCode <= 299)) {
//             console.log('[LOG] Request WORK!');
//             sql.resetRequest(user.userID, user.correlation_number+1);
//             callback(i, userID, 0, user.correlation_number+1);
//         }
//         else  {
//             console.log('[LOG] Request FAIL!');
//             callback(i, userID, info.value, user.correlation_number);
//         }
//     });
//     // Request error handler
//     request.on('error', function(e) {
//         console.log('[LOG] Request FAIL!');
//         callback(i, userID, info.value, user.correlation_number);
//     });
//     // Send request
//     request.write(body);
//     // Finish request
//     request.end();
// };
// DEPRECATED
// exports.notify = function(i, user, userID, callback) {
//     if (user.requests !== 0) {
//         sql.getOfferInfo(user.reference, function(data) {
//             info.offering = data;
//             info.customer = userID;
//             info.time_stamp = (new Date()).toISOString();
//             info.correlation_number = user.num;
//             info.record_type = config.record_type;
//             info.unit = config.unit;
//             info.value = user.requests.toString();
//             info.component_label = config.component_label;
//             // Debug:
//             // console.log(info);
//             sendNotification(i, user, userID, callback)
//         });
//     }
//     else {
//         callback(i, userID, 0, user.correlation_number);
//     }
// };

