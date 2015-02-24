/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 24 February 2015
 */

/* Requires */
var express = require('express');

/* Create app with Express Framework */
var app = express();

app.set('port', 9001);

exports.run = function(){
    // Listening at port 9001
    app.listen(app.get('port'));
}

app.use(function(request, response, next) {
    // TODO: Treat request from WStore
    response.send('Server 2');
});