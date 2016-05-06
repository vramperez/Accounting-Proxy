var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    test_endpoint = require('./test_endpoint'),
    async = require('async'),
    test_config = require('../config_tests').integration,
    fs = require('fs'),
    prepare_test = require('./prepareDatabase'),
    redis = require('redis');

var server, db_mock, accounter_mock;
var databaseName = 'testDB_accounting.sqlite';

var mock_config = {
    accounting_proxy: {
        port: 9000
    },
    resources: {
        contextBroker: false
    },
    database: {},
    api: {
        administration_paths: {
            keys: '/accounting_proxy/keys',
            units: '/accounting_proxy/units',
            newBuy: '/accounting_proxy/buys',
            checkUrl: '/accounting_proxy/urls',
        }
    },
    oauth2: {
        roles: {
            'admin': '106',
            'customer': '',
            'seller': ''
        }
    },
    log: {
        file: 'file'
    }
};

var api_mock = {
    checkIsJSON: function () {},
    checkUrl: function () {},
    newBuy: function () {},
    getApiKeys: function (){},
    getUnits: function () {}
}

var notifier_mock = {
    notifyUsageSpecification: function (callback) {
        return callback(null);
    },
    notifyUsage: function (callback) {
        return cllback(null);
    },
    acc_modules: {
        megabyte: require('../../acc_modules/megabyte'),
        call: require('../../acc_modules/call'),
        millisecond: require('../../acc_modules/millisecond')
    }
}

var log_mock = {
    log: function (level, msg) {},
    info: function (msg) {},
    warn: function (msg) {},
    error: function (msg) {},
    transports: {
        File: function (options) {}
    }
}

var userProfile = {
    accessToken: 'accessToken',
    id: 'userId',
    emails: [{value: 'user@example.com'}],
    displayName: 'userName',
    roles: [{id: '106'}],
    appId: 'appId'
}

var FIWAREStrategy_mock = {
    OAuth2Strategy: function (options, callback) {
        return {
            userProfile: function (authToken, callback) {
                return callback(null, userProfile);
            }
        }
    }
}

var expressWinston_mock = {
    logger: function (options) {
        return function (req, res, next) {
            next();
        };
    }
};

var mocker = function (database, done) {
    if (database === 'sql') {
        mock_config.database.type = './db';
        mock_config.database.name = databaseName;
        db_mock = proxyquire('../../db', {
            './config': mock_config
        });
        authentication_mock = proxyquire('../../OAuth2_authentication', {
            'passport-fiware-oauth': FIWAREStrategy_mock,
            './config': mock_config,
            'winston': log_mock,
            './db': db_mock
        });
        accounter_mock = proxyquire('../../accounter', {
            './config': mock_config,
            './notifier': notifier_mock,
            './db': db_mock
        });
        server = proxyquire('../../server', {
            './config': mock_config,
            './db': db_mock,
            './APIServer': api_mock,
            './notifier': {},
            'winston': log_mock, // Not display logger messages while testing,
            'express-winston': expressWinston_mock,
            './orion_context_broker/cb_handler': {},
            'OAuth2_authentication': authentication_mock,
            './accounter': accounter_mock
        });
    } else {
        var redis_host = test_config.redis_host;
        var redis_port = test_config.redis_port;

        if (! redis_host || ! redis_port) {
            console.log('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".')
            process.exit(1);
        } else {
            mock_config.database.type = './db_Redis';
            mock_config.database.name = test_config.redis_database;
            mock_config.database.redis_host = redis_host;
            mock_config.database.redis_port = redis_port;
            db_mock = proxyquire('../../db_Redis', {
                './config': mock_config
            });
            authentication_mock = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategy_mock,
                './config': mock_config,
                'winston': log_mock,
                './db_Redis': db_mock
            });
            accounter_mock = proxyquire('../../accounter', {
                './config': mock_config,
                './notifier': notifier_mock,
                './db_Redis': db_mock
            });
            server = proxyquire('../../server', {
                './config': mock_config,
                './db_Redis': db_mock,
                './APIServer': api_mock,
                './notifier': {},
                'winston': log_mock, // Not display logger messages while testing,
                'express-winston': expressWinston_mock,
                './orion_context_broker/cb_handler': {},
                'OAuth2_authentication': authentication_mock,
                './accounter': accounter_mock
            });
        }
    }
    db_mock.init(function (err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        } else {
            return done();
        }
    });
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(test_config.accounting_port);

after(function (done) {
    prepare_test.removeDatabase(databaseName, done);
});

describe('Testing the accounting API. Generic REST use', function () {
    
    async.eachSeries(test_config.databases, function (database, task_callback) {

        describe('with database ' + database, function () {

            before(function (done) {
                prepare_test.clearDatabase(database, databaseName, function (err) {
                    mocker(database, done);
                });
            });

            after(function () {
                task_callback();
            });

            describe('ADMINISTRATOR', function () {

                it('should fail (401) when the header "authorization" is undefined', function (done) {
                    request(server.app)
                        .get('/public/resource')
                        .expect(401, { error: 'Auth-token not found in request headers'}, done);
                });

                it('should fail (401) when the authorization token is invalid', function (done) {
                    var type = 'wrong';
                    request(server.app)
                        .get('/public/resource')
                        .set('authorization', type + ' token')
                        .expect(401, { error: 'Invalid Auth-Token type (' + type + ')' }, done);
                });

                it('should fail (401) when the token is from other application (wrong appId)', function (done) {
                    request(server.app)
                        .get('/public/resource')
                        .set('x-auth-token', userProfile.accessToken)
                        .expect(401, {error: 'The auth-token scope is not valid for the current application'}, done);
                });

                it('should fail (504) when an error occur sending request to the endpoint', function (done) {
                    var publicPath = '/public1';
                    var services = [{publicPath: publicPath, url: 'wrong_url', appId: userProfile.appId}];
                    var admins = [{idAdmin: userProfile.id, publicPath: publicPath}];
                    prepare_test.addToDatabase(db_mock, services, [], [], admins, [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .expect(504, done);
                        }
                    });
                });

                it('should succes when the request is correct', function (done) {
                    var publicPath = '/public2';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    var admins = [{idAdmin: userProfile.id, publicPath: publicPath}];
                    prepare_test.addToDatabase(db_mock, services, [], [], admins, [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .expect(200, done);
                        }
                    });
                });
            });

            describe('USER', function () {

                it('should fail (401) when the "X-API-KEY" header is undefined', function (done) {
                    var publicPath = '/public3';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    prepare_test.addToDatabase(db_mock, services, [], [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .expect(401, { error: 'Undefined "X-API-KEY" header'}, done);
                        }
                    });
                });

                it('should fail (401) when api-key or user is invalid', function (done) {
                    var publicPath = '/public4';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    var buys = [{
                        apiKey: 'apiKey1',
                        publicPath: publicPath,
                        orderId: 'orderId1',
                        productId: 'productId1',
                        customer: userProfile.id,
                        unit: 'call',
                        recordType: 'callusage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', 'wrong')
                                .expect(401, { error: 'Invalid API_KEY or user'}, done);
                        }
                    });
                });

                it('should fail (504) when an error occur sending the request to the endpoint', function (done) {
                    var publicPath = '/public5';
                    var apiKey = 'apiKey2';
                    var url = 'wring_url';
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId2',
                        productId: 'productId2',
                        customer: userProfile.id,
                        unit: 'call',
                        recordType: 'callusage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', apiKey)
                                .expect(504, done);
                        }
                    });
                });

                it('should fail (401) when an error occur making the accounting (wrong unit)', function (done) {
                    var publicPath = '/public6';
                    var apiKey = 'apiKey3';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId3',
                        productId: 'productId3',
                        customer: userProfile.id,
                        unit: 'wrong',
                        recordType: 'callusage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', apiKey)
                                .expect(500, done);
                        }
                    });
                });

                it('should get the correct information and make the accounting using call unit', function (done) {
                    var publicPath = '/public7';
                    var apiKey = 'apiKey3';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId4',
                        productId: 'productId4',
                        customer: userProfile.id,
                        unit: 'call',
                        recordType: 'callusage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/call')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', apiKey)
                                .expect(200)
                                .expect(function (res) {
                                    db_mock.getNotificationInfo(function (err, accInfo) {
                                        async.eachSeries(accInfo, function (acc, task_callback) {
                                            if (acc.apiKey === apiKey) {
                                                assert.equal(err, null);
                                                assert.deepEqual(acc, {
                                                    apiKey: apiKey,
                                                    correlationNumber: '0',
                                                    customer: buys[0].customer,
                                                    orderId: buys[0].orderId,
                                                    productId: buys[0].productId,
                                                    recordType: buys[0].recordType,
                                                    unit: buys[0].unit,
                                                    value: '1'
                                                });
                                                task_callback();
                                            } else {
                                                task_callback();
                                            }
                                        });
                                    });
                                })
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        done();
                                    }
                                });
                        }
                    });
                });

                it('should get the correct information and make the accounting using megabyte unit', function (done) {
                    var publicPath = '/public8';
                    var apiKey = 'apiKey4';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId5',
                        productId: 'productId5',
                        customer: userProfile.id,
                        unit: 'megabyte',
                        recordType: 'amountData'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/megabyte')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', apiKey)
                                .expect(200)
                                .expect(function (res) {
                                    db_mock.getNotificationInfo(function (err, accInfo) {
                                        async.eachSeries(accInfo, function (acc, task_callback) {
                                            if (acc.apiKey === apiKey) {
                                                assert.equal(err, null);
                                                assert.deepEqual(acc, {
                                                    apiKey: apiKey,
                                                    correlationNumber: '0',
                                                    customer: buys[0].customer,
                                                    orderId: buys[0].orderId,
                                                    productId: buys[0].productId,
                                                    recordType: buys[0].recordType,
                                                    unit: buys[0].unit,
                                                    value: '0.16722679138183594'
                                                });
                                                task_callback();
                                            } else {
                                                task_callback();
                                            }
                                        });
                                    });
                                })
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        done();
                                    }
                                });
                        }
                    });
                });

                it('should get the correct information and make the accounting using millisecond unit', function (done) {
                    var publicPath = '/public9';
                    var apiKey = 'apiKey5';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId6',
                        productId: 'productId6',
                        customer: userProfile.id,
                        unit: 'millisecond',
                        recordType: 'timeUsage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], [], [], null, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .get(publicPath + '/rest/megabyte')
                                .set('x-auth-token', userProfile.accessToken)
                                .set('X-API-KEY', apiKey)
                                .expect(200)
                                .expect(function (res) {
                                    db_mock.getNotificationInfo(function (err, accInfo) {
                                        async.eachSeries(accInfo, function (acc, task_callback) {
                                            if (acc.apiKey === apiKey) {
                                                assert.equal(err, null);
                                                assert.equal(acc.apiKey, apiKey);
                                                assert.equal(acc.correlationNumber, '0');
                                                assert.equal(acc.customer, buys[0].customer);
                                                assert.equal(acc.orderId, buys[0].orderId);
                                                assert.equal(acc.productId, buys[0].productId);
                                                assert.equal(acc.recordType, buys[0].recordType);
                                                assert.equal(acc.unit, buys[0].unit);
                                                assert.notEqual(acc.value, 0);
                                                task_callback();
                                            } else {
                                                task_callback();
                                            }
                                        });
                                    });
                                })
                                .end(function (err, res) {
                                    if (err) {
                                        done(err);
                                    } else {
                                        done();
                                    }
                                });
                        }
                    });
                });
            });
        });
    });
});