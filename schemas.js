/*
* Define the json in order to validate the administration requests
*/
var Joi = require('joi');
var schemas = {};

schemas.product = {
	orderId: Joi.string().min(1).required(),
	productId: Joi.string().min(1).required(),
	customer: Joi.string().min(1).required(),
	productSpecification: Joi.object().keys({
		url: Joi.string().min(1).required(),
		unit: Joi.string().min(1).required(),
		recordType: Joi.string().min(1).required()
	})
};

module.exports = schemas;