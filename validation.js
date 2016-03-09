var Joi = require('joi');
    fs = require('fs'),
    schemas = require('./schemas');

"use strict"

// Validate if the body is correct for each type of request
exports.validate = function(type, body, callback) {
    var validation_schema;

    switch(type) {
        case 'product':
            validation_schema = schemas.product;
            break;
    }
    Joi.validate(body, validation_schema, function(err, data) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
}