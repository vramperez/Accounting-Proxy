var redis = require('redis'),
    config = require('./config'),
    async = require('async');

var db;
var redis_host = config.database.redis_host;
var redis_port = config.database.redis_port;

db = redis.createClient({
    host: redis_host,
    port: redis_port
});

db.select(config.database.name);

/*
* Initialize the database and creates the necessary tables.
*/
exports.init = function (callback) {
    return callback(null);
};

/**
 * Save the token to notify the WStore.
 */
exports.addToken = function (token, callback) {
    var multi = db.multi();

    multi.del('token');
    multi.sadd(['token', token]);
    multi.exec(function (err) {
        if (err) {
            return callback('Error adding the acces token "' + token + '" .');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the token to notify the WStore.
 */
exports.getToken = function (callback) {
    db.smembers('token', function (err, token) {
        if (err) {
            return callback('Error getting the access token.', null);
        } else if (token.length === 0) {
            return callback(null, null);
        } else {
            return callback(null, token[0]);
        }
    });
};

/**
 * Bind the unit with the usage specification URL.
 *
 * @param {string}   unit     Accounting unit.
 * @param {string}   href     Usage specification URL.
 */
exports.addSpecificationRef = function (unit, href, callback) {
    var entry = {};
    entry[unit] = href;

    db.hmset('units', entry, function(err) {
        if (err) {
            return callback('Error adding the href specification: "' + href + '" to unit "' + unit + '" .');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the href binded to the specified. Otherwise return null.
 *
 * @param  {string}   unit     Accounting unit
 */
exports.getHref = function (unit, callback) {
    db.hget('units', unit, function (err, href) {
        if (err) {
            return callback('Error getting the href for unit "' + unit + '" .', null);
        } else {
            return callback(null, href);
        }
    });
};

/**
 * Map the publicPath with the endpoint url.
 *
 * @param  {string} publicPath      Path for the users.
 * @param  {string} url             Endpoint url.
 */
exports.newService = function (publicPath, url, appId, callback) {
    var multi = db.multi();

    multi.sadd(['services', publicPath]);
    multi.hmset(publicPath, {
        url: url,
        appId: appId
    });
    multi.exec(function (err) {
        if (err) {
            return callback('Error in database adding the new service.');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return apiKeys associated with the public path passed as argument.
 *
 * @param  {string}   publicPath Service public path.
 */
var associatedApiKeys = function (publicPath, callback) {
    db.smembers(publicPath + 'apiKeys', function (err, apiKeys) {
        if (err) {
            return callback(err, null);
        } else {
            return callback(null, apiKeys);
        }
    });
};

/**
 * Return subscriptions identifiers associated with the api-keys passed as argument.
 *
 * @param  {Array}   apiKeys  Api-keys array.
 */
var associatedSubscriptions = function (apiKeys, callback) {
    async.each(apiKeys, function (apiKey, task_callback) {
        db.smembers(apiKey + 'subs', function (err, subscriptions) {
            if (err) {
                task_callback(err);
            } else if (subscriptions === null) {
                task_callback(null);
            } else {
                apiKeys.push.apply(apiKeys, subscriptions);
                task_callback(null);
            }
        });
    }, function (err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null, apiKeys);
        }
    });
};

/**
 * Delete the service and delete on cascade all the information associated with this service.
 *
 * @param  {string} publicPath      Public path for the users.
 */
exports.deleteService = function (publicPath, callback) {
    var multi = db.multi();

    multi.srem('services', publicPath);
    multi.del(publicPath);
    multi.del(publicPath + 'apiKeys');
    multi.del(publicPath + 'admins');
    async.waterfall([
        async.apply(associatedApiKeys, publicPath),
        associatedSubscriptions,
    ], function (err, keys) {
        if (err) {
            return callback('Error in database deleting the service.');
        } else {
            async.each(keys, function (key, task_callback) {
                db.hget(key, 'customer', function (err, customer) {
                    if (err) {
                        task_callback(err);
                    } else {
                        multi.srem(customer, key);
                        multi.del(key);
                        multi.del(key + 'subs');
                        multi.srem('apiKeys', key);
                        task_callback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback('Error in database deleting the service.');
                } else {
                    multi.exec(function (err) {
                        if (err) {
                            return callback('Error in database deleting the service.');
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
 * Return the service, the public path and the endpoint url associated with the path.
 *
 * @param  {string} publicPath      Public path for the users.
 */
exports.getService = function (publicPath, callback) {
    db.hgetall(publicPath, function (err, service) {
        if (err) {
            return callback('Error in database getting the service.', null);
        } else if (service === null) {
            return callback(null, null);
        } else {
            return callback(null, service);
        }
    });
};

/**
 * Return all the registered services.
 */
exports.getAllServices = function (callback) {
    var toReturn = [];

    db.smembers('services', function (err, publicPaths) {
        if (err) {
            return callback('Error in database getting the services.', null);
        } else {
            async.each(publicPaths, function (publicPath, task_callback) {
                db.hgetall(publicPath, function (err, service) {
                    if (err) {
                        task_callback(err);
                    } else {
                        service.publicPath = publicPath;
                        toReturn.push(service);
                        task_callback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback('Error in database getting the services.', null);
                } else {
                    return callback(null, toReturn);
                }
            });
        }
    });
};

/**
 * Return the appId associated with the specified service by its public path.
 *
 * @param  {string}   publicPath Service public path.
 */
exports.getAppId = function (publicPath, callback) {
    db.hget(publicPath, 'appId', function (err, appId) {
        if (err) {
            return callback('Error in database getting the appId.', null);
        } else {
            return callback(null, appId);
        }
    });
};

/**
 * Add a new administrator.
 *
 * @param {string}   idAdmin      Administrator user name.
 */
exports.addAdmin = function (idAdmin, callback) {
    db.sadd(['admins', idAdmin], function (err) {
        if (err) {
            return callback('Error in database adding admin: "' + idAdmin + '" .');
        } else {
            return callback(null);
        }
    });
};

/**
 * Delete the specified administrator.
 *
 * @param  {string}   idAdmin  Administrator identifier.
 */
exports.deleteAdmin = function (idAdmin, callback) {
    exports.getAllServices(function (err, services) {
        if (err) {
            return callback('Error in database removing admin: "' + idAdmin + '" .');
        } else {
            async.each(services, function (service, task_callback) {
                db.srem(service.publicPath + 'admins', idAdmin, function (err) {
                    if (err) {
                        return callback('Error in database removing admin: "' + idAdmin + '" .');
                    } else {
                        task_callback();
                    }
                })
            }, function () {
                db.srem('admins', idAdmin, function (err) {
                    if (err) {
                        return callback('Error in database removing admin: "' + idAdmin + '" .');
                    } else {
                        return callback(null);
                    }
                });
            });
        }
    });
};

/**
 * Add a new administrator for the service passed as argument (publicPath).
 *
 * @param {string}   admin      Administrator user name.
 * @param {string}   publicPath Public path of the service.
 */
exports.bindAdmin = function (idAdmin, publicPath, callback) {
    exports.getService(publicPath, function (err, url) {
        if (err) {
            return callback('Error in database binding the admin to the service.');
        } else if (url === null) {
            return callback('Invalid public path.');
        } else {
            db.smembers('admins', function (err, admins) {
                if (err) {
                    return callback('Error in database binding the admin to the service.');
                } else if (admins.indexOf(idAdmin) === -1) {
                    return callback('Admin: "' + idAdmin + '" not exists. Admin must be added before binding it.');
                } else {
                    db.sadd(publicPath + 'admins', idAdmin, function (err) {
                        if (err) {
                            return callback('Error in database binding the admin to the service.');
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
 * Delete the specified admin for the specified service by its public path.
 *
 * @param  {string}   admin      Administrator user name.
 * @param  {string}   publicPath Public path of the service.
 */
exports.unbindAdmin = function (idAdmin, publicPath, callback) {
    db.srem(publicPath + 'admins', idAdmin, function (err) {
        if (err) {
            return callback('Error in database unbinding the administrator.');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return all the administrators for the service specified by its public path.
 *
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdmins = function (publicPath, callback) {
    var toReturn = []

    db.smembers(publicPath + 'admins', function (err, admins) {
        if (err) {
            return callback('Error in database getting the administrators.', null);
        } else {
            async.each(admins, function (admin, task_callback) {
                toReturn.push({idAdmin: admin});
                task_callback();
            }, function () {
                return callback(null, toReturn);
            });
        }
    });
};

/**
 * Return the endpoint url if the user is an administrator of the service; otherwise return null.
 *
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdminUrl = function (idAdmin, publicPath, callback) {
    db.smembers(publicPath + 'admins', function (err, admins) {
        if (err) {
            return callback('Error getting the admin url.', null);
        } else if (admins.indexOf(idAdmin) === -1) { // Not an admin
            return callback(null, null);
        } else {
            db.hget(publicPath, 'url', function (err, url) {
                if (err) {
                    return callback('Error getting the admin url.', null);
                } else {
                    return callback(null, url);
                }
            });
        }
    });
};

/**
 * Check if the publicPath passed as argument is associated with a service (return true) or not (return false).
 *
 * @param  {string} publicPath         Path to check.
 */
exports.checkPath = function (publicPath, callback) {
    db.smembers('services', function (err, publicPaths) {
        if (err) {
            return callback('Error checking the path.', false);
        } else if (publicPaths.indexOf(publicPath) === -1) {
            return callback(null, false);
        } else {
            return callback(null, true);
        }
    });
};

/**
 * Add the new buy information to the database.
 *
 * @param  {object} buyInformation      Information received from the WStore.
 */
exports.newBuy = function (buyInformation, callback) {
    var multi = db.multi();

    multi.sadd(['apiKeys', buyInformation.apiKey]);
    multi.sadd([buyInformation.publicPath, buyInformation.apiKey]);
    multi.sadd([buyInformation.customer, buyInformation.apiKey]);
    multi.hmset(buyInformation.apiKey, {
        publicPath: buyInformation.publicPath,
        orderId: buyInformation.orderId,
        productId: buyInformation.productId,
        customer: buyInformation.customer,
        unit: buyInformation.unit,
        value: 0,
        recordType: buyInformation.recordType,
        correlationNumber: 0
    });
    multi.exec(function (err) {
        if (err) {
            return callback('Error in database adding the new buy.');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the api-keys, productId and orderId associated with the user passed as argument.
 *
 * @param  {string}   user     Customer identifier.
 */
exports.getApiKeys = function (user, callback) {
    var toReturn = [];

    db.smembers(user, function (err, apiKeys) {
        if (err) {
            return callback('Error in databse getting api-keys.', null);
        } else if (apiKeys.length === 0) {
            return callback(null, null);
        } else {
            async.each(apiKeys, function (apiKey, task_callback) {
                db.hgetall(apiKey, function (err, accountingInfo) {
                    if (err) {
                        return task_callback('Error in databse getting api-keys.');
                    } else {
                        toReturn.push({
                            apiKey: apiKey,
                            productId: accountingInfo.productId,
                            orderId: accountingInfo.orderId
                        });
                        task_callback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback('Error in databse getting api-keys.', null);
                } else {
                    return callback(null, toReturn);
                }
            });
        }
    });
};

/**
 * Check if the user is associated with the apiKey (return true) or not (return false).
 *
 * @param  {string} customer    User identifier.
 * @param  {string} apiKey      Identifies the product.
 */
exports.checkRequest = function (customer, apiKey, publicPath, callback) {
    db.hgetall(apiKey, function (err, accountingInfo) {
        if (err) {
            return callback('Error in database checking the request.', false);
        } else if (accountingInfo === null) {
            return callback(null, false);
        } else {
            return callback(null, accountingInfo.customer === customer &&
                accountingInfo.publicPath === publicPath);
        }
    });
};

/**
 * Return the url, unit and publicPath associated with the apiKey passed as argument.
 *
 * @param  {string}   apiKey   Product identifier.
 */
exports.getAccountingInfo = function (apiKey, callback) {
    db.hgetall(apiKey, function (err, accountingInfo) {
        if (err) {
            return callback('Error in database getting the accounting info.', null);
        } else if (accountingInfo === null) {
            return callback(null, null);
        } else {
            db.hget(accountingInfo.publicPath, 'url', function (err, url) {
                if (err) {
                    return callback('Error in database getting the accounting info.', null);
                } else {
                    return callback(null, {
                        unit: accountingInfo.unit,
                        url: url
                    });
                }
            });
        }
    });
};

/**
 * Return the necessary information to notify the WStore (accounting value).
 *
 */
exports.getNotificationInfo = function (callback) {
    var notificationInfo = [];

    db.smembers('apiKeys', function (err, apiKeys) {
        if (err) {
            return callback('Error in database getting the notification information.', null);
        } else {
            async.each(apiKeys, function (apiKey, task_callback) {
                db.hgetall(apiKey, function (err, accountingInfo) {
                    if (err) {
                        task_callback(err);
                    } else if (parseFloat(accountingInfo.value) === 0) {
                        task_callback(null);
                    } else {
                        notificationInfo.push({
                            apiKey: apiKey,
                            orderId: accountingInfo.orderId,
                            productId: accountingInfo.productId,
                            customer: accountingInfo.customer,
                            value: accountingInfo.value,
                            correlationNumber: accountingInfo.correlationNumber,
                            recordType: accountingInfo.recordType,
                            unit: accountingInfo.unit
                        });
                        task_callback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback('Error in database getting the notification information.', null);
                } else if (notificationInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, notificationInfo);
                }
            });
        }
    });
};

/**
 * Add the amount passed as argument to the actual amount of the user
 *
 * @param  {string} apiKey      Idenfies the product.
 * @param  {float} amount       Amount to account.
 */
exports.makeAccounting = function (apiKey, amount, callback) {
    var multi = db.multi();

    if (amount < 0) {
        return callback('The aomunt must be greater than 0.');
    } else {
        db.hget(apiKey, 'value', function (err, num) {
            if (err) {
                return callback('Error making the accounting.');
            } else {
                multi.hmset(apiKey, {
                    value: parseFloat(num) + amount
                });
                multi.exec(function (err) {
                    if (err) {
                        return callback('Error making the accounting.');
                    } else {
                        return callback(null);
                    }
                });
            }
        });
    }
};

/**
 * Reset the accounting for the product identifies by the apiKey and increment the correlation number.
 *
 * @param  {string} apiKey      Idenfies the product.
 */
exports.resetAccounting = function (apiKey, callback) {
    var multi = db.multi();

    db.hget(apiKey, 'correlationNumber', function (err, correlationNumber) {
        if (err) {
            return callback('Error reseting the accounting.');
        } else {
            multi.hmset(apiKey, {
                correlationNumber: parseInt(correlationNumber) + 1,
                value: '0'
            });
            multi.exec(function (err) {
                if (err) {
                    return callback('Error reseting the accounting.');
                } else {
                    return callback(null);
                }
            });
        }
    });
};

/**
 * Add new Context Broker subscription (apiKey and notificationUrl associated).
 *
 * @param {string} apiKey           Identifies the product.
 * @param {string} subscriptionId   Identifies the subscription.
 * @param {string} notificationUrl  Url for notifies the user when receive new notifications.
 */
exports.addCBSubscription = function (apiKey, subscriptionId, notificationUrl, callback) {
    var multi = db.multi();

    multi.sadd([apiKey + 'subs', subscriptionId]);
    multi.hmset(subscriptionId, {
        apiKey: apiKey,
        notificationUrl: notificationUrl
    });
    multi.exec(function (err) {
        if (err) {
            return callback('Error in database adding the subscription "' + subscriptionId + '" .');
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the apiKey and notification url associated with the subscriptionId.
 *
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.getCBSubscription = function (subscriptionId, callback) {
    db.hgetall(subscriptionId, function (err, subscriptionInfo) {
        if (err) {
            return callback('Error getting the subscription.', null);
        } else if (subscriptionInfo === null) {
            return callback(null, null);
        } else {
            db.hget(subscriptionInfo.apiKey, 'unit', function (err, unit) {
                if (err) {
                    return callback('Error getting the subscription.', null);
                } else {
                    return callback(null, {
                        apiKey: subscriptionInfo.apiKey,
                        notificationUrl: subscriptionInfo.notificationUrl,
                        unit: unit
                    });
                }
            });
        }
    });
};

/**
 * Delete the subscription identified by the subscriptionId.
 *
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.deleteCBSubscription = function (subscriptionId, callback) {
    var multi = db.multi();

    db.hget(subscriptionId, 'apiKey', function (err, apiKey) {
        if (err) {
            return callback('Error deleting the subscription "' + subscriptionId + '" .');
        } else {
            multi.srem(apiKey + 'subs', subscriptionId);
            multi.del(subscriptionId);
            multi.exec(function (err) {
                if (err) {
                    return callback('Error deleting the subscription "' + subscriptionId + '" .');
                } else {
                    return callback(null);
                }
            });
        }
    });
};