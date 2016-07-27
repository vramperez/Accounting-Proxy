var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    data = require('../data'),
    util = require('../util');

var mocker = function (implementations, callback) {

    util.getSpies(implementations, function (spies) {

        var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './db'
        };
        config.resources = {
            notification_port: data.DEFAULT_PORT
        };

        var app = implementations.app ? implementations.app : {};
        app.use = app.use ? implementations.app.use : function (middleware, handler) {};
        app.set = function (key, value) {};

        var cbHandler = proxyquire('../../orion_context_broker/cbHandler', {
            express: function () {
                return app;
            },
            '../config': config,
            '.././db': implementations.db ? implementations.db : {},
            request: implementations.requester ? implementations.requester.request : {},
            url: implementations.url ? implementations.url : {},
            './subsUrls': implementations.subsUrls ? implementations.subsUrls : {},
            '../accounter': implementations.accounter ? implementations.accounter : {},
            winston: implementations.logger ? implementations.logger: {},
            './orionModule_v1': implementations.orionModuleV1 ? implementations.orionModuleV1 : {},
            './orionModule_v2': implementations.orionModuleV2 ? implementations.orionModuleV2 : {}
        });

        return callback(cbHandler, spies);
    });
};

describe('Testing ContextBroker Handler', function () {

    describe('Function "init"', function () {

        it('correct initialization', function (done) {

            var port = data.DEFAULT_PORT;

            var implementations = {
                app: {
                    listen: function (port) {},
                    get: function (prop) {
                        return port;
                    }
                },
                config: {
                    resources: {
                        notification_port: port
                    }
                }
            };

            mocker(implementations, function (cbHandler, spies) {

                cbHandler.run();

                assert(spies.app.get.calledWith('port'));
                assert(spies.app.listen.calledWith(port));

                done();
            });
        });
    });

    describe('Function "getOperation"', function () {

        var testGetOperation = function (path, method, operation, done) {

            var implementations = {
                subsUrls: data.DEFAULT_SUBS_URLS,
                req: {
                    method: method
                }
            };

            mocker(implementations, function (cbHandler, spies) {

                cbHandler.getOperation(path, implementations.req, function (result) {

                    assert.equal(result, operation);

                    done();
                });
            });

        };

        it('should return "create" when the request is a CB subscription', function (done) {
            testGetOperation(data.DEFAULT_SUBS_PATH, 'POST', 'create', done);
        });

        it('should return "delete" when the request is a CB unsubscription', function (done) {
            testGetOperation(data.DEFAULT_UNSUBS_PATH, 'DELETE', 'delete', done);
        });

        it('should return "update" when the request is a CB subscription update', function (done) {
            testGetOperation(data.DEFAULT_UPDATE_SUBS_PATH, 'POST', 'update', done);
        });

        it('should return null when the request is not a subscription, unsubscription or a subscription update', function (done) {
            testGetOperation('/entities', 'PUT', null, done); 
        });
    });

    describe('Function "subscriptionHandler"', function () {

        var testSubscriptionHandler = function (operation, version, done) {

            var req = {};
            var res = {};
            var unit = data.DEFAULT_UNIT;
            var options = {};

            var module = version === 'v1' ? 'orionModuleV1' : 'orionModuleV2';
            var handler = operation === 'create' ? 'subscribe' : operation === 'delete' ? 'unsubscribe' : 'updateSubscription';

            var orionModule = {};

            if (operation === 'create') {
                orionModule[handler] = function (req, res, unit, options, callback) { 
                    return callback();
                };
            } else {
                orionModule[handler] = function (req, res, options, callback) { 
                    return callback();
                };
            }

            var implementations = {};
            implementations[module] = orionModule;

            mocker(implementations, function (cbHandler, spies) {

                cbHandler.subscriptionHandler(req, res, options, operation, unit, version, function () {
                    if (operation === 'create') {
                        assert(spies[module][handler].calledWith(req, res, unit, options));
                    } else {
                        assert(spies[module][handler].calledWith(req, res, options));
                    }

                    done();
                });
            });
        };

        it('should redirect the request to subscribe handler of orion module v1 when the request is a v1 subscription', function (done) {
            testSubscriptionHandler('create', 'v1', done);
        });

        it('should redirect the request to subscribe handler of orion module v2 when the request is a v2 subscription', function (done) {
            testSubscriptionHandler('create', 'v2', done);
        });

        it('should redirect the request to unsubscribe handler of orion module v1 when the request is a v1 unsubscription', function (done) {
            testSubscriptionHandler('delete', 'v1', done);
        });

        it('should redirect the request to unsubscribe handler of orion module v2 when the request is a v2 unsubscription', function (done) {
            testSubscriptionHandler('delete', 'v2', done);
        });

        it('should redirect the request to update subscription handler of orion module v1 when the request is a v1 subscription update', function (done) {
            testSubscriptionHandler('update', 'v1', done);
        });

        it('should redirect the request to update subscription handler of orion module v2 when the request is a v2 subscription update', function (done) {
            testSubscriptionHandler('update', 'v2', done);
        });
    });

    describe('Function "cancelSubscription"', function (done) {

        var testCancelSubscription = function (error, subscriptionInfo, done) {

            var orionModuleV1 = {
                cancelSubscription: function (subscriptionInfo, callback) {
                    return callback(error);
                }
            };

            var orionModuleV2 = {
                cancelSubscription: function (subscriptionInfo, callback) {
                    return callback(error);
                }
            };

            var implementations = {
                orionModuleV1: orionModuleV1,
                orionModuleV2: orionModuleV2
            };

            mocker(implementations, function (cbHandler, spies) {

                cbHandler.cancelSubscription(subscriptionInfo, function (err) {

                    if (subscriptionInfo.version === 'v1') {
                        assert(spies.orionModuleV1.cancelSubscription.calledWith(subscriptionInfo));
                    } else {
                        assert(spies.orionModuleV2.cancelSubscription.calledWith(subscriptionInfo));
                    }

                    assert.equal(err, error);

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error cancelling a v1 subscription', function (done) {
            testCancelSubscription(true, {version: 'v1'}, done);
        });

        it('should call the callback without error when there is no error cancelling a v1 subscription', function (done) {
            testCancelSubscription(false, {version: 'v1'}, done);
        });

        it('should call the callback with error when there is an error cancelling a v2 subscription', function (done) {
            testCancelSubscription(true, {version: 'v2'}, done);
        });

        it('should call the callback without error when there is no error cancelling a v2 subscription', function (done) {
            testCancelSubscription(false, {version: 'v2'}, done);
        });
    });

    describe('Function "notificationHandler"', function (done) {

        var testNotificationHandler = function (getCBSubsErr, countErr, requestErr, done) {

            var subsId = data.DEFAULT_SUBS_ID;
            var requestStatus = 200;
            var subscription = data.DEFAULT_SUBSCRIPTION_v1;
            var method = 'POST';
            var resp = {
                statusCode: requestStatus,
                elapsedTime: data.DEFAULT_ELAPSED_TIME
            };

            var implementations = {
                req: {
                    body: {
                        subscriptionId: subsId
                    },
                    method: method,
                    headers: {}
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function () {}
                },
                app: {
                    use: function (path, handler) {
                        if (path === '/subscriptions') {
                            return handler(implementations.req, implementations.res);
                        }
                    }
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(getCBSubsErr, subscription);
                    }
                },
                accounter:{
                    count: function (apiKey, unit, countInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp);
                    }
                },
                logger: {
                    error: function (msg) {}
                }
            };

            mocker(implementations, function (cbHandler, spies) {

                assert(spies.db.getCBSubscription.calledWith(subsId));

                if (getCBSubsErr) {
                    assert(spies.logger.error.calledWith('An error ocurred while making the accounting: Invalid subscriptionId'));
                } else {

                    var options = {
                        url: subscription.notificationUrl,
                        method: method,
                        headers: implementations.req.headers,
                        json: true,
                        body: implementations.req.body,
                        time: true
                    };

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert(spies.logger.error.calledWith('An error ocurred notifying the user, url: ' + options.url));
                        assert(spies.res.status.calledWith(504));
                        assert(spies.res.send.calledOnce);
                    } else {

                        assert(spies.accounter.count.calledWith(subscription.apiKey, subscription.unit, {request: implementations.req, response: resp}, 'count'));

                        if (countErr) {
                            assert(spies.logger.error.calledWith('An error ocurred while making the accounting'));
                        }

                        assert(spies.res.status.calledWith(requestStatus));
                        assert(spies.res.send.calledOnce);
                    }
                }

                done();
            });
        };

        it('should log the error when db fails getting the subscription information', function (done) {
            testNotificationHandler(true, false, false, done);
        });

        it('should log the error when db fails making the accounting', function (done) {
            testNotificationHandler(false, true, false, done); 
        });

        it('should return 504 when the notification fails', function (done) {
            testNotificationHandler(false, false, true, done);
        });

        it('should return 200 when the notification success', function (done) {
            testNotificationHandler(false, false, false, done); 
        });
    });
});