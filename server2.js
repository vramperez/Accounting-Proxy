/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 26 February 2015
 */

/* Requires */
var express = require('express');
var backup = require('./sql.backup');
var config = require('./config');

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
    // TODO: Treat request from WStore
    response.send('Server 2');
});