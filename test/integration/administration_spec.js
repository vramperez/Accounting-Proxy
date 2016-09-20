var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire'),
    test_config = require('../config_tests').integration,
    testEndpoint = require('./test_endpoint'),
    testUtil = require('../util'),
    async = require('async'),
    redis = require('redis'),
    testConfig = require('../config_tests').integration,
    data = require('../data');

var request = request('http://localhost:' + testConfig.accounting_proxy_port);

var server, db;
var databaseName = 'testDB_administration.sqlite';

var configMock = testUtil.getConfigMock(true, false);

var userProfile = data.DEFAULT_USER_PROFILE;
userProfile.token = data.DEFAULT_TOKEN;

var FIWAREStrategyMock = testUtil.getStrategyMock(userProfile);

var mocker = function (database, done) {

    var authentication, apiServer, notifier, cbHandler, util;

    if (database === 'sql') {

        configMock.database.type = './db';
        configMock.database.name = databaseName;

        db = proxyquire('../../db', {
            './config': configMock
        });

        authentication = proxyquire('../../OAuth2_authentication', {
            'passport-fiware-oauth': FIWAREStrategyMock,
            './config': configMock,
            'winston': testUtil.logMock,
            './db': db
        });

        notifier = proxyquire('../../notifier', {
            './config': configMock,
            'winston': testUtil.logMock,
            './db': db
        });

        cbHandler = proxyquire('../../orion_context_broker/cbHandler', {
            '../config': configMock
        });

        apiServer = proxyquire('../../APIServer', {
            './config': configMock,
            'winston': testUtil.logMock,
            './db': db,
            './notifier': notifier
        });

        util = proxyquire('../../util', {
            './config': configMock
        });

        server = proxyquire('../../server', {
            './config': configMock,
            './db': db,
            './APIServer': apiServer,
            './OAuth2_authentication': authentication,
            './notifier': notifier,
            'winston': testUtil.logMock, // Not display logger messages while testing
            'express-winston': testUtil.expressWinstonMock,
            './orion_context_broker/cbHandler': cbHandler,
            './util': util
        });
    } else {

        var redis_host = test_config.redis_host;
        var redis_port = test_config.redis_port;

        if (! redis_host || ! redis_port) {
            done('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".');
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = test_config.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../db_Redis', {
                './config': configMock
            });

            authentication = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategyMock,
                './config': configMock,
                'winston': testUtil.logMock,
                './db_Redis': db
            });

            notifier = proxyquire('../../notifier', {
                './config': configMock,
                'winston': testUtil.logMock,
                './db_Redis': db
            });

            apiServer = proxyquire('../../APIServer', {
                './config': configMock,
                'winston': testUtil.logMock,
                './db_Redis': db,
                './notifier': notifier
            });

            cbHandler = proxyquire('../../orion_context_broker/cbHandler', {
                '../config': configMock
            });

            util = proxyquire('../../util', {
                './config': configMock
            });

            server = proxyquire('../../server', {
                './config': configMock,
                './db_Redis': db,
                './APIServer': apiServer,
                './OAuth2_authentication': authentication,
                './notifier': notifier,
                'winston': testUtil.logMock, // Not display logger messages while testing
                'express-winston': testUtil.expressWinstonMock,
                './orion_context_broker/cbHandler': cbHandler,
                './util': util
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
            testUtil.removeDatabase(databaseName, done);
        }
    });
});

describe('Testing the administration API', function (done) {

    var testAuthentication = function (path, method, token, statusCode, response, done) {

        if (!token) {

            request
                [method](configMock.api.administration_paths[path])
                .expect(statusCode, response, done);

        } else {

            request
                [method](configMock.api.administration_paths[path])
                .set('authorization', token)
                .expect(statusCode, response, done);
        }
    };

    var testBody = function (path, contentType, body, statusCode, response, done) {
        request
            .post(configMock.api.administration_paths[path])
            .set('content-type', contentType)
            .set('authorization', 'bearer ' + userProfile.token)
            .send(body)
            .expect(statusCode, response, done);
    };

    var checkAccountingInfo = function (apiKey, accountingInfo, done) {
        db.getAccountingInfo(apiKey, function (err, res) {
            if (err) {
                done(err);
            } else {
                assert.deepEqual(res, accountingInfo);    
                done();
            }
        });
    };

    var checkDeletedSubscriptions = function (apiKey, subscriptions, done) {
        db.getCBSubscriptions(apiKey, function (err, result) {
            if (err) {
                done(err);
            } else {
                assert.deepEqual(result, subscriptions);
                done();
            }
        });
    };

    async.eachSeries(test_config.databases, function (database, taskCallback) {

        describe('with database: ' + database, function () {

            this.timeout(4000);

            // Clear the database and mock dependencies
            beforeEach(function (done) {
                this.timeout(5000);

                testUtil.clearDatabase(database, databaseName, function (err) {
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


            describe('[GET: ' + configMock.api.administration_paths.units + '] accounting units request', function () {

                it('should return all the accounting units (200) when the request is correct', function (done) {
                    request
                        .get(configMock.api.administration_paths.units)
                        .expect(200, {units: configMock.modules.accounting}, done);
                });
            });

            describe('[GET: ' +  configMock.api.administration_paths.keys + '] user api-keys request', function () {

                var path = 'keys';

                it('should return 401 when there is no authentication header', function (done) {
                    var expectedResp = {error: 'Auth-token not found in request headers'};

                    testAuthentication(path, 'get', undefined, 401, expectedResp, done);
                });

                it('should return 401 when the access token is not valid', function (done) {
                    var type = 'wrong';
                    var token = type + ' ' + userProfile.token;
                    var expectedResp = {error: 'Invalid Auth-Token type (' + type + ')'};

                    testAuthentication(path, 'get', token, 401, expectedResp, done);
                });

                it('should return 200 when there is no API key avilable', function (done) {
                    var token = 'bearer ' + userProfile.token;

                    testAuthentication(path, 'get', token, 200, [], done);
                });

                var testGetApiKeys = function (numApiKeys, done) {

                    var services = [ data.DEFAULT_SERVICES_LIST[0] ];
                    var buyInfos = [ data.DEFAULT_BUY_INFORMATION[0] ];

                    if (numApiKeys === 2) {
                        services.push(data.DEFAULT_SERVICES_LIST[1]);
                        buyInfos.push(data.DEFAULT_BUY_INFORMATION[1]);
                    }

                    testUtil.addToDatabase(db, services, buyInfos, [], [], [], [], [], function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get('/accounting_proxy/keys')
                                .set('authorization', 'bearer ' + userProfile.token)
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        var protocol = configMock.accounting_proxy.https.enabled ? 'https' : 'http';
                                        var baseUrl = protocol + '://' + 'localhost:' + configMock.accounting_proxy.port;
                                        assert.deepEqual(res.body[0], { apiKey: buyInfos[0].apiKey, productId: buyInfos[0].productId, orderId: buyInfos[0].orderId, url:  baseUrl + buyInfos[0].publicPath});
                                        if (numApiKeys === 2) {
                                            assert.deepEqual(res.body[1], { apiKey: buyInfos[1].apiKey, productId: buyInfos[1].productId, orderId: buyInfos[1].orderId, url:  baseUrl + buyInfos[1].publicPath});
                                        }
                                        done();
                                    }
                                });
                        }
                    });
                };

                it('should return the API key when the request is correct (1 API key)', function (done) {
                    testGetApiKeys(1, done);
                });

                it('should return the API keys when the request is correct (2 API keys)', function (done) {
                    testGetApiKeys(2, done);
                });
            });

            describe('[POST: ' + configMock.api.administration_paths.checkURL +'] checkURL request', function () {

                var path = 'checkURL';

                it('should return 401 when there is no authentication header', function (done) {
                    var expectedResp = {error: 'Auth-token not found in request headers'};

                    testAuthentication(path, 'post', undefined, 401, expectedResp, done);
                });

                it('should return 401 when the access token is not valid', function (done) {
                    var type = 'wrong';
                    var token = type + ' ' + userProfile.token;
                    var expectedResp = {error: 'Invalid Auth-Token type (' + type + ')'};

                    testAuthentication(path, 'post', token, 401, expectedResp, done);
                });

                it('should return 415 when the content-type is not "application/json"', function (done) {
                    var expectedResp = {error: 'Content-Type must be "application/json"'};

                    testBody(path, 'text/html', '', 415, expectedResp, done);
                });

                it('should return 422 when the body body is not correct', function (done) {
                    var expectedResp = {error: 'Missing URL'};

                    testBody(path, 'application/json', {}, 422, expectedResp, done);
                });

                it('should return 401 when the user is not an admin of the service', function (done) {
                    var url = 'http://localhost:9000/wrong_path';
                    var expectedResp = {error: 'Access restricted to administrators of the service only'};

                    testBody(path, 'application/json', {url: url}, 401, expectedResp, done);
                });

                it('should return 200 and update the token when the request is correct', function (done) {

                    var oldToken = 'oldToken';
                    var newToken = data.DEFAULT_TOKEN;
                    var service = data.DEFAULT_SERVICES_LIST[0];
                    var admin = {idAdmin: userProfile.id, publicPath: service.publicPath};
                    var url = 'http://localhost' + service.publicPath;

                    testUtil.addToDatabase(db, [service], [], [], [admin], [], [], oldToken, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .post(configMock.api.administration_paths.checkURL)
                                .set('content-type', 'application/json')
                                .set('authorization', 'bearer ' + userProfile.token)
                                .set('X-API-KEY', newToken)
                                .send({url: url})
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        return done(err);
                                    } else {
                                        db.getToken(function (err, token) {
                                            if (err) {
                                                done(err);
                                            } else {
                                                assert.equal(token, newToken);
                                                done();
                                            }
                                        })
                                    }
                                });
                        }
                    });
                });
            });

            describe('[POST: ' + configMock.api.administration_paths.newBuy +'] new buy request', function () {

                var path = 'newBuy';

                it('should return 415 when the content-type is not "application/json"', function (done) {
                    var expectedResp = {error: 'Content-Type must be "application/json"'};

                    testBody(path, 'text/html', '', 415, expectedResp, done);
                });

                it('should return 422 when the JSON format is not valid', function (done) {
                    var expectedResp = {error: 'Invalid json: "orderId" is required'};

                    testBody(path, 'application/json', {}, 422, expectedResp, done);
                });

                it('should save the buy information when the request is correct', function (done) {

                    var expectedApiKey = '8e96f1b1815e127ea645209830cbb40c72923408';
                    var service = data.DEFAULT_SERVICES_LIST[0];
                    var buy = {
                        orderId: data.DEFAULT_ORDER_IDS[0],
                        productId: data.DEFAULT_PRODUCT_IDS[0],
                        customer: data.DEFAULT_USER_ID,
                        productSpecification: {
                            url: 'http://localhost' + service.publicPath,
                            unit: data.DEFAULT_UNIT,
                            recordType: data.DEFAULT_RECORD_TYPE,
                        }
                    };

                    testUtil.addToDatabase(db, [service], [], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .post(configMock.api.administration_paths.newBuy)
                                .set('content-type', 'application/json')
                                .send(buy)
                                .expect(201, {'API-KEY': expectedApiKey})
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {

                                        var accountingInfo = { 
                                            unit: buy.productSpecification.unit,
                                            url: service.url
                                        } ;

                                        checkAccountingInfo(expectedApiKey, accountingInfo, done);
                                    }
                                });
                        }
                    });
                });
            });

            describe('[POST: ' + configMock.api.administration_paths.deleteBuy + '] delete buy request', function () {

                var path = 'deleteBuy';

                it('should return 415 when the content-type is not "application/json"', function (done) {
                    var expectedResp = {error: 'Content-Type must be "application/json"'};

                    testBody(path, 'text/html', '', 415, expectedResp, done);
                });

                it('should return 422 when the JSON format is not valid', function (done) {
                    var expectedResp = {error: 'Invalid json: "orderId" is required'};

                    testBody(path, 'application/json', {}, 422, expectedResp, done);
                });

                var testDeleteBuy = function (notification, subscription, done) {

                    var apiKey = '94c6e052c59756df3bafbb03284592e52e610edc';
                    var buyInfo = data.DEFAULT_BUY_INFORMATION[0];
                    buyInfo.apiKey = apiKey;
                    var deleteBuy = data.DEFAULT_DELETE_BUY_INFORMATION[0];
                    var token = data.DEFAULT_TOKEN;
                    var service = service = data.DEFAULT_SERVICES_LIST[0];
                    var subscriptions = [];
                    var accounting = [];
                    var units = ['call', 'megabyte'];
                    var hrefs = data.DEFAULT_HREFS;

                    configMock.modules = {
                        accounting: units
                    };

                    if (subscription) {
                        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                        var methods = data.DEFAULT_HTTP_METHODS_LIST;
                        var url = 'http://localhost:' + testConfig.test_endpoint_port;
                        service = {publicPath: publicPath, url: url, appId: userProfile.appId, isCBService: data.DEFAULT_IS_CB_SERVICE, methods: methods};

                        if (subscription === 'v1') {
                            subscriptions[0] = data.DEFAULT_SUBSCRIPTION_v1;
                            subscriptions[0].apiKey = apiKey;
                        } else {
                            subscriptions[0] = data.DEFAULT_SUBSCRIPTION_v2;
                            subscriptions[0].apiKey = apiKey;
                        }

                    } 

                    if (notification) {
                        accounting[0] = {
                            apiKey: apiKey,
                            value: 2
                        };
                    }

                    testUtil.addToDatabase(db, [service], [buyInfo], subscriptions, [], accounting, [], token, function (err) {
                        if (err) {
                            done(err);
                        } else {
                            request
                                .post(configMock.api.administration_paths.deleteBuy)
                                .set('content-type', 'application/json')
                                .send(deleteBuy)
                                .expect(204)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        async.series([
                                            function (callback) { // Check notified specifications
                                                if (notification) {
                                                    testUtil.checkUsageSpecifications(db, units, hrefs, callback);
                                                } else {
                                                    callback(null);
                                                }
                                            },
                                            function (callback) { // Check deleted subscriptions
                                                if (subscription) {
                                                    checkDeletedSubscriptions(apiKey, null, callback);
                                                } else {
                                                    callback(null);
                                                }
                                            },
                                            function (callback) { // Check deleted accounting info
                                                checkAccountingInfo(apiKey, null, callback);
                                            }
                                        ], done);
                                    }
                                });
                        }
                    });
                };

                it('should delete the buy when the accounting value is 0 and there are no subscriptions associated with the service', function (done) {
                    testDeleteBuy(false, null, done);
                });

                it('should delete the buy and notify the usage specifications and the accounting value when the accounting value is not 0 and the specifications have not been notified', function (done) {
                    testDeleteBuy(true, false, done);
                });

                it('should delete the buy, notify the accounting and cancel subscriptions (v1) when the accounting value is not 0 and there are subscriptions associated with the service', function (done) {
                    testDeleteBuy(true, 'v1', done);
                });

                it('should delete the buy, notify the accounting and cancel subscriptions (v2) when the accounting value is not 0 and there are subscriptions associated with the service', function (done) {
                    testDeleteBuy(true, 'v2', done);
                });
            });
        });
    });
});