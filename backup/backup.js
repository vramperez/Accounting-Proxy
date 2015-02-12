/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 12 February 2015
 */

/* Requieres */
var fs = require('fs');

/* Variables */
var requests = [];
var backupFileName = 'requests.backup';

/**
 * Save a request in the requests' list
 * @param user          [description]
 * @param options       [description]
 * @param body          [description]
 * @param timeStamp     [description]
 * @return {request}    [Request object generated]
 */
exports.saveRequest = function(user, options, body, timeStamp) {
    // Create request object
    var req = {};
    req.user = user;
    req.options = options;
    req.body = body;
    req.timeStamp = timeStamp;
    // Add request to requests' list
    requests.push(req);
    // Truncate file
    fs.truncate(backupFileName)
    // Re-write file
    fs.writeFile(backupFileName, JSON.stringify(requests));
    // console.log('[LOG] Request saved');
    return req;
}

/**
 * Delete a request
 * @param req           [Request to delete]
 */
exports.deleteReq = function(req) {
    var index = requests.indexOf(req);
    if (index != -1) {
        requests.splice(index, 1);
        // Truncate file
        fs.truncate(backupFileName)
        // Re-write file
        fs.writeFile(backupFileName, JSON.stringify(requests));
    }
    else
        // TODO: Manage error
        console.log("Not found!!");
};