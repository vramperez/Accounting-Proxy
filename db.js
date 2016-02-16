var sqlite = require('sqlite3').verbose(), // Debug enable
    TransactionDatabase = require('sqlite3-transactions').TransactionDatabase,
    config = require('./config');

"use strict"

var db = new TransactionDatabase (
        new sqlite.Database(config.database_name, sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE)
);

/*
* Initialize the database and creates the necessary tables.
*/
exports.init = function() {
    db.serialize(function() {
        db.run('PRAGMA encoding = "UTF-8";');
        db.run('PRAGMA foreign_keys = 1;');

        db.run('CREATE TABLE IF NOT EXISTS services ( \
                    publicPath      TEXT, \
                    url             TEXT, \
                    PRIMARY KEY (publicPath) \
        )');

        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    apiKey              TEXT, \
                    publicPath          TEXT, \
                    orderId             TEXT, \
                    productId           TEXT, \
                    customer            TEXT, \
                    unit                TEXT, \
                    value               TEXT, \
                    recordType          TEXT, \
                    correlationNumber   TEXT, \
                    PRIMARY KEY (apiKey), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) \
        )');

        db.run('CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) \
        )');
    });
};

/**
 * Map the publicPath with the endpoint url.
 * 
 * @param  {string} publicPath      Path for the users.
 * @param  {string} url             Endpoint url.
 */
exports.newService = function(publicPath, url, callback) {
    db.run('INSERT OR REPLACE INTO services \
            VALUES ($path, $url)',
        {
            $path: publicPath,
            $url: url
        }, function(err) {
            if (err) {
                return callback(err);
            } else {
                return callback(null);
            }
    });
};

/**
 * Delete the service.
 * 
 * @param  {string} publicPath      Public path for the users.
 */
exports.deleteService = function(publicPath, callback) {
    db.run('DELETE FROM services \
            WHERE publicPath=$path',
        {
         $path: publicPath
        }, function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
};

/**
 * Return the service, the public path and the endpoint url associated with the path-
 * 
 * @param  {string} publicPath      Public path for the users.
 */
exports.getService = function(publicPath, callback) {
    db.all('SELECT url \
            FROM services \
            WHERE publicPath=$path', {
                $path: publicPath
            }, function(err, service) {
                if (err) {
                    return callback(err, null);
                } else if (service.length ===  0){
                    return callback(null, null);
                } else {
                    return callback(null, service[0].url);
                }
    });
}

/**
 * Check if the url passed as argument is associated with a service (return true) or not (return false).
 * 
 * @param  {string} url         Url to check.
 */
exports.checkUrl = function(url, callback) {
    db.all('SELECT * \
            FROM services \
            WHERE url=$url', {
                $url: url
            }, function(err, services) {
                if (err) {
                    return callback(err, false);
                } else if (services.length === 0) {
                    return callback(null, false);
                } else {
                    return callback(null, true);
                }
    });
}

/**
 * Add the new buy information to the database.
 * 
 * @param  {object} buyInformation      Information received from the WStore.  
 */
exports.newBuy = function(buyInformation, callback) {
    db.serialize(function() {
        db.run('INSERT OR REPLACE INTO accounting \
                VALUES ($apiKey, $publicPath, $orderId, $productId, $customer, $unit, $value, $recordType, $correlationNumber)',
                {
                    $apiKey: buyInformation.apiKey,
                    $publicPath: buyInformation.publicPath,
                    $orderId: buyInformation.orderId,
                    $productId: buyInformation.productId,
                    $customer: buyInformation.customer,
                    $unit: buyInformation.unit,
                    $value: 0,
                    $recordType: buyInformation.recordType,
                    $correlationNumber: 0
                }, function(err) {
                    if (err) {
                        return callback(err);
                    } else {
                        return callback(null);
                    }
        });
    });
}

/**
 * Return the api-keys, productId and orderId associated with the user passed as argument.
 * 
 * @param  {string}   user     Customer identifier.
 */
exports.getApiKeys = function(user, callback) {
    db.all('SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user',
            {
                $user: user
            }, function(err, apiKeys) {
                if (err) {
                    return callback(err, null);
                } else if (apiKeys.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, apiKeys);
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
    db.all('SELECT customer \
            FROM accounting \
            WHERE apiKey=$apiKey',
            {
                $apiKey: apiKey
            }, function(err, user) {
                if (err) {
                    return callback(err, false);
                } else if (user.length === 0) {
                    return callback(null, false);
                } else if (user[0].customer !== customer) {
                    return callback(null, false);
                } else {
                    return callback(null, true);
                }
    });
}

/**
 * Return the url, unit and publicPath associated with the apiKey passed as argument.
 * 
 * @param  {string}   apiKey   Product identifier.
 */
exports.getAccountingInfo = function(apiKey, callback) {
    db.all('SELECT accounting.unit, services.url, accounting.publicPath \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey', 
            {
                $apiKey: apiKey
            }, function(err, accountingInfo) {
                if (err) {
                    return callback(err, null);
                } else if (accountingInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, accountingInfo[0]);
                }
    });
}

/**
 * Return the necessary information to notify the WStore (accounting value).
 * 
 */
exports.getNotificationInfo = function(callback) {
    db.all('SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0', 
            function(err, notificationInfo) {
                if (err) {
                    return callback(err, null);
                } else if (notificationInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, notificationInfo);
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
    if (amount < 0) {
        return calback('[ERROR] The aomunt must be greater than 0');
    } else {
        db.beginTransaction(function(err, transaction) {
            if (err) {
                return callback(err);
            } else {
                transaction.run(
                    'UPDATE accounting \
                    SET value=value+$amount \
                    WHERE apiKey=$apiKey',
                    {
                        $apiKey: apiKey,
                        $amount: amount
                    }, function(err) {
                        if (err) {
                            transaction.rollback();
                            return callback(err);
                        } else {
                            transaction.commit(function (error) {
                                return callback(error);
                            });
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
    db.beginTransaction(function(err, transaction) {
        if (err) {
            return callback(err);
        } else {
            transaction.run(
                'UPDATE accounting \
                SET value=0, correlationNumber=correlationNumber+1 \
                WHERE apiKey=$apiKey',
                {
                    $apiKey: apiKey
                }, function(err) {
                    if (err) {
                        transaction.rollback();
                        return callback(err);
                    } else {
                        transaction.commit(function (error) {
                            return callback(error);
                        });
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
    db.serialize(function() {
        db.run('INSERT OR REPLACE INTO subscriptions \
                VALUES ($subscriptionId, $apiKey, $notificationUrl)',
                {
                    $subscriptionId: subscriptionId,
                    $apiKey: apiKey,
                    $notificationUrl: notificationUrl
                }, function(err) {
                    if (err) {
                        return callback(err);
                    } else {
                        return callback(null);
                    }
        });
    });
}

/**
 * Return the apiKey and notification url associated with the subscriptionId.
 * 
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.getCBSubscription = function(subscriptionId, callback) {
    db.all('SELECT subscriptions.apiKey, subscriptions.notificationUrl, accounting.unit \
            FROM subscriptions , accounting\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId
            }, function(err, subscriptionInfo) {
                if (err) {
                    return callback(err, null);
                } else if (subscriptionInfo.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, subscriptionInfo[0]);
                }
    });
}

/**
 * Delete the subscription identified by the subscriptionId. 
 * 
 * @param  {string} subscriptionId      Identifies the subscription.
 */
exports.deleteCBSubscription = function(subscriptionId, callback) {
    db.run('DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId',
            {
                $subscriptionId: subscriptionId
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
    });
}