var async = require('async'),
    redis = require('redis'),
    test_config = require('../config_tests').integration,
    fs = require('fs');

var db_mock;

var loadServices = function (services, callback) {
    if (services.length != 0) {
        async.each(services, function (service, task_callback) {
            db_mock.newService(service.publicPath, service.url, service.appId, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            });
        }, callback);
    } else {
        return callback();
    }
};

var loadBuys = function (buys, callback) {
    if (buys.length != 0) {
        async.each(buys, function (buyInfo, task_callback) {
            db_mock.newBuy(buyInfo, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            });
        }, callback);
    } else {    
        return callback();
    }
};

var loadSubscriptions = function (subscriptions, callback) {
    if (subscriptions.length != 0) {
        async.each(subscriptions, function (subs, task_callback) {
            db_mock.addCBSubscription(subs.apiKey, subs.subscriptionId, subs.notificationUrl, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            });
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
                    db_mock.bindAdmin(admin.idAdmin, admin.publicPath, function (err) {
                        if (err) {
                            task_callback(err);
                        } else {
                            task_callback(null);
                        }
                    });
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
            db_mock.makeAccounting(accounting.apiKey, accounting.value, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            });
        }, callback);
    } else {
        return callback();
    }
};

var loadSpecificationRefs = function (specifications, callback) {
    if (specifications.length != 0) {
        async.each(specifications, function (specification, task_callback) {
            db_mock.addSpecificationRef(specification.unit, specification.href, function (err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            });
        }, callback);
    } else {
        return callback();
    }
};

// Prepare the database for the test adding the services, buy information, subscriptions.
exports.addToDatabase = function (db, services, buys, subscriptions, admins, accountings, specifications, callback) {
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
        }
    ], function (err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
};

// Flush the database specified.
exports.clearDatabase = function (database, name, callback) {
    if (database === 'sql') {
        fs.access('./' + name, fs.F_OK, function (err) {
            if (!err) {
                fs.unlinkSync('./' + name);
                return callback(null);
            } else {
                return callback(null);
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

exports.removeDatabase = function (databaseName, callback) {
    async.eachSeries(test_config.databases, function (database, task_callback) {
        exports.clearDatabase(database, databaseName, task_callback);
    }, callback);
};