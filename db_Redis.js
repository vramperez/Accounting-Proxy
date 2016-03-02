var redis = require('redis'),
    config = require('./config'),
    async = require('async');

var db = redis.createClient();

/*
* Initialize the database and creates the necessary tables.
*/
exports.init = function(callback) {
    db.select(config.database.name, function(err) {
        if (err) {
            return callback('Error selecting datbase ' + config.database.name + ': ' + err);
        } else {
            return callback(null);
        }
    });
};

/**
 * Save the token to notify the WStore.
 */
exports.addToken = function(token, callback) {
    var multi = db.multi();

    multi.del('token');
    multi.sadd(['token', token]);
    multi.exec(function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
}

/**
 * Return the token to notify the WStore.
 */
exports.getToken = function(callback) {
    db.smembers('token', function(err, token) {
        if (err) {
            return callback(err, null);
        } else {
            return callback(null, token[0]);
        }
    });
}

/**
 * Map the publicPath with the endpoint url.
 * 
 * @param  {string} publicPath      Path for the users.
 * @param  {string} url             Endpoint url.
 */
exports.newService = function(publicPath, url, callback) {
    var multi = db.multi();

    multi.hmset('services', publicPath, url);
    multi.exec(function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
}

/**
 * Return apiKeys associated with the public path passed as argument.
 * 
 * @param  {string}   publicPath Service public path.
 */
var associatedApiKeys = function(publicPath, callback) {
    db.smembers(publicPath, function(err, apiKeys) {
        if (err) {
            return callback(err, null);
        } else {
            return callback(null, apiKeys);
        }
    });
}

/**
 * Return subscriptions identifiers associated with the api-keys passed as argument.
 * 
 * @param  {Array}   apiKeys  Api-keys array.
 */
var associatedSubscriptions = function(apiKeys, callback) {
    async.each(apiKeys, function(apiKey, task_callback) {
        db.smembers(apiKey + 'subs', function(err, subscriptions) {
            if (err) {
                task_callback(err);
            } else if (subscriptions === null) { 
                task_callback(null);
            } else {
                apiKeys.push.apply(apiKeys, subscriptions);
                task_callback(null);
            }
        });
    }, function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null, apiKeys);
        }
    });
}

/**
 * Delete the service and delete on cascade all the information associated with this service.
 * 
 * @param  {string} publicPath      Public path for the users.
 */
exports.deleteService = function(publicPath, callback) {
    var multi = db.multi();

    multi.hdel('services', publicPath);
    multi.del(publicPath);
    async.waterfall([
        async.apply(associatedApiKeys, publicPath),
        associatedSubscriptions,
    ], function(err, keys) {
        if (err) {
            return callback(err);
        } else {
            async.each(keys, function(key, task_callback) {
                db.hget(key, 'customer', function(err, customer) {
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
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    multi.exec(function(err) {
                        if (err) {
                            return callback(err);
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        }
    });
}

/**
 * Return the service, the public path and the endpoint url associated with the path-
 * 
 * @param  {string} publicPath      Public path for the users.
 */
exports.getService = function(publicPath, callback) {
    db.hget('services', publicPath, function(err, url) {
        if (err) {
            return callback(err, null);
        } else if (url === null){
            return callback(null, null);
        } else {
            return callback(null, url);
        }
    });
}

/**
 * Check if the publicPath passed as argument is associated with a service (return true) or not (return false).
 * 
 * @param  {string} publicPath         Path to check.
 */
exports.checkPath = function(publicPath, callback) {
    db.hgetall('services', function(err, services) {
        if (err) {
            return callback(err, false);
        } else {
            async.forEachOf(services, function(endpoint, path, task_callback) {
                if (publicPath === path) {
                    return callback(null, true);
                } else {
                    task_callback(null);
                }
            }, function() {
                return callback(null, false);
            });
        }
    });
}

/**
 * Add the new buy information to the database.
 * 
 * @param  {object} buyInformation      Information received from the WStore.  
 */
exports.newBuy = function(buyInformation, callback) {
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
    multi.exec(function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
}

/**
 * Return the api-keys, productId and orderId associated with the user passed as argument.
 * 
 * @param  {string}   user     Customer identifier.
 */
exports.getApiKeys = function(user, callback) {
    var toReturn = [];

    db.smembers(user, function(err, apiKeys) {
        if (err) {
            return callback(err, null);
        } else if (apiKeys.length === 0) {
            return callback(null, null);
        } else {
            async.each(apiKeys, function(apiKey, task_callback) {
                db.hgetall(apiKey, function(err, accountingInfo) {
                    if (err) {
                        return task_callback(err);
                    } else {
                        toReturn.push({
                            apiKey: apiKey,
                            productId: accountingInfo.productId,
                            orderId: accountingInfo.orderId
                        });
                        task_callback(null);
                    }
                });
            }, function(err) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, toReturn);
                }
            });
        }
    });
}

/**
 * Check if the user is associated with the apiKey (return true) or not (return false).
 * 
 * @param  {string} customer    User identifier.
 * @param  {string} apiKey      Identifies the product.
 */
exports.checkRequest = function(customer, apiKey, callback) {
    db.hget(apiKey, 'customer', function(err, user) {
        if (err) {
            return callback(err, false);
        } else if (user === customer){
            return callback(null, true);
        } else {
            return callback(null, false);
        }
    });
}

/**
 * Return the url, unit and publicPath associated with the apiKey passed as argument.
 * 
 * @param  {string}   apiKey   Product identifier.
 */
exports.getAccountingInfo = function(apiKey, callback) {
    db.hgetall(apiKey, function(err, accountingInfo) {
        if (err) {
            return callback(err, null);
        } else if (accountingInfo === null) {
            return callback(null, null);
        } else {
            db.hget('services', accountingInfo.publicPath, function(err, url) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, {
                        unit: accountingInfo.unit,
                        url: url,
                        publicPath: accountingInfo.publicPath
                    });
                }
            });
        }
    });
}

/**
 * Return the necessary information to notify the WStore (accounting value).
 * 
 */
exports.getNotificationInfo = function(callback) {
    var notificationInfo = [];

    db.smembers('apiKeys', function(err, apiKeys) {
        if (err) {
            return callback(err, null);
        } else {
            async.each(apiKeys, function(apiKey, task_callback) {
                db.hgetall(apiKey, function(err, accountingInfo) {
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
            }, function(err) {
                if (err) {
                    return callback(err, null);
                } else if (notificationInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, notificationInfo);
                }
            });
        }
    });
}

/**
 * Add the amount passed as argument to the actual amount of the user
 * 
 * @param  {string} apiKey      Idenfies the product.
 * @param  {float} amount       Amount to account.
 */
exports.makeAccounting = function(apiKey, amount, callback) { 
    var multi = db.multi();

    if (amount < 0) {
        return callback('[ERROR] The aomunt must be greater than 0');
    } else {
        db.hget(apiKey, 'value', function(err, num) {
            if (err) {
                return callback(err);
            } else {
                multi.hmset(apiKey, {
                    value: parseFloat(num) + amount
                });
                multi.exec(function(err) {
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

/**
 * Reset the accounting for the product identifies by the apiKey and increment the correlation number.
 * 
 * @param  {string} apiKey      Idenfies the product.
 */
exports.resetAccounting = function(apiKey, callback) {
    var multi = db.multi();

    db.hget(apiKey, 'correlationNumber', function(err, correlationNumber) {
        if (err) {
            return callback(err);
        } else {
            multi.hmset(apiKey, {
                correlationNumber: parseInt(correlationNumber) + 1,
                value: '0'
            });
            multi.exec(function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        }
    });
}

/**
 * Add new Context Broker subscription (apiKey and notificationUrl associated).
 * 
 * @param {string} apiKey           Identifies the product.
 * @param {string} subscriptionId   Identifies the subscription.
 * @param {string} notificationUrl  Url for notifies the user when receive new notifications.
 */
exports.addCBSubscription = function(apiKey, subscriptionId, notificationUrl, callback) {
    var multi = db.multi();

    multi.sadd([apiKey + 'subs', subscriptionId]);
    multi.hmset(subscriptionId, {
        apiKey: apiKey,
        notificationUrl: notificationUrl
    });
    multi.exec(function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
}

/**
 * Return the apiKey and notification url associated with the subscriptionId.
 * 
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.getCBSubscription = function(subscriptionId, callback) {
    db.hgetall(subscriptionId, function(err, subscriptionInfo) {
        if (err) {
            return callback(err, null);
        } else if (subscriptionInfo === null) {
            return callback(null, null);
        } else {
            db.hget(subscriptionInfo.apiKey, 'unit', function(err, unit) {
                if (err) {
                    return callback(err, null);
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
}

/**
 * Delete the subscription identified by the subscriptionId. 
 * 
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.deleteCBSubscription = function(subscriptionId, callback) {
    var multi = db.multi();

    db.hget(subscriptionId, 'apiKey', function(err, apiKey) {
        if (err) {
            return callback(err);
        } else {
            multi.srem(apiKey + 'subs', subscriptionId);
            multi.del(subscriptionId);
            multi.exec(function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        }
    });
}