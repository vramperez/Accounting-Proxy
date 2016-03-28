var sqlite = require('sqlite3').verbose(), // Debug enable
    TransactionDatabase = require('sqlite3-transactions').TransactionDatabase,
    config = require('./config');

"use strict"

var db = new TransactionDatabase (
        new sqlite.Database(config.database.name, sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE)
);

/*
* Initialize the database and creates the necessary tables.
*/
exports.init = function(callback) {
    db.serialize(function() {
        db.run('PRAGMA encoding = "UTF-8";');
        db.run('PRAGMA foreign_keys = 1;');

        db.run('CREATE TABLE IF NOT EXISTS token ( \
                    token               TEXT \
        )');

        db.run('CREATE TABLE IF NOT EXISTS services ( \
                    publicPath      TEXT, \
                    url             TEXT, \
                    appId           TEXT, \
                    PRIMARY KEY (publicPath) \
        )');

        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    apiKey              TEXT, \
                    publicPath          TEXT, \
                    orderId             TEXT, \
                    productId           TEXT, \
                    customer            TEXT, \
                    unit                TEXT, \
                    value               INT, \
                    recordType          TEXT, \
                    correlationNumber   TEXT, \
                    PRIMARY KEY (apiKey), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE\
        )');

        db.run('CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) ON DELETE CASCADE\
        )');

        db.run('CREATE TABLE IF NOT EXISTS admins ( \
                    idAdmin             TEXT, \
                    PRIMARY KEY (idAdmin)\
        )');

        db.run('CREATE TABLE IF NOT EXISTS administer ( \
                    idAdmin             TEXT, \
                    publicPath          TEXT, \
                    PRIMARY KEY (idAdmin, publicPath), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE, \
                    FOREIGN KEY (idAdmin) REFERENCES admins (idAdmin) ON DELETE CASCADE\
        )');

        return callback(null);
    });
};

/**
 * Save the token to notify the WStore.
 */
exports.addToken = function(token, callback) {
    db.run('DELETE FROM token', function(err) {
        if (err) {
            return callback(err);
        } else {
            db.run('INSERT OR REPLACE INTO token \
                VALUES ($token)',
                {
                    $token: token
                }, function(err) {
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
 * Return the token to notify the WStore.
 */
exports.getToken = function(callback) {
    db.get('SELECT * \
            FROM token', 
        function(err, token) {
            if (err) {
                return callback(err, null);
            } else if (token === undefined) {
                return callback(null, null);
            } else {
                return callback(null, token.token);
            }
    });
}

/**
 * Map the publicPath with the endpoint url.
 * 
 * @param  {string} publicPath      Service public path.
 * @param  {string} url             Endpoint url.
 */
exports.newService = function(publicPath, url, appId, callback) {
    db.run('INSERT OR REPLACE INTO services \
            VALUES ($path, $url, $appId)',
        {
            $path: publicPath,
            $url: url,
            $appId: appId
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
 * @param  {string} publicPath      Service public path.
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
 * @param  {string} publicPath      Service public path.
 */
exports.getService = function(publicPath, callback) {
    db.all('SELECT url, appId \
            FROM services \
            WHERE publicPath=$path', {
                $path: publicPath
            }, function(err, service) {
                if (err) {
                    return callback(err, null);
                } else if (service.length ===  0) {
                    return callback(null, null);
                } else {
                    return callback(null, {url: service[0].url, appId: service[0].appId} );
                }
    });
}

/**
 * Return all the registered services.
 */
exports.getAllServices = function(callback) {
    db.all('SELECT * \
            FROM services', function(err, services) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, services);
                }
    });
}

/**
 * Return the appId associated with the specified service by its public path.
 * 
 * @param  {string}   publicPath Service public path.
 */
exports.getAppId = function(publicPath, callback) {
    db.all('SELECT appId \
            FROM services \
            WHERE $publicPath=publicPath',
            {
                $publicPath: publicPath
            }, function(err, appId) {
                if (err) {
                    return callback(err, null);
                } else if (appId.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, appId[0].appId);
                }
    });
}

/**
 * Add a new administrator.
 * 
 * @param {string}   idAdmin      Administrator user name.
 */
exports.addAdmin = function(idAdmin, callback) {
    db.run('INSERT OR REPLACE INTO admins \
            VALUES ($idAdmin)',
            {
                $idAdmin: idAdmin
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
    });
}

/**
 * Delete the specified administrator.
 * 
 * @param  {string}   idAdmin  Administrator identifier.
 */
exports.deleteAdmin = function(idAdmin, callback) {
    db.run('DELETE FROM admins \
            WHERE $idAdmin=idAdmin',
            {
                $idAdmin: idAdmin
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
    });
}

/**
 * Bind the administrator to the service.
 * 
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Service public path.
 */
exports.bindAdmin = function(idAdmin, publicPath, callback) {
    db.run('INSERT OR REPLACE INTO administer \
            VALUES ($idAdmin, $publicPath)',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
    });
}

/**
 * Unbind the specified admin for the specified service by its public path.
 * 
 * @param  {string}   admin      Administrator user name.
 * @param  {string}   publicPath Public path of the service.
 */
exports.unbindAdmin = function(idAdmin, publicPath, callback) {
    db.run('DELETE FROM administer \
            WHERE idAdmin=$idAdmin AND publicPath=$publicPath',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function(err) {
                if (err) {
                    return callback(err);
                } else {
                    return callback(null);
                }
    });
}

/**
 * Return all the administrators for the service specified by its public path.
 * 
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdmins = function(publicPath, callback) {
    db.all('SELECT idAdmin \
            FROM administer \
            WHERE $publicPath=publicPath',
            {
                $publicPath: publicPath
            }, function(err, admins) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, admins);
                }
    });
}

/**
 * Return the endpoint url if the user is an administrator of the service; otherwise return null.
 * 
 * @param  {string}   idAdmin    Administrator identifier.
 * @param  {string}   publicPath Public path of the service.
 */
exports.getAdminUrl = function(idAdmin, publicPath, callback) {
    db.all('SELECT services.url \
            FROM administer, services \
            WHERE administer.publicPath=services.publicPath AND \
                administer.idAdmin=$idAdmin AND services.publicPath=$publicPath',
            {
                $idAdmin: idAdmin,
                $publicPath: publicPath
            }, function(err, result) {
                if (err) {
                    return callback(err, null);
                } else if (result.length === 0) {
                    return callback(null, null);
                } else {
                    return callback(null, result[0].url);
                }
    });
}

/**
 * Check if the publicPath passed as argument is associated with a service (return true) or not (return false).
 * 
 * @param  {string} publicPath         Path to check.
 */
exports.checkPath = function(publicPath, callback) {
    db.all('SELECT * \
            FROM services \
            WHERE publicPath=$publicPath', {
                $publicPath: publicPath
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
    db.all('SELECT accounting.unit, services.url \
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
        return callback('[ERROR] The aomunt must be greater than 0');
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