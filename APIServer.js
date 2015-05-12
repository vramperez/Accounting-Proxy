/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 06 March 2015
 */

/* Requires */
var express = require('express');
var mainSrv = require('./server');
var resource = require('./config').resource;

/* Create app with Express Framework */
var app = express();

app.set('port', 9001);

/**
 * Start server listening.
 */
exports.run = function(){
    // Listening at port 9001
    app.listen(app.get('port'));
}

app.post('/notifications/buyers',function(request, response, next) {
    if (request.originalUrl !== '/notifications/buyers')
        response.status(404).send('Cannot POST ' + request.originalUrl);
    else {
        console.log("[LOG] WStore notification recieved.");
        request.setEncoding('utf-8');
        var body = '';
        if (request.get('Content-Type') === 'application/json') {
            request.on('data', function(data) {
                body += data;
            });

            request.on('end', function() {
                // TODO: JSON.parse err
                body = JSON.parse(body);
                var r = body.resources;
                // Checks proxy's resource in the request resources list
                for (i in r) {
                    if (r[i].name === resource.name
                        && r[i].version === resource.version
                        && r[i].url === resource.url) {
                        console.log("[LOG] Resource OK!");
                        mainSrv.newUser(body.customer, body.customer_name, body.reference, body.offering);
                        return;
                    }
                }
                console.log("[LOG] Resource FAIL!");
            });
        }
        response.send('Server 2');
    }
});