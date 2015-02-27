/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 26 February 2015
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

app.use(function(request, response, next) {
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
                    mainSrv.newUser(body.customer, body.customer_name, body.reference);
                    return;
                }
            }
            console.log("[LOG] Resource FAIL!");
        });
    }
    response.send('Server 2');
});