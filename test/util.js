var async = require('async'),
    assert = require('assert'),
	sinon = require('sinon'),
	redis = require('redis'),
    testConfig = require('./config_tests').integration,
    fs = require('fs'),
    data = require('./data');

var dbMock;

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
            port: testConfig.accounting_proxy_port
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
            port: testConfig.test_endpoint_port,
            path: ''
        }
    };
};

// Return an object with spies for the implementations methods .
exports.getSpies = function (implementations, callback) {

	var spies = {};

	async.forEachOf(implementations, function (value, key, taskCallback1) {

        spies[key] = {};

        async.forEachOf(value, function (functionImpl, functionName, taskCallback2) {

            if (typeof implementations[key][functionName] == 'function') {
                spies[key][functionName] = sinon.spy(implementations[key], functionName);
            }

            taskCallback2();

        }, taskCallback1);
    }, function () {
    	return callback(spies);
    });
};

var loadServices = function (services, callback) {
    if (services.length != 0) {
        async.eachSeries(services, function (service, taskCallback) {
            dbMock.newService(service.publicPath, service.url, service.appId, service.isCBService, service.methods, taskCallback);
        }, callback);
    } else {
        return callback();
    }
};

var loadBuys = function (buys, callback) {
    if (buys.length != 0) {
        async.each(buys, function (buyInfo, taskCallback) {
            dbMock.newBuy(buyInfo, taskCallback);
        }, callback);
    } else {    
        return callback();
    }
};

var loadSubscriptions = function (subscriptions, callback) {
    if (subscriptions.length != 0) {
        async.each(subscriptions, function (subs, taskCallback) {
            dbMock.addCBSubscription(subs.apiKey, subs.subscriptionId, subs.notificationUrl, subs.expires, subs.version, taskCallback);
        }, callback);
    } else {
        return callback();
    }
};

var loadAdmins = function (admins, callback) {
    if (admins.length != 0) {
        async.each(admins, function (admin, taskCallback) {
            dbMock.addAdmin(admin.idAdmin, function (err) {
                if (err) {
                    taskCallback(err);
                } else {
                    dbMock.bindAdmin(admin.idAdmin, admin.publicPath, taskCallback);
                }
            });
        }, callback);
    } else {
        return callback();
    }
};

var loadAccountings = function (accountings, callback) {
    if (accountings.length != 0) {
        async.each(accountings, function (accounting, taskCallback) {
            dbMock.makeAccounting(accounting.apiKey, accounting.value, taskCallback);
        }, callback);
    } else {
        return callback();
    }
};

var loadSpecificationRefs = function (specifications, callback) {
    if (specifications.length != 0) {
        async.each(specifications, function (specification, taskCallback) {
            dbMock.addSpecificationRef(specification.unit, specification.href, taskCallback);
        }, callback);
    } else {
        return callback();
    }
};

var loadToken = function (token, callback) {
    if (token) {
        dbMock.addToken(token, callback);
    } else {
        return callback(null);
    }
};

// Prepare the database for the test adding the services, buy information, subscriptions.
exports.addToDatabase = function (db, services, buys, subscriptions, admins, accountings, specifications, token, callback) {
    dbMock = db;

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

exports.checkAccounting = function (db, apiKey, amount, compareFunction, callback) {
    db.getNotificationInfo(apiKey, function (err, accountingInfo) {
        if (err) {
            return callback(err);
        } else {

            if (!accountingInfo) {
                assert[compareFunction](accountingInfo, amount);
            } else {
                assert[compareFunction](accountingInfo.value, amount);
            }

            return callback(null);
        }
    });
};

exports.checkUsageSpecifications = function (db, units, hrefs, callback) {
    async.eachOf(units, function (unit, i, taskCallback) {
        db.getHref(unit, function (err, href) {
                if (err) {
                    taskCallback(err);
                } else {
                    assert.equal(href, hrefs[i]);
                    taskCallback(null);
                }
        })
    }, callback);
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
            host: testConfig.redis_host,
            port: testConfig.redis_port
        });
        client.select(testConfig.redis_database, function (err) {
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
    async.eachSeries(testConfig.databases, function (database, taskCallback) {
        exports.clearDatabase(database, databaseName, taskCallback);
    }, callback);
};

module.exports.logMock = logMock;
module.exports.expressWinstonMock = expressWinstonMock;
module.exports.notifierMock = notifierMock;