var config = require('./config'),
    async = require('async'),
    request = require('request'),
    logger = require('winston');

var db = require(config.database.type);

/**
 * Send the usage specification for the unit passed to the Usage Managament API.
 *
 * @param  {string}   unit     Accounting unit.
 */
var sendSpecification = function (token, unit, callback) {
    var accountingModules = require('./server').getAccountingModules();

    if (accountingModules[unit].getSpecification === undefined) {
        return callback('Error, function getSpecification undefined for unit ' + unit);
    } else {

        var specification = accountingModules[unit].getSpecification();

        if (specification === undefined) {
            return callback('Error, specification no available for unit ' + unit);

        } else {

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + 
                config.usageAPI.port + config.usageAPI.path + '/usageSpecification',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: specification
            };

            logger.info('Sending specification for unit: ' + unit);
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error sending the Specification: ' + err.code);

                } else if (resp.statusCode !== 201) {

                    return callback('Error, ' + resp.statusCode + ' ' + resp.statusMessage);

                } else {

                    db.addSpecificationRef(unit, body.href, function (err) {
                        if (err) {
                            return callback(err);
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        }
    }
};

/**
 * Send the accounting information to the usage API.
 *
 * @param  {Object}   accInfo  Accounting information to notify.
 */
var sendUsage = function (token, accInfo, callback) {

    logger.info('Notifying the accounting...');

    db.getHref(accInfo.unit, function (err, href) {

        if (err) {
            return callback(err);
        } else {

            var body = {
                date: (new Date()).toISOString(),
                type: accInfo.recordType,
                status: 'Received',
                usageSpecification: {
                    href: href,
                    name: accInfo.unit
                },
                usageCharacteristic: [
                {
                    name: 'orderId',
                    value: accInfo.orderId
                }, {
                    name: 'productId',
                    value: accInfo.productId
                }, {
                    name: 'correlationNumber',
                    value: accInfo.correlationNumber
                }, {
                    name: 'unit',
                    value: accInfo.unit
                }, {
                    name: 'value',
                    value: accInfo.value
                }
                ],
                relatedParty: [{
                    role: 'customer',
                    id: accInfo.customer,
                    href: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port +
                    '/partyManagement/individual/' + accInfo.customer
                }]
            };

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + config.usageAPI.port + config.usageAPI.path + '/usage',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: body
            };

            // Notify usage to the Usage Management API
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error notifying usage to the Usage Management API: ' + err.code);
                } else if (resp.statusCode !== 201){
                    return callback('Error notifying usage to the Usage Management API: ' + resp.statusCode + ' ' + resp.statusMessage);
                } else {

                    db.resetAccounting(accInfo.apiKey, function (err) {
                        if (err) {
                            return callback('Error while reseting the accounting after notify the usage');
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        }
    });
};

/**
 * Notify the usage specification for all the accounting units supported by the proxy.
 *
 */
var notifyUsageSpecification = function (token, callback) {
    var units = config.modules.accounting;

    async.each(units, function (unit, taskCallback) {

        db.getHref(unit, function (err, href) {
            if (err) {
                taskCallback(err);
            } else if (href !== null) {
                taskCallback(null);
            } else {
                sendSpecification(token, unit, taskCallback);
            }
        });
    }, callback);
};

/**
 * Notify the accounting value.
 *
 */
var notifyAllUsage = function (callback) {

    db.getToken(function (err, token) {
        if (err) {
            return callback(err);
        } else if (!token) {
            return callback(null);
        } else {

            db.getAllNotificationInfo(function (err, notificationInfo) {
                if (err) {
                    return callback(err);
                } else if (!notificationInfo) { // no info to notify
                    return callback(null);
                } else {

                    // First, Notify the usage specifications
                    notifyUsageSpecification(token, function (err) {

                        if (err) {
                            return callback(err);

                        } else {
                            // Then, notify the usage
                            async.each(notificationInfo, function (info, taskCallback) {
                                sendUsage(token, info, function (err) {
                                    if (err) {
                                        taskCallback(err);
                                    } else {
                                        taskCallback(null);
                                    }
                                });
                            }, callback);
                        }
                    });
                }
            });
        }
    });
};

/**
 * Notifies the accounting information for the API key passed as argument.
 *
 * @param      {string}    apiKey    API key.
 */
var notifyUsage = function (apiKey, callback) {

    db.getToken(function (err, token) {
        if (err) {
            return callback(err);
        } else if (!token) {
            return callback('There is no available token.');
        } else {

            db.getNotificationInfo(apiKey, function (err, notificationInfo) {
                if (err) {
                    return callback(err);
                } else if (!notificationInfo) {
                    return callback(null); // There is no accounting info to notify
                } else {

                    notifyUsageSpecification(token, function (err) {
                        if (err) {
                            return callback(err);
                        } else {

                            sendUsage(token, notificationInfo, function (err) {
                                if (err) {
                                    return callback(err);
                                } else {
                                    return callback(null);
                                }
                            })
                        }
                    });
                }
            });
        }
    });
};

exports.notifyAllUsage = notifyAllUsage;
exports.notifyUsage = notifyUsage;