var async = require('async');

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