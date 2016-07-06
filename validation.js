var Joi = require('joi');
    fs = require('fs'),
    schemas = require('./schemas');

"use strict"

// Validate if the body is correct for each type of request
exports.validate = function(type, body, callback) {

    var validationSchema = schemas[type];

    Joi.validate(body, validationSchema, function(err, data) {
        if (err) {
            return callback(err.details[0].message);
        } else {
            return callback(null);
        }
    });
}