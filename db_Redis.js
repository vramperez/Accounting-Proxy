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
 * @param  {string} publicPath      Service public path.
 * @param  {string} url             Endpoint url.
 * @param  {list}   methodsList     List of http service methods.
 */
exports.newService = function (publicPath, url, appId, isCBService, methodsList, callback) {
    var methods = methodsList.join(',').toUpperCase();
    var multi = db.multi();

    multi.sadd(['services', publicPath]);
    multi.hmset(publicPath, {
        url: url,
        appId: appId,
        isCBService: isCBService ? 1 : 0,
        methods: methods
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
    async.each(apiKeys, function (apiKey, taskCallback) {
        db.smembers(apiKey + 'subs', function (err, subscriptions) {
            if (err) {
                taskCallback(err);
            } else if (!subscriptions) {
                taskCallback(null);
            } else {
                apiKeys.push.apply(apiKeys, subscriptions);
                taskCallback(null);
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
            async.each(keys, function (key, taskCallback) {
                db.hget(key, 'customer', function (err, customer) {
                    if (err) {
                        taskCallback(err);
                    } else {
                        multi.srem(customer, key);
                        multi.del(key);
                        multi.del(key + 'subs');
                        multi.srem('apiKeys', key);
                        taskCallback(null);
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
        } else if (!service) {
            return callback(null, null);
        } else {
            service.isCBService = parseInt(service.isCBService);
            service.methods = service.methods.split(',');
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
            async.each(publicPaths, function (publicPath, taskCallback) {
                db.hgetall(publicPath, function (err, service) {
                    if (err) {
                        taskCallback(err);
                    } else {
                        service.publicPath = publicPath;
                        service.isCBService = parseInt(service.isCBService);
                        service.methods = service.methods.split(',');
                        toReturn.push(service);
                        taskCallback(null);
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
 * Returns true if the service is a Context Broker service. Otherwise returns false.
 *
 * @param  {string}    publicPath  The public path of the service.
 */
exports.isCBService = function (publicPath, callback) {
    db.hget(publicPath, 'isCBService', function (err, isCBService) {
        if (err) {
            return callback('Error in database gettings the service type.', null);
        } else {

            var result = parseInt(isCBService) === 0 ? false : true;

            return callback(null, result);
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
            async.each(services, function (service, taskCallback) {
                db.srem(service.publicPath + 'admins', idAdmin, function (err) {
                    if (err) {
                        taskCallback('Error in database removing admin: "' + idAdmin + '" .');
                    } else {
                        taskCallback();
                    }
                })
            }, function (err) {
                if (err) {
                    return callback(err);
                } else {
                    db.srem('admins', idAdmin, function (err) {
                        if (err) {
                            return callback('Error in database removing admin: "' + idAdmin + '" .');
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
 * Add a new administrator for the service passed as argument (publicPath).
 *
 * @param {string}   admin      Administrator user name.
 * @param {string}   publicPath Public path of the service.
 */
exports.bindAdmin = function (idAdmin, publicPath, callback) {
    exports.getService(publicPath, function (err, url) {
        if (err) {
            return callback('Error in database binding the admin to the service.');
        } else if (!url) {
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
            return callback('Error in database unbinding the administrator "' + idAdmin + '".');
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
    db.smembers(publicPath + 'admins', function (err, admins) {
        if (err) {
            return callback('Error in database getting the administrators.', null);
        } else {
            return callback(null, admins);
        }
    });
};

/**
 * Return the endpoint url if the user is an administrator of the service; otherwise return null.
 *
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Public path of the service.
 * @param  {string}   method     Http method.
 */
exports.getAdminURL = function (idAdmin, publicPath, method, callback) {
    db.smembers(publicPath + 'admins', function (err, admins) {
        if (err) {
            return callback('Error getting the admin url.', null);
        } else if (admins.indexOf(idAdmin) === -1) { // Not an admin
            return callback(null, {isAdmin: false, errorCode: 'admin', url: null});
        } else {
            db.hgetall(publicPath, function (err, service) {
                if (err) {
                    return callback('Error getting the admin url.', null);
                } else {

                    var methodsList = service.methods.split(',');

                    if (methodsList.indexOf(method) == -1) {
                        return callback(null, {isAdmin: true, errorCode: 'method', url: null, errorMsg: 'Valid methods are: ' + methodsList});
                    } else {
                        return callback(null, {isAdmin: true, errorCode: 'ok', url: service.url});
                    }
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
 * Deletes all the accounting information associated with the API key passed as argument.
 *
 * @param      {string}    apiKey    The API key.
 */
exports.deleteBuy = function (apiKey, callback) {
    var multi = db.multi();

    db.hgetall(apiKey, function (err, accountingInfo) {
        if (err) {
            return callback('Error deleting the API key.');
        } else {
            multi.srem(accountingInfo.publicPath, apiKey);
            multi.srem(accountingInfo.customer, apiKey);
            multi.srem('apiKeys', apiKey);
            multi.del(apiKey);

            // Delete subscriptions associated with the API key
            db.smembers(apiKey + 'subs', function (err, subscriptions) {
                if (err) {
                    return callback('Error deleting the API key.');
                } else {
                    async.each(subscriptions, function (subsId, taskCallback) {
                        multi.del(subsId);
                        taskCallback();
                    }, function () {

                        multi.del(apiKey + 'subs');
                        multi.exec(function (err) {
                            if (err) {
                                return callback('Error deleting the API key.');
                            } else {
                                return callback(null);
                            }
                        });
                    })
                }
            });
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
        } else {
            async.each(apiKeys.sort(), function (apiKey, taskCallback) {
                db.hgetall(apiKey, function (err, accountingInfo) {
                    if (err) {
                        return taskCallback('Error in databse getting api-keys.');
                    } else {
                        toReturn.push({
                            apiKey: apiKey,
                            productId: accountingInfo.productId,
                            orderId: accountingInfo.orderId
                        });
                        taskCallback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback(err, null);
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
 * @param  {string} method      Http method.
 */
exports.checkRequest = function (customer, apiKey, publicPath, method, callback) {
    db.hgetall(apiKey, function (err, accountingInfo) {

        if (err) {
            return callback('Error in database checking the request.', null);
        } else if (!accountingInfo || !(accountingInfo.customer === customer && accountingInfo.publicPath === publicPath)) {
            return callback(null, {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Invalid API key'});
        } else {

            db.hget(publicPath, 'methods', function (err, methods) {
                if (err) {
                    return callback('Error in database checking the request.', null);
                } else {

                    var methodsList = methods.split(',');

                    if (methodsList.indexOf(method) == -1){
                        return callback(null, {isCorrect: false, errorCode: 'method', errorMsg: 'Valid methods are: ' + methods});
                    } else {
                        return callback(null, {isCorrect: true});
                    }
                }
            })
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
exports.getAllNotificationInfo = function (callback) {
    var notificationInfo = [];

    db.smembers('apiKeys', function (err, apiKeys) {
        if (err) {
            return callback('Error in database getting the notification information.', null);
        } else {
            async.each(apiKeys, function (apiKey, taskCallback) {
                db.hgetall(apiKey, function (err, accountingInfo) {
                    if (err) {
                        taskCallback(err);
                    } else if (parseFloat(accountingInfo.value) === 0) {
                        taskCallback(null);
                    } else {
                        accountingInfo.apiKey = apiKey;
                        notificationInfo.push(accountingInfo);
                        taskCallback(null);
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
 * Returns the accounting information associated with the API key passed as argument.
 *
 */
exports.getNotificationInfo = function (apiKey, callback) {
    db.hgetall(apiKey, function (err, accountingInfo) {
        if (err) {
            return callback('Error in database getting the notification information.', null);
        } else if (parseFloat(accountingInfo.value) === 0) {
            return callback(null, null);
        } else {
            accountingInfo.apiKey = apiKey;
            return callback(null, accountingInfo);
        }
    });
};

/**
 * Add the amount passed as argument to the actual amount of the user
 *
 * @param  {string} apiKey      Idenfies the product.
 * @param  {float}  amount      Amount to account.
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
 * @param {string} expires          Subscription expiration date (ISO8601).
 */
exports.addCBSubscription = function (apiKey, subscriptionId, notificationUrl, expires, version, callback) {
    var multi = db.multi();

    multi.sadd([apiKey + 'subs', subscriptionId]);
    multi.hmset(subscriptionId, {
        apiKey: apiKey,
        notificationUrl: notificationUrl,
        expires: expires,
        version: version
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
        } else if (!subscriptionInfo) {
            return callback(null, null);
        } else {
            db.hgetall(subscriptionInfo.apiKey, function (err, accounting) {
                if (err) {
                    return callback('Error getting the subscription.', null);
                } else {
                    db.hget(accounting.publicPath, 'url', function (err, url) {
                        if (err) {
                            return callback('Error getting the subscription.', null);
                        } else {
                            return callback(null, {
                                apiKey: subscriptionInfo.apiKey,
                                notificationUrl: subscriptionInfo.notificationUrl,
                                expires: subscriptionInfo.expires,
                                unit: accounting.unit,
                                subscriptionId: subscriptionId,
                                version: subscriptionInfo.version,
                                url: url
                            });
                        }
                    });
                }
            });
        }
    });
};

/**
 * Returns the subscription information of all subscriptions associated with the API key.
 *
 * @param      {string}    apiKey    API key.
 */
exports.getCBSubscriptions = function (apiKey, callback) {
    var subscriptions = [];

    db.smembers(apiKey + 'subs', function (err, subscriptionIds) {
        if (err) {
            return callback('Error in database getting the subscriptions.', null);
        } else {
            async.each(subscriptionIds, function (subscriptionId, taskCallback) {
                db.hgetall(subscriptionId, function (err, subscriptionInfo) {
                    if (err) {
                        taskCallback(err);
                    } else if (!subscriptionInfo){
                        taskCallback(null);
                    } else {
                        subscriptionInfo.subscriptionId = subscriptionId;
                        subscriptions.push(subscriptionInfo);
                        taskCallback(null);
                    }
                });
            }, function (err) {
                if (err) {
                    return callback('Error in database getting the subscriptions.', null);
                } else if (subscriptions.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, subscriptions);
                }
            });
        }
    });
};

/**
 * Replace the notification URL with the URL passed as argument.
 *
 * @param  {String}   subscriptionId  Subscription identifier.
 * @param  {String}   notificationUrl New notification URL.
 */
exports.updateNotificationUrl = function (subscriptionId, notificationUrl, callback) {
    db.hmset(subscriptionId, {
        notificationUrl: notificationUrl
    }, function (err) {
        if (err) {
            return callback('Error in database updating the notificationURL.');
        } else {
            return callback(null);
        }
    });
};

/**
 * Replace the expiration date with the new expiration date passed as argument.
 *
 * @param  {String}   subscriptionId  Subscription identifier.
 * @param  {String}   expires         New expiration date (ISO8601).
 */
exports.updateExpirationDate = function (subscriptionId, expires, callback) {
    db.hmset(subscriptionId, {
        expires: expires
    }, function (err) {
        if (err) {
            return callback('Error in database updating the expiration date.');
        } else {
            return callback(null);
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