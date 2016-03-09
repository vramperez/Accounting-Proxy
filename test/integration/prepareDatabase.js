var async = require('async');

var db_mock;

var loadServices = function(services, callback) {
    if (services.length != 0) {
        async.each(services, function(service, task_callback) {
            db_mock.newService(service.publicPath, service.url, function(err) {
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
}

var loadBuys = function(buys, callback) {
    if (buys.length != 0) {
        async.each(buys, function(buyInfo, task_callback) {
            db_mock.newBuy(buyInfo, function(err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            })
        }, callback)
    } else {    
        return callback();
    }
}

var loadSubscriptions = function(subscriptions, callback) {
    if (subscriptions.length != 0) {
        async.each(subscriptions, function(subs, task_callback) {
            db_mock.addCBSubscription(subs.apiKey, subs.subscriptionId, subs.notificationUrl, function(err) {
                if (err) {
                    task_callback(err);
                } else {
                    task_callback(null);
                }
            })
        }, callback);
    } else {    
        return callback();
    }
}

// Prepare the database for the test adding the services, buy information, subscriptions.
exports.addToDatabase = function(db, services, buys, subscriptions, callback) {
    db_mock = db;

    loadServices(services, function(err) {
        if (err) {
            return callback(err);
        } else {
            loadBuys(buys, function(err) {
                if (err) {
                    return callback(err)
                } else {
                    loadSubscriptions(subscriptions, function(err) {
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