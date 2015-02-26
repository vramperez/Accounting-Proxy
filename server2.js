/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 26 February 2015
 */

/* Requires */
var express = require('express');
var mainSrv = require('./server');

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
            body = JSON.parse(body);
            mainSrv.newUser(body.customer, body.customer_name);
        });
    }
    response.send('Server 2');
});