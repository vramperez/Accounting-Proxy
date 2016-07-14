var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire'),
    testEndpoint = require('./test_endpoint'),
    testConfig = require('../config_tests').integration,
    async = require('async'),
    fs = require('fs'),
    redis = require('redis'),
    data = require('../data'),
    util = require('../util');

var request = request('http://localhost:' + testConfig.accounting_proxy_port);

var server = {}, db;
var databaseName = 'testDB_accounting_CB.sqlite';

var userProfile = data.DEFAULT_USER_PROFILE;
userProfile.token = data.DEFAULT_TOKEN;

var FIWAREStrategy_mock = util.getStrategyMock(userProfile);

var DEFAULT_URL = 'http://localhost:' + testConfig.test_endpoint_port;
var DEFAULT_TYPE = data.DEFAULT_IS_CB_SERVICE;

var configMock = util.getConfigMock(true, false);

var mocker = function (database,done) {

    var authenticationMock, accounterMock, cbHandlerMock, orionModuleV1Mock, orionModuleV2Mock;

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

        orionModuleV1Mock = proxyquire('../../orion_context_broker/orionModule_v1', {
            '../config': configMock,
            '.././db': db,
            '../accounter': accounterMock
        });

        orionModuleV2Mock = proxyquire('../../orion_context_broker/orionModule_v2', {
            '../config': configMock,
            '.././db': db,
            '../accounter': accounterMock
        });

        cbHandlerMock = proxyquire('../../orion_context_broker/cbHandler', {
            '../config': configMock,
            'winston': util.logMock,
            '.././db': db,
            '../accounter': accounterMock,
            './orionModule_v1': orionModuleV1Mock,
            './orionModule_v2': orionModuleV2Mock
        });

        server = proxyquire('../../server', {
            './config': configMock,
            './db': db,
            'winston': util.logMock, // Not display logger messages while testing
            'express-winston': util.expressWinstonMock,
            './accounter': accounterMock,
            './orion_context_broker/cbHandler': cbHandlerMock,
            './OAuth2_authentication': authenticationMock,
            './notifier': util.notifierMock
        });

    } else {

        var redis_host = testConfig.redis_host;
        var redis_port = testConfig.redis_port;

        if (! redis_host || ! redis_port) {
            console.log('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".')
            process.exit(1);
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = testConfig.redis_database;
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

            orionModuleV1Mock = proxyquire('../../orion_context_broker/orionModule_v1', {
                '../config': configMock,
                '.././db_Redis': db,
                '../accounter': accounterMock
            });

            orionModuleV2Mock = proxyquire('../../orion_context_broker/orionModule_v2', {
                '../config': configMock,
                '.././db_Redis': db,
                '../accounter': accounterMock
            });

            cbHandlerMock = proxyquire('../../orion_context_broker/cbHandler', {
                '../config': configMock,
                'winston': util.logMock,
                '../accounter': accounterMock,
                '.././db_Redis': db,
                './orionModule_v1': orionModuleV1Mock,
                './orionModule_v2': orionModuleV2Mock
            });

            server = proxyquire('../../server', {
                './config': configMock,
                './db_Redis': db,
                'winston': util.logMock, // Not display logger messages while testing
                'express-winston': util.expressWinstonMock,
                './accounter': accounterMock,
                './orion_context_broker/cbHandler': cbHandlerMock,
                './OAuth2_authentication': authenticationMock,
                './notifier': util.notifierMock
            });
        }
    }

    server.init(done);
};

// Start the enpoint for testing
before(function () {
    testEndpoint.run();
});

// Delete testing database
after(function (done) {
    this.timeout(5000);

    testEndpoint.stop(function (err) {
        if (err) {
            done(err);
        } else {
            util.removeDatabase(databaseName, done);
        }
    });
});

describe('Testing the accounting API. Orion Context-Broker requests', function () {

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

    var testCreateSubs = function (version, unit, compareFunction, amount, done) {

        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var methods = data.DEFAULT_HTTP_METHODS_LIST;
        var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
        var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
        buyInfo.unit = unit;

        var notificationUrl =  version === 'v1' ? data.createSubscriptionReqV1.reference : data.createSubscriptionReqV2.notification.http.url;
        var expires = version === 'v1' ? '' : data.DEFAULT_EXPIRES;
        var requestPath = version === 'v1' ? publicPath + '/v1/subscribeContext' : publicPath + '/v2/subscriptions';
        var expectedStatus = version === 'v1' ? 200 : 201;
        var expectedResp = version === 'v1' ? data.createSubscriptionRespV1 : {};
        var payload = version === 'v1' ? data.createSubscriptionReqV1 : data.createSubscriptionReqV2;

        var expectedSubsInfo = {
            apiKey: buyInfo.apiKey,
            notificationUrl: notificationUrl,
            unit: buyInfo.unit,
            expires: expires,
            version: version,
            url: service.url,
            subscriptionId: data.DEFAULT_SUBS_ID
        };

        util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
            if (err) {
                done(err);
            } else {

                request
                    .post(requestPath)
                    .set('x-auth-token', userProfile.token)
                    .set('X-API-KEY', buyInfo.apiKey)
                    .set('content-type', 'application/json')
                    .type('json')
                    .send(JSON.stringify(payload))
                    .expect(expectedStatus)
                    .end(function (err, res) {
                        if (err) {
                            done(err);
                        } else {

                            assert.deepEqual(res.body, expectedResp);
                            checkCBSubscription(data.DEFAULT_SUBS_ID, expectedSubsInfo, function (err) {
                                if (err) {
                                    done(err);
                                } else if (unit === 'millisecond') {
                                    util.checkAccounting(db, buyInfo.apiKey, amount, compareFunction, done);
                                } else {
                                    done();
                                }
                            });
                        }
                    });
            }
        });
    };

    var testUpdateSubscription = function (version, unit, notificationUrl, expirationDateBefore, subsInfo, compareFunction, amount, done) {

        var subsId = data.DEFAULT_SUBS_ID;

        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var methods = JSON.parse(JSON.stringify(data.DEFAULT_HTTP_METHODS_LIST));
        methods.push('PATCH');
        var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
        var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
        buyInfo.unit = unit;

        var url = version === 'v1' ? publicPath + '/v1/updateContextSubscription' :  publicPath + '/v2/subscriptions/' + subsId;
        var method = version === 'v1' ? 'post' : 'patch';
        var expectedStatus = version === 'v1' ? 200 : 204;
        var expectedResp = version === 'v1' ? data.updateSubscriptionResp : {};
        var payload = version === 'v1' ? data.updateSubscriptionReq: '';
        var subscription = version === 'v1' ? data.DEFAULT_SUBSCRIPTION_v1 : data.DEFAULT_SUBSCRIPTION_v2;

        if (version === 'v2') {

            if (notificationUrl) {
                payload = JSON.stringify(data.updateNotificationUrl);
            } else {

                if (expirationDateBefore) {
                    payload = JSON.stringify(data.updateExpirationDateBefore);
                } else {
                    payload = JSON.stringify(data.updateExpirationDateAfter);
                }
            }
        }

        util.addToDatabase(db, [service], [buyInfo], [subscription], [], [], [], null, function (err) {
            if (err) {
                done(err);
            } else {

                request
                    [method](url)
                    .set('x-auth-token', userProfile.token)
                    .set('X-API-KEY', buyInfo.apiKey)
                    .set('content-type', 'application/json')
                    .type('json')
                    .send(payload)
                    .expect(expectedStatus)
                    .end(function (err, res) {
                        if (err) {
                            done(err);
                        } else {

                            if (version === 'v1') {
                                assert.deepEqual(res.body, expectedResp);
                                util.checkAccounting(db, buyInfo.apiKey, amount, compareFunction, done);

                            } else {
                                if (expirationDateBefore === null) {
                                    checkCBSubscription(subsId, subsInfo, done);
                                } else {
                                    checkCBSubscription(subsId, subsInfo, function (err) {
                                        if (err) {
                                            done(err);
                                        } else {
                                            util.checkAccounting(db, buyInfo.apiKey, amount, compareFunction, done);
                                        }
                                    });
                                }
                            }
                        }
                    });
            }
        });
    };

    async.eachSeries(testConfig.databases, function (database, taskCallback) {
            
        describe('with database ' + database, function () {

            this.timeout(4000);

            // Clear the database and mock dependencies
            beforeEach(function (done) {
                this.timeout(5000);

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
                    var methods = data.DEFAULT_HTTP_METHODS_LIST;
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};

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

                var testRequestHandler = function (apiKey, url, method, unit, statusCode, response, done) {

                    var url = url ? url : DEFAULT_URL;
                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var methods = data.DEFAULT_HTTP_METHODS_LIST;
                    var service = {publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit ? unit : buyInfo.unit;

                    var apiKey = apiKey ? apiKey : buyInfo.apiKey;

                    util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                [method](publicPath + '/v1/contextEntity/Room1')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', apiKey)
                                .expect(statusCode, response, done);
                        }
                    });
                };

                it('should return 401 when the API key or user is not valid', function (done) {
                    var expectedResp = { error: 'Invalid API key'};

                    testRequestHandler('wrong', undefined, 'get', undefined, 401, expectedResp, done);
                });

                it('should return 405 when the request method is not a valid http method for the service', function (done) {
                    var methods = data.DEFAULT_HTTP_METHODS_LIST;

                    testRequestHandler(undefined, undefined, 'patch', undefined, 405, {error: 'Valid methods are: ' + methods}, done);
                });

                it('should fail (504) when an error occur sending the request to the endpoint', function (done) {
                    var url = 'wrongURL';

                    testRequestHandler(undefined, url, 'get', undefined, 504, {}, done);
                });

                it('should fail (500) when an error occur making the accounting (wrong unit)', function (done) {
                    testRequestHandler(undefined, undefined, 'get', 'wrongUnit', 500, {}, done);
                });
            });

            describe('API v1', function () {

                var VERSION = 'v1';

                describe('Requests to a CB whole service', function () {

                    var testGetEntities = function (path, method, unit, compareFunction, amount, payload, expectedResp, done) {

                        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                        var methods = data.DEFAULT_HTTP_METHODS_LIST;
                        var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
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
                                            util.checkAccounting(db, buyInfo.apiKey, amount, compareFunction, function (err) {
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
                                            util.checkAccounting(db, buyInfo.apiKey, amount, compareFunction, function (err) {
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

                describe('Create subscription requests', function () {

                    it('should create the subscription when the create subscription request is correct (call unit)', function (done) {
                        testCreateSubs(VERSION, 'call', 'equal', null, done);
                    });

                    it('should create the subscriptio when the create subscription request is correct (megabyte unit)', function (done) {
                        testCreateSubs(VERSION, 'megabyte', 'equal', null, done);
                    });

                    it('should create the subscriptions and make accounting using unit millisecond when the create subscription request is correct', function (done) {
                        testCreateSubs(VERSION, 'millisecond', 'equal', 2592000000, done); 
                    });
                });

                describe('Update subscriptions requests', function () {

                    it('should update the subscriptions when the update subscriptoin request is valid (call unit)', function (done) {
                        testUpdateSubscription(VERSION, 'call', null, null, null, 'equal', null, done);
                    });

                    it('should update the subscriptions when the update subscription request is valid (megabyte unit)', function (done) {
                        testUpdateSubscription(VERSION, 'megabyte', null, null, null, 'equal', null, done);
                    });

                    it('should update the subscriptions when the update subscription request is valid (millisecond unit)', function (done) {
                        testUpdateSubscription(VERSION, 'millisecond', null, null, null, 'equal', 5270400000, done);
                    });
                });

                describe('Delete subscriptions requests', function () {

                    var testDeleteSubscription = function (method, done) {

                        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                        var methods = data.DEFAULT_HTTP_METHODS_LIST;
                        var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
                        var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));

                        var subscription = data.DEFAULT_SUBSCRIPTION_v1;

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

            describe('API v2', function () {

                var VERSION = 'v2';

                describe('Entities operations (whole service)', function () {

                });

                describe('Create subscription requests', function () {

                    it('should create the subscription when the create subscription request is correct (call unit)', function (done) {
                        testCreateSubs(VERSION, 'call', 'equal', null, done);
                    });

                    it('should create the subscriptio when the create subscription request is correct (megabyte unit)', function (done) {
                        testCreateSubs(VERSION, 'megabyte', 'equal', null, done);
                    });

                    it('should create the subscriptions and make accounting using unit millisecond when the create subscription request is correct', function (done) {
                       testCreateSubs(VERSION, 'millisecond', 'notEqual', 0, done);
                    });
                });

                describe('Update subscriptions requests', function () {

                    it('should return 204 and update the notification URL when the update subscription request is correct', function (done) {
                        var subsInfo = data.DEFAULT_SUBSCRIPTION_v2;
                        subsInfo.notificationUrl = data.updateNotificationUrl.notification.http.url;
                        subsInfo.url = 'http://localhost:' + testConfig.test_endpoint_port;

                        testUpdateSubscription(VERSION, subsInfo.unit, true, null, subsInfo, 'equal', undefined, done);
                    });

                    it('should return 204 and update the expiration time when the update request is correct (call unit)', function (done) {
                        var unit = 'call';
                        var subsInfo = data.DEFAULT_SUBSCRIPTION_v2;
                        subsInfo.notificationUrl = data.updateNotificationUrl.notification.http.url;
                        subsInfo.url = 'http://localhost:' + testConfig.test_endpoint_port;
                        subsInfo.unit = unit;

                        testUpdateSubscription(VERSION, unit, false, true, subsInfo, 'equal', undefined, done);
                    });

                    it('should return 204 and update the expiration time when the update request is correct (megabyte unit)', function (done) {
                        var unit = 'megabyte';
                        var subsInfo = data.DEFAULT_SUBSCRIPTION_v2;
                        subsInfo.notificationUrl = data.updateNotificationUrl.notification.http.url;
                        subsInfo.url = 'http://localhost:' + testConfig.test_endpoint_port;
                        subsInfo.unit = unit;

                        testUpdateSubscription(VERSION, unit, false, true, subsInfo, 'equal', undefined, done);
                    });

                    it('should return 204 and not update the expiration time when the new expiration date is before the old expiration date (millisecond unit)', function (done) {
                        var unit = 'millisecond';
                        var subsInfo = data.DEFAULT_SUBSCRIPTION_v2;
                        subsInfo.notificationUrl = data.updateNotificationUrl.notification.http.url;
                        subsInfo.url = 'http://localhost:' + testConfig.test_endpoint_port;
                        subsInfo.unit = unit;

                        testUpdateSubscription(VERSION, unit, false, true, subsInfo, 'equal', undefined, done);
                    });

                    it('should return 204, update the expiration time and make the accounting when the new expiration date is after the old expiration date (millisecond unit)', function (done) {
                        var unit = 'millisecond';
                        var subsInfo = data.DEFAULT_SUBSCRIPTION_v2;
                        subsInfo.notificationUrl = data.updateNotificationUrl.notification.http.url;
                        subsInfo.url = 'http://localhost:' + testConfig.test_endpoint_port;
                        subsInfo.unit = unit;
                        subsInfo.expires = data.updateExpirationDateAfter.expires;

                        testUpdateSubscription(VERSION, unit, false, false, subsInfo, 'notEqual', 0, done);
                    });
                });

                describe('Delete subscriptions requests', function () {

                    it('should delete the subscription when the unsubscribe request is correct', function (done) {

                        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                        var subsId = data.DEFAULT_SUBS_ID;
                        var methods = data.DEFAULT_HTTP_METHODS_LIST;
                        var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId, isCBService: DEFAULT_TYPE, methods: methods};
                        var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));

                        var subscription = data.DEFAULT_SUBSCRIPTION_v2;

                        util.addToDatabase(db, [service], [buyInfo], [subscription], [], [], [], null, function (err) {
                            if (err) {
                                done(err);
                            } else {

                                request
                                    .delete(publicPath + '/v2/subscriptions/' + subsId)
                                    .set('x-auth-token', userProfile.token)
                                    .set('X-API-KEY', buyInfo.apiKey)
                                    .expect(204)
                                    .end(function (err, res) {
                                        if (err) {
                                            done(err);
                                        } else {

                                            checkCBSubscription(res.subscriptionId ,null, done);
                                        }
                                    });
                            }
                        });
                    });
                });
            });
        });
    });
});