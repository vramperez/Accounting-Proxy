/*
* Define the json in order to validate the administration requests
*/
var Joi = require('joi'),
    config = require('./config');

var schemas = {};

schemas.newBuy = {
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
    customer: Joi.string().min(1).required(),
    productSpecification: Joi.object().keys({
        url: Joi.string().min(1).required(),
        unit: Joi.any().valid(config.modules.accounting),
        recordType: Joi.string().min(1).required()
    })
};

schemas.deleteBuy = {
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
    customer: Joi.string().min(1).required(),
    productSpecification: Joi.object().keys({
        url: Joi.string().min(1).required()
    })
};

module.exports = schemas;