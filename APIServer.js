var express = require('express'),
    crypto = require('crypto'),
    config = require('./config'),
    bodyParser = require('body-parser'),
    validation = require('./validation'),
    url = require('url'),
    db = require(config.database);

"use strict";

var app = express();
var logger = require('./accounting-proxy').logger;
/**
 * Intialize the server.
 */
exports.run = function() {
    app.listen(app.get('port'));
}

/**
 * Check if the url in the request body is a registered url.
 * 
 * @param  {Object} req     Incoming request.
 * @param  {Object} res     Outgoing response.
 */
var checkUrl = function(req, res) {
    req.setEncoding('utf-8');
    var body = req.body;

    if (body.url === undefined) {
        res.status(400).json({error: 'Invalid body, url undefined'});
    } else {
        if (req.get('X-API-KEY') !== undefined) { //Save the token to notify the WStore
            db.addToken(req.get('X-API-KEY'), function(err) {
                if (err) {
                    logger.error('Error saving the token in database');
                }
            });
        }
        db.checkUrl(body.url, function(err, correct) {
            if (err) {
                res.status(500).send();
            } else if (correct) {
                res.status(200).send();
            } else {
                res.status(400).json({error: 'Incorrect url ' + body.url});
            }
        });
    }
}

/**
 * Add the new buy information to the database.
 * 
 * @param  {Object} req     Incoming request. 
 * @param  {Object} res     Outgoing request.
 */
var newBuy = function(req, res) {
    req.setEncoding('utf-8');
    var body = req.body;
    
    validation.validate('product', body, function(err) { // Check if the json is correct
        if (err) {
            res.status(400).json({error: 'Invalid json'}); // More specific error? (wich field is undefined)
        } else {
            generateApiKey(body.productId, body.orderId, body.customer, function(apiKey) {
                db.newBuy({
                    apiKey: apiKey,
                    publicPath: url.parse(body.productSpecification.url).pathname,
                    orderId: body.orderId,
                    productId: body.productId,
                    customer: body.customer,
                    unit: body.productSpecification.unit,
                    recordType: body.productSpecification.recordType
                }, function(err) {
                    if (err) {
                        res.status(400).send();
                    } else {
                        res.status(201).json({'API-KEY': apiKey});
                    }
                });
            });
        }
    });
}

/**
 * Return the apiKey, productId and orderId for each product bought by the user.
 * 
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var getApiKeys = function(req, res) {
    var user = req.get('X-Actor-ID');

    if (user === undefined) {
        res.status(400).json({error: 'Undefined "X-Actor-ID" header'});
    } else {
        db.getApiKeys(user, function(err, apiKeysInfo) {
            if (err) {
                res.status(500).send();
            } else if (apiKeysInfo === null) {
                res.status(400).send();
            } else {
                res.status(200).json(apiKeysInfo);
            }
        });
    }
}

/**
 * Return the accounting units soported.
 * 
 * @param  {Object} req Incoming request.
 * @param  {Object} res Outgoing response.
 */
var getUnits = function(req, res) {
    res.status(200).json({units: config.modules.accounting});
}

/**
 * Generates an api-key based on the productId, orderId and customer passed as argument.
 * 
 * @param  {string} productId   product identifier.
 * @param  {string} orderId     order identifier.
 * @param  {string} customer    user identifier.
 */
var generateApiKey = function(productId, orderId, customer, callback) {
    var sha1 = crypto.createHash('sha1');
        
    sha1.update(productId + orderId + customer);
    var apiKey = sha1.digest('hex');
    return callback(apiKey);
}

/**
 * Check if the content-type of the request is "application/json".
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 * @param  {Function} next Next function to call.
 */
var checkIsJSON = function(req, res, next) {
    if (!req.is('application/json')) {
        res.status(415).json({error: 'Content-Type must be "application/json"'});
    } else {
        next();
    }
}

app.set('port', config.accounting_proxy.admin_port);
app.use(bodyParser.json());

app.post('/api/resources', checkIsJSON, checkUrl);
app.post('/api/users', checkIsJSON, newBuy);
app.get('/api/users/keys', getApiKeys);
app.get('/api/units', getUnits);

module.exports.app = app;