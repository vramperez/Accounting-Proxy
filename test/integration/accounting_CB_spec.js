var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire'),
    test_endpoint = require('./test_endpoint'),
    test_config = require('../config_tests').integration,
    async = require('async'),
    fs = require('fs'),
    redis = require('redis'),
    data = require('../data'),
    util = require('../util');

var request = request('http://localhost:' + test_config.accounting_proxy_port);

var server = {}, db;
var databaseName = 'testDB_accounting_CB.sqlite';

var userProfile = data.DEFAULT_USER_PROFILE;
userProfile.token = data.DEFAULT_TOKEN;

var FIWAREStrategy_mock = util.getStrategyMock(userProfile);

var DEFAULT_URL = 'http://localhost:' + test_config.accounting_CB_port;

var configMock = util.getConfigMock(true);

var mocker = function (database,done) {

    var authenticationMock, accounterMock, cbHandlerMock;

    if (database === 'sql') {

        configMock.database.type = './db';
        configMock.database.name = databaseName;

        db = proxyquire('../../db', {
            './config': configMock
        });

        authenticationMock = proxyquire('../../OAuth2_authentication', {
            'passport-fiware-oauth': FIWAREStrategy_mock,
            './config': configMock,
            'winston': util.logMock,
            './db': db
        });

        accounterMock = proxyquire('../../accounter', {
            './config': configMock,
            './db': db
        });

        cbHandlerMock = proxyquire('../../orion_context_broker/cb_handler', {
            '../config': configMock,
            'winston': util.logMock,
            '.././db': db,
            '../accounter': accounterMock
        });

        server = proxyquire('../../server', {
            './config': configMock,
            './db': db,
            'winston': util.logMock, // Not display logger messages while testing
            'express-winston': util.expressWinstonMock,
            './accounter': accounterMock,
            './orion_context_broker/cb_handler': cbHandlerMock,
            './OAuth2_authentication': authenticationMock,
            './notifier': util.notifierMock
        });

    } else {

        var redis_host = test_config.redis_host;
        var redis_port = test_config.redis_port;

        if (! redis_host || ! redis_port) {
            console.log('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".')
            process.exit(1);
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = test_config.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../db_Redis', {
                './config': configMock
            });

            authenticationMock = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategy_mock,
                './config': configMock,
                'winston': util.logMock,
                './db_Redis': db
            });

            accounterMock = proxyquire('../../accounter', {
                './config': configMock,
                './db_Redis': db
            });

            cbHandlerMock = proxyquire('../../orion_context_broker/cb_handler', {
                '../config': configMock,
                'winston': util.logMock,
                '../accounter': accounterMock,
                '.././db_Redis': db
            });

            server = proxyquire('../../server', {
                './config': configMock,
                './db_Redis': db,
                'winston': util.logMock, // Not display logger messages while testing
                './orion_context_broker/cb_handler': cbHandlerMock,
                'express-winston': util.expressWinstonMock,
                './OAuth2_authentication': authenticationMock,
                './accounter': accounterMock,
                './notifier': util.notifierMock
            });
        }
    }

    server.init(done);
};

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(test_config.accounting_CB_port);

// Delete testing database
after(function (done) {
    util.removeDatabase(databaseName, done);
});

describe('Testing the accounting API. Orion Context-Broker requests', function () {

    var checkAccounting = function (apiKey, amount, compareFunction, callback) {

        util.getAccountingValue(db, apiKey, function (err, accValue) {
            if (err) {
                return callback(err);
            } else {
                assert[compareFunction](accValue, amount);
                return callback();
            }
        });
    };

    var checkCBSubscription = function (subsId, subsInfo, callback) {

        db.getCBSubscription(subsId, function (err, res) {
            if (err) {
                return callback(err);
            } else {
                assert.deepEqual(res, subsInfo);
                return callback(null);
            }
        });
    };

    async.eachSeries(test_config.databases, function (database, taskCallback) {
            
        describe('with database ' + database, function () {
            
            // Clear the database and mock dependencies
            beforeEach(function (done) {
                util.clearDatabase(database, databaseName, function (err) {
                    if (err) {
                        done(err);
                    } else {
                        mocker(database, done);
                    }
                });
            });

            // Stop the Accounting Proxy
            afterEach(function (done) {
                server.stop(done);
            });

            after(function () {
                taskCallback();
            });

            describe('Testing authentication and authorization', function () {

                it('should return 401 when the "X-API-KEY" header is not defined', function (done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};

                    util.addToDatabase(db, [service], [], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get(publicPath + '/v1/contextEntity/Room1')
                                .set('x-auth-token', userProfile.token)
                                .expect(401, { error: 'Undefined "X-API-KEY" header'}, done);
                        }
                    });
                });

                var testRequestHandler = function (apiKey, url, unit, statusCode, response, done) {

                    var url = url ? url : DEFAULT_URL;
                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit ? unit : buyInfo.unit;

                    var apiKey = apiKey ? apiKey : buyInfo.apiKey;

                    util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get(publicPath + '/v1/contextEntity/Room1')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', apiKey)
                                .expect(statusCode, response, done);
                        }
                    });
                };

                it('should return 401 when the API key or user is not valid', function (done) {
                    var expectedResp = { error: 'Invalid API_KEY or user'};

                    testRequestHandler('wrong', undefined, undefined, 401, expectedResp, done);
                });

                it('should fail (504) when an error occur sending the request to the endpoint', function (done) {
                    var url = 'wrongURL';

                    testRequestHandler(undefined, url, undefined, 504, {}, done);
                });

                it('should fail (500) when an error occur making the accounting (wrong unit)', function (done) {
                    testRequestHandler(undefined, undefined, 'wrongUnit', 500, {}, done);
                });

            });

            describe('Requests to a CB whole service', function (done) {

                var testGetEntities = function (path, method, unit, compareFunction, amount, payload, expectedResp, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit;

                    util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else if (method === 'post') {

                            request
                                .post(publicPath + path)
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .set('content-type', 'application/json')
                                .type('json')
                                .send(JSON.stringify(payload))
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        checkAccounting(buyInfo.apiKey, amount, compareFunction, function (err) {
                                            if (err) {
                                                done(err);
                                            } else {
                                                assert.deepEqual(res.body, expectedResp);
                                                done();
                                            }
                                        });
                                    }
                                });

                        } else if (method === 'get') {

                            request
                                .get(publicPath + path)
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        checkAccounting(buyInfo.apiKey, amount, compareFunction, function (err) {
                                            if (err) {
                                                done(err);
                                            } else {
                                                assert.deepEqual(res.body, expectedResp);
                                                done();
                                            }
                                        });
                                    }
                                });
                        }
                    });
                };

                it('should return the entity and make accounting using call unit when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntity/Room1', 'get', 'call', 'equal', 1, {}, data.room1, done);
                });

                it('should return the entity and make accounting using megabyte unit when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntity/Room1', 'get', 'megabyte', 'equal', 0.00022125244140625, {}, data.room1, done);
                });

                it('should return the entity and make accounting using millisecond unit when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntity/Room1', 'get', 'millisecond', 'notEqual', 0, {}, data.room1, done);
                });

                it('should return all entitites and make accounting using unit call when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities', 'get', 'call', 'equal', 1, {}, data.allEntities, done);
                });

                it('should return all entitites and make accounting using unit megabyte when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities', 'get', 'megabyte', 'equal', 0.000457763671875, {}, data.allEntities, done);
                });

                it('should return all entitites and make accounting using unit millisecond when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities', 'get', 'millisecond', 'notEqual', 0, {}, data.allEntities, done);
                });

                it('should create a new entity and make the accounting using unit call when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities/Room1', 'post', 'call', 'equal', 1, data.newEntityReq, data.newEntityResp, done);
                });

                it('should create a new entity and make the accounting using unit megabyte when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities/Room1', 'post', 'megabyte', 'equal', 0.00001430511474609375, data.newEntityReq, data.newEntityResp, done);
                });

                it('should create a new entity and make the accounting using unit millisecond when the request is valid', function (done) {
                    testGetEntities('/v1/contextEntities/Room1', 'post', 'millisecond', 'notEqual', 0, data.newEntityReq, data.newEntityResp, done);
                });
            });

            describe('Create subscriptions requests', function () {

                var testCreateSubs = function (unit, compareFunction, amount, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit;

                    var expectedSubsInfo = {
                        apiKey: buyInfo.apiKey,
                        notificationUrl: data.createSubscriptionReq.reference,
                        unit: buyInfo.unit
                    };

                    util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .post(publicPath + '/v1/subscribeContext')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .set('content-type', 'application/json')
                                .type('json')
                                .send(JSON.stringify(data.createSubscriptionReq))
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        assert.deepEqual(res.body, data.createSubscriptionResp);
                                        checkCBSubscription(data.createSubscriptionResp.subscribeResponse.subscriptionId, expectedSubsInfo, function (err) {
                                            if (err) {
                                                done(err);
                                            } else if (unit === 'millisecond') {
                                                checkAccounting(buyInfo.apiKey, amount, compareFunction, done);
                                            } else {
                                                done();
                                            }
                                        });
                                    }
                                });
                        }
                    });
                };

                it('should create the subscription when the create subscription request is correct (call unit)', function (done) {
                    testCreateSubs('call', 'equal', null, done);
                });

                it('should create the subscriptio when the create subscription request is correct (megabyte unit)', function (done) {
                    testCreateSubs('megabyte', 'equal', null, done);
                });

                it('should create the subscriptions and make accounting using unit millisecond when the create subscription request is correct', function (done) {
                   testCreateSubs('millisecond', 'equal', 2592000000, done); 
                });
            });

            describe('Update subscriptions requests', function () {

                var testUpdateSubs = function (unit, compareFunction, amount, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit;

                    var subscription = data.DEFAULT_SUBSCRIPTION;

                    util.addToDatabase(db, [service], [buyInfo], [subscription], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .post(publicPath + '/v1/updateContextSubscription')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .set('content-type', 'application/json')
                                .type('json')
                                .send(JSON.stringify(data.updateSubscriptionReq))
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        assert.deepEqual(res.body, data.updateSubscriptionResp);
                                        if (unit === 'millisecond') {
                                            checkAccounting(buyInfo.apiKey, amount, compareFunction, done);
                                        } else {
                                            done();
                                        }
                                    }
                                });
                        }
                    });
                };

                it('should update the subscriptions when the update subscriptoin request is valid (call unit)', function (done) {
                    testUpdateSubs('call', 'equal', null, done);
                });

                it('should update the subscriptions when the update subscription request is valid (megabyte unit)', function (done) {
                    testUpdateSubs('megabyte', 'equal', null, done);
                });

                it('should update the subscriptions when the update subscription request is valid (millisecond unit)', function (done) {
                    testUpdateSubs('millisecond', 'equal', 5270400000, done);
                });
            });

            describe('Delete subscriptions requests', function () {

                var testDeleteSubscription = function (method, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));

                    var subscription = data.DEFAULT_SUBSCRIPTION;

                    util.addToDatabase(db, [service], [buyInfo], [subscription], [], [], [], null, function (err) {
                        if (err) {
                            done(err);

                        } else if (method === 'post') {

                            request
                                .post(publicPath + '/v1/unsubscribeContext')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .set('content-type', 'application/json')
                                .type('json')
                                .send(JSON.stringify(data.cancelSubscriptionReq))
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        assert.deepEqual(res.body, data.cancelSubscriptionResp);
                                        checkCBSubscription(res.subscriptionId ,null, done);
                                    }
                                });
                        } else {

                            request
                                .delete(publicPath + '/v1/contextSubscriptions/' + data.DEFAULT_SUBS_ID)
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .set('content-type', 'application/json')
                                .type('json')
                                .send(JSON.stringify(data.cancelSubscriptionReq))
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        assert.deepEqual(res.body, data.cancelSubscriptionResp);
                                        checkCBSubscription(res.subscriptionId ,null, done);
                                    }
                                });
                        }
                    });
                };

                it('should cancel and delete the subscription when the cancel subscription request is valid (POST request)', function (done) {
                    testDeleteSubscription('post', done);
                });

                it('should cancel and delete the subscription when the cancel subscription request is valid (DELETE request)', function (done) {
                    testDeleteSubscription('delete', done);
                });
            });
        });
    });
});