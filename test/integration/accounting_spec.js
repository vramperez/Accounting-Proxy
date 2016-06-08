var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire'),
    testEndpoint = require('./test_endpoint'),
    async = require('async'),
    testConfig = require('../config_tests').integration,
    fs = require('fs'),
    util = require('../util'),
    data = require('../data'),
    redis = require('redis');

var request = request('http://localhost:' + testConfig.accounting_proxy_port);

var server, db;
var databaseName = 'testDB_accounting.sqlite';

var userProfile = data.DEFAULT_USER_PROFILE;
userProfile.token = data.DEFAULT_TOKEN;

var FIWAREStrategyMock = util.getStrategyMock(userProfile);

var DEFAULT_URL = 'http://localhost:' + testConfig.test_endpoint_port;

var configMock = util.getConfigMock(false);

var mocker = function (database, done) {

    var authenticationMock, accounterMock;

    if (database === 'sql') {

        configMock.database.type = './db';
        configMock.database.name = databaseName;

        db = proxyquire('../../db', {
            './config': configMock
        });

        authenticationMock = proxyquire('../../OAuth2_authentication', {
            'passport-fiware-oauth': FIWAREStrategyMock,
            './config': configMock,
            'winston': util.logMock,
            './db': db
        });

        accounterMock = proxyquire('../../accounter', {
            './config': configMock,
            './db': db
        });

        server = proxyquire('../../server', {
            './config': configMock,
            './db': db,
            'winston': util.logMock, // Not display logger messages while testing,
            'express-winston': util.expressWinstonMock,
            './OAuth2_authentication': authenticationMock,
            './accounter': accounterMock,
            './notifier': util.notifierMock
        });

    } else {

        var redis_host = testConfig.redis_host;
        var redis_port = testConfig.redis_port;

        if (! redis_host || ! redis_port) {
            done('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".');
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = testConfig.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../db_Redis', {
                './config': configMock
            });

            authenticationMock = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategyMock,
                './config': configMock,
                'winston': util.logMock,
                './db_Redis': db
            });

            accounterMock = proxyquire('../../accounter', {
                './config': configMock,
                './db_Redis': db
            });

            server = proxyquire('../../server', {
                './config': configMock,
                './db_Redis': db,
                'winston': util.logMock, // Not display logger messages while testing,
                'express-winston': util.expressWinstonMock,
                './OAuth2_authentication': authenticationMock,
                './accounter': accounterMock,
                './notifier': util.notifierMock
            });
        }
    }

    server.init(done);
}

// Start the enpoint for testing
before(function () {
    testEndpoint.run();
});

// Delete testing database
after(function (done) {
    testEndpoint.stop(function (err) {
        if (err) {
            done(err);
        } else {
            util.removeDatabase(databaseName, done);
        }
    });
});

describe('Testing the accounting API. Generic REST use', function () {
    
    async.eachSeries(testConfig.databases, function (database, taskCallback) {

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

            describe('ADMINISTRATOR', function () {

                var testAuthentication = function (autHeader, token, response, done) {

                    if (!token) {

                        request
                            .get('/public/resource')
                            .expect(401, response, done);

                    } else {

                        request
                            .get('/public/resource')
                            .set(autHeader, token)
                            .expect(401, response, done);

                    }
                };

                it('should return 401 when the header "authorization" is undefined', function (done) {
                    var expectedResp = { error: 'Auth-token not found in request headers'};

                    testAuthentication(undefined, undefined, expectedResp, done);
                });

                it('should return 401 when the authorization token is invalid', function (done) {
                    var type = 'wrong';
                    var token = type + ' ' + userProfile.token;
                    var expectedResp = { error: 'Invalid Auth-Token type (' + type + ')' };

                    testAuthentication('Authorization', token, expectedResp, done);
                });

                it('should return 401 when the token is from other application (wrong appId)', function (done) {
                    var expectedResp = {error: 'The auth-token scope is not valid for the current application'};

                    testAuthentication('x-auth-token', userProfile.token, expectedResp, done);
                });

                var testUserRequest = function (url, statusCode, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: url, appId: userProfile.appId};
                    var admin = {idAdmin: userProfile.id, publicPath: publicPath};

                    util.addToDatabase(db, [service], [], [], [admin], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.token)
                                .expect(statusCode, done);
                        }
                    });
                };

                it('should return 504 when an error occur sending request to the endpoint', function (done) {
                    testUserRequest('wrongURL', 504, done);
                });

                it('should return 200 when the request is correct', function (done) {
                   testUserRequest(DEFAULT_URL, 200, done);
                });
            });

            describe('USER', function () {

                it('should return 401 when the "X-API-KEY" header is undefined', function (done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL + '/rest/call', appId: userProfile.appId};

                    util.addToDatabase(db, [service], [], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get(publicPath + '/rest/call')
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
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', apiKey)
                                .expect(statusCode, response, done);
                        }
                    });                    
                };

                it('should return 401 when the API key or user is invalid', function (done) {
                    var expectedResp = { error: 'Invalid API_KEY or user'};

                    testRequestHandler('wrong', undefined, undefined, 401, expectedResp, done);
                });

                it('should return 504 when an error occur sending the request to the endpoint', function (done) {
                    var url = 'wrong_url';

                    testRequestHandler(undefined, url, undefined, 504, {}, done);
                });

                it('should return 500 when an error occur making the accounting (wrong unit)', function (done) {
                    testRequestHandler(undefined, undefined, 'wrongUnit', 500, {}, done);
                });

                var checkAssertions = function (apiKey, compareFunction, accountingValue, response, callback) {
                    util.getAccountingValue(db, apiKey, function (err, accValue) {
                        if (err) {
                            return callback(err);
                        } else {

                            assert[compareFunction](accValue, accountingValue);

                            fs.readFile('./test/integration/ejemplo.html', function (err, html) {

                                if (err) {
                                    return callback(err);
                                } else {
                                    assert.equal(response, html);
                                    return callback();
                                }
                            });
                        }
                    });
                };

                var testCorrectRequest = function (unit, compareFunction, amount, done) {

                    var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                    var service = {publicPath: publicPath, url: DEFAULT_URL, appId: userProfile.appId};
                    var buyInfo = JSON.parse(JSON.stringify(data.DEFAULT_BUY_INFORMATION[0]));
                    buyInfo.unit = unit;

                    util.addToDatabase(db, [service], [buyInfo], [], [], [], [], null, function (err) {
                        if (err) {
                            done(err);
                        } else {

                            request
                                .get(publicPath + '/rest/' + unit)
                                .set('x-auth-token', userProfile.token)
                                .set('X-API-KEY', buyInfo.apiKey)
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        checkAssertions(buyInfo.apiKey, compareFunction, amount, res.text, done);
                                    }
                                });
                        }
                    });
                };

                it('should return 200, the service response and make the accounting using call unit when there is no error', function (done) {
                    testCorrectRequest('call', 'equal', 1, done);
                });

                it('should return 200, the service response and make the accounting using megabyte unit when there is no error', function (done) {
                    testCorrectRequest('megabyte', 'equal', 0.16722679138183594, done);
                });

                it('should return 200, the service response and make the accounting using millisecond unit when there is no error', function (done) {
                    testCorrectRequest('megabyte', 'notEqual', 0, done);
                });
            });
        });
    });
});