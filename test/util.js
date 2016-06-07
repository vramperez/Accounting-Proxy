var async = require('async'),
	sinon = require('sinon'),
	redis = require('redis'),
    test_config = require('./config_tests').integration,
    fs = require('fs'),
    data = require('./data');

var db_mock;

var logMock = {
    log: function (level, msg) {},
    info: function (msg) {},
    warn: function (msg) {},
    error: function (msg) {},
    transports: {
        File: function (options) {}
    }
};

var expressWinstonMock = {
    logger: function (options) {
        return function (req, res, next) {
            next();
        };
    }
};

var notifierMock = {
    notifyUsage: function (callback) {
        return callback(null);
    }
};

// Return a FIWARE strategy mock for testing
exports.getStrategyMock = function (userProfile) {
    return {
        OAuth2Strategy: function (options, callback) {
            return {
                userProfile: function (authToken, callback) {
                    return callback(null, userProfile);
                }
            }
        }
    };
};

// Return a configuration mock for testing
exports.getConfigMock = function (enableCB) {
    return {
        accounting_proxy: {
            port: test_config.accounting_proxy_port
        },
        resources: {
            contextBroker: enableCB
        },
        database: {},
        api: {
            administration_paths: data.DEFAULT_ADMINISTRATION_PATHS
        },
        oauth2: {
            roles: data.DEFAULT_ROLES
        },
        log: {
            file: 'file'
        },
        modules: {
            accounting: ['call', 'megabyte', 'millisecond']
        },
        usageAPI: {
            schedule: '00 00 * * *',
            host: 'localhost',
            port: test_config.usageAPI_port,
            path: ''
        }
    };
};

// Return an object with spies for the implementations methods .
exports.getSpies = function (implementations, callback) {

	var spies = {};

	async.forEachOf(implementations, function (value, key, task_callback1) {

        spies[key] = {};

        async.forEachOf(value, function (functionImpl, functionName, task_callback2) {

            if (typeof implementations[key][functionName] == 'function') {
                spies[key][functionName] = sinon.spy(implementations[key], functionName);
            }

            task_callback2();

        }, task_callback1);
    }, function () {
    	return callback(spies);
    });
};

var loadServices = function (services, callback) {
    if (services.length != 0) {
        async.eachSeries(services, function (service, task_callback) {
            db_mock.newService(service.publicPath, service.url, service.appId, task_callback);
        }, callback);
    } else {
        return callback();
    }
};

var loadBuys = function (buys, callback) {
    if (buys.length != 0) {
        async.each(buys, function (buyInfo, task_callback) {
            db_mock.newBuy(buyInfo, task_callback);
        }, callback);
    } else {    
        return callback();
    }
};

var loadSubscriptions = function (subscriptions, callback) {
    if (subscriptions.length != 0) {
        async.each(subscriptions, function (subs, task_callback) {
            db_mock.addCBSubscription(subs.apiKey, subs.subscriptionId, subs.notificationUrl, task_callback);
        }, callback);
    } else {
        return callback();
    }
};

var loadAdmins = function (admins, callback) {
    if (admins.length != 0) {
        async.each(admins, function (admin, task_callback) {
            db_mock.addAdmin(admin.idAdmin, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    db_mock.bindAdmin(admin.idAdmin, admin.publicPath, task_callback);
                }
            });
        }, callback);
    } else {
        return callback();
    }
};

var loadAccountings = function (accountings, callback) {
    if (accountings.length != 0) {
        async.each(accountings, function (accounting, task_callback) {
            db_mock.makeAccounting(accounting.apiKey, accounting.value, task_callback);
        }, callback);
    } else {
        return callback();
    }
};

var loadSpecificationRefs = function (specifications, callback) {
    if (specifications.length != 0) {
        async.each(specifications, function (specification, task_callback) {
            db_mock.addSpecificationRef(specification.unit, specification.href, task_callback);
        }, callback);
    } else {
        return callback();
    }
};

var loadToken = function (token, callback) {
    if (token) {
        db_mock.addToken(token, callback);
    } else {
        return callback(null);
    }
};

// Prepare the database for the test adding the services, buy information, subscriptions.
exports.addToDatabase = function (db, services, buys, subscriptions, admins, accountings, specifications, token, callback) {
    db_mock = db;

    async.series([
        function (callback) {
            loadServices(services, callback);
        },
        function (callback) {
            loadBuys(buys, callback);
        },
        function (callback) {
            loadSubscriptions(subscriptions, callback);
        },
        function (callback) {
            loadAdmins(admins, callback);
        },
        function (callback) {
            loadAccountings(accountings, callback);
        },
        function (callback) {
            loadSpecificationRefs(specifications, callback);
        },
        function (callback) {
            loadToken(token, callback);
        }
    ], function (err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
};

// Returns the accounting value for specified apiKey
exports.getAccountingValue = function (db, apiKey, callback) {
    db.getNotificationInfo(function (err, allAccountingInfo) {

        if (err) {
            return callback(err);
        } else {

            async.eachSeries(allAccountingInfo, function (accountingInfo, taskCallback) {

                if (accountingInfo.apiKey === apiKey) {
                    return callback(null, accountingInfo.value);
                } else {
                    taskCallback();
                }
            }, callback);
        }
    });
};

// Flush the database specified
exports.clearDatabase = function (database, name, callback) {
    if (database === 'sql') {
        fs.access('./' + name, fs.F_OK, function (err) {
            if (!err) {
                fs.unlink('./' + name, callback);
            } else {
                return callback(null); // not exists
            }
        });
    } else {
        var client = redis.createClient({
            host: test_config.redis_host,
            port: test_config.redis_port
        });
        client.select(test_config.redis_database, function (err) {
            if (err) {
                return callback('Errro cleaning redis database');
            } else {
                client.flushdb();
                return callback(null);
            }
        });
    }
};

// Remove all databases used for testing
exports.removeDatabase = function (databaseName, callback) {
    async.eachSeries(test_config.databases, function (database, task_callback) {
        exports.clearDatabase(database, databaseName, task_callback);
    }, callback);
};

module.exports.logMock = logMock;
module.exports.expressWinstonMock = expressWinstonMock;
module.exports.notifierMock = notifierMock;