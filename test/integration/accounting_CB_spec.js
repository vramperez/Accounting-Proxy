var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    test_endpoint = require('./test_endpoint'),
    test_config = require('../config_tests').integration,
    async = require('async'),
    fs = require('fs'),
    prepare_test = require('./prepareDatabase'),
    redis = require('redis');

var server, db_mock, cb_handler_mock, authentication_mock;
var mock_config = {};

var logger_mock = { // Avoid display server information while running the tests
    Logger: function (transports) {
        return {
            log: function (level, msg) {},
            info: function (msg) {},
            warn: function (msg) {},
            error: function (msg) {}
        } 
    }
};

var api_mock = {
    checkIsJSON: function () {},
    checkUrl: function () {},
    newBuy: function () {},
    getApiKeys: function (){},
    getUnits: function () {}
};

var notifier_mock = {
    notify: function (info) {}
};

var log_mock = {
    log: function (level, msg) {},
    info: function (msg) {},
    warn: function (msg) {},
    error: function (msg) {}
};

var mock_config = {
    accounting_proxy: {
        port: 9000
    },
    resources: {
        contextBroker: true
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
    }
};

var userProfile = {
    accessToken: 'accessToken',
    id: 'userId',
    emails: [{value: 'user@example.com'}],
    displayName: 'userName',
    roles: [{id: '106'}],
    appId: 'appId'
};

var FIWAREStrategy_mock = {
    OAuth2Strategy: function (options, callback) {
        return {
            userProfile: function (authToken, callback) {
                return callback(null, userProfile);
            }
        }
    }
};

var mocker = function (database, done) {
    switch (database) {
        case 'sql':
            async.series([
                function (callback) {
                    mock_config.database.type = './db';
                    mock_config.database.name = 'testDB_accounting.sqlite';
                    db_mock = proxyquire('../../db', {
                        './config': mock_config
                    });
                    callback(null);
                },
                function (callback) {
                    authentication_mock = proxyquire('../../OAuth2_authentication', {
                        'passport-fiware-oauth': FIWAREStrategy_mock,
                        './config': mock_config,
                        'winston': log_mock,
                        './db': db_mock
                    });
                    callback(null);
                },
                function (callback) {
                    cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
                        '../config': mock_config,
                        'winston': log_mock,
                        '.././db': db_mock
                    });
                    callback(null);
                }, function (callback) {
                    server = proxyquire('../../server', {
                        './config': mock_config,
                        './db': db_mock,
                        './APIServer': api_mock,
                        './notifier': notifier_mock,
                        'winston': log_mock, // Not display logger messages while testing
                        './orion_context_broker/cb_handler': cb_handler_mock,
                        'OAuth2_authentication': authentication_mock
                    });
                    callback(null);
                }
            ], function () {
                db_mock.init(function (err) {
                    if (err) {
                        console.log('Error initializing the database');
                        process.exit(1);
                    } else {
                        return done();
                    }
                });
            })
            break;
        case 'redis':
            async.series([
                function (callback) {
                    mock_config.database.type = './db_Redis';
                    mock_config.database.name = test_config.database_redis;
                    db_mock = proxyquire('../../db_Redis', {
                        './config': mock_config
                    });
                    callback(null);
                },
                function (callback) {
                    authentication_mock = proxyquire('../../OAuth2_authentication', {
                        'passport-fiware-oauth': FIWAREStrategy_mock,
                        './config': mock_config,
                        'winston': log_mock,
                        './db_Redis': db_mock
                    });
                    callback(null);
                },
                function (callback) {
                   cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
                        '../config': mock_config,
                        'winston': log_mock,
                        '.././db_Redis': db_mock
                    });
                    callback(null);
                }, function (callback) {
                    server = proxyquire('../../server', {
                        './config': mock_config,
                        './db_Redis': db_mock,
                        './APIServer': api_mock,
                        './notifier': notifier_mock,
                        'winston': log_mock, // Not display logger messages while testing
                        './orion_context_broker/cb_handler': cb_handler_mock,
                        'OAuth2_authentication': authentication_mock
                    });
                    callback(null);
                }
            ], function () {
                db_mock.init(function (err) {
                    if (err) {
                        console.log('Error initializing the database');
                        process.exit(1);
                    } else {
                        return done();
                    }
                });
            })
            break;
    }
};

var checkAccounting = function (apiKey, value, callback) {
    db_mock.getNotificationInfo(function (err, allAccInfo) {
        if (err) {
            console.log('Error checking the accounting');
            return callback();
        } else {
            async.each(allAccInfo, function (accInfo, task_callback) {
                if(accInfo.apiKey === apiKey) {
                    assert.equal(accInfo.value, value);
                    return callback();
                } else {
                    task_callback();
                }
            });
        }
    });
};

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(test_config.accounting_CB_port);

async.each(test_config.databases, function (database, task_callback) {

    describe('Testing the accounting API. Orion Context-Broker requests', function () {

        before(function (done) {
            mocker(database, done);
        });

        after(function (task_callback) {
            if (database === 'sql') {
                fs.access('./testDB_accounting.sqlite', fs.F_OK, function (err) {
                    if (!err) {
                        fs.unlinkSync('./testDB_accounting.sqlite');
                    }
                });
                task_callback();
            } else {
                var client = redis.createClient();
                client.select(test_config.database_redis, function (err) {
                    if (err) {
                        console.log('Error deleting redis database');
                        task_callback();
                    } else {
                        client.flushdb();
                        task_callback();
                    }
                });
            }
        });

        describe('with database ' + database, function () {

            it('undefined "X-API-KEY" header', function (done) {
                var publicPath = '/public1';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                prepare_test.addToDatabase(db_mock, services, [], [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .expect(401, { error: 'Undefined "X-API-KEY" header'}, done);
                    }
                });
            });

            it('invalid api-key or user', function (done) {
                var publicPath = '/public2';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url , appId: userProfile.appId}];
                var buys = [{
                    apiKey: 'apiKey1',
                    publicPath: publicPath,
                    orderId: 'orderId1',
                    productId: 'productId1',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', 'wrong')
                        .expect(401, { error: 'Invalid API_KEY or user'}, done);
                    }
                });
            });

            it('error sending the request to endpoint (504)', function (done) {
                var publicPath = '/public3';
                var url = 'wrong';
                var apiKey = 'apiKey2';
                var services = [{publicPath: publicPath, url: url , appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId2',
                    productId: 'productId2',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(504, done);
                    }
                });
            });

            it('error making th accounting, wrong unit (500)', function (done) {
                var publicPath = '/public4';
                var apiKey = 'apiKey3';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId3',
                    productId: 'productId3',
                    customer: userProfile.id,
                    unit: 'wrong',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, done);
                    }
                });
            });

            it('Get entity (200), correct accounting (megabyte unit)', function (done) {
                var publicPath = '/public5';
                var apiKey = 'apiKey4';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId4',
                    productId: 'productId4',
                    customer: userProfile.id,
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 0.00022125244140625, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('Get entity (200), correct accounting (call unit)', function (done) {
                var publicPath = '/public6';
                var apiKey = 'apiKey5';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId5',
                    productId: 'productId5',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEntity/Room1')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 1, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('Get all entities (200), correct accounting (megabyte unit)', function (done) {
                var publicPath = '/public7';
                var apiKey = 'apiKey6';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId6',
                    productId: 'productId6',
                    customer: userProfile.id,
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEnties')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 0.00002765655517578125, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('Get all entities (200), correct accounting (call unit)', function (done) {
                var publicPath = '/public8';
                var apiKey = 'apiKey7';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId7',
                    productId: 'productId7',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextEnties')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 1, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('Browse all types and detailed information (200), correct accounting (megabyte unit)', function (done) {
                var publicPath = '/public9';
                var apiKey = 'apiKey8';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId8',
                    productId: 'productId8',
                    customer: userProfile.id,
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextTypes')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 0.0001773834228515625, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('Browse all types and detailed information (200), correct accounting (call unit)', function (done) {
                var publicPath = '/public9';
                var apiKey = 'apiKey8';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId8',
                    productId: 'productId8',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .get(publicPath + '/v1/contextTypes')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .expect(500, function () {
                            checkAccounting(buys[0].apiKey, 1, function () {
                                done();
                            });
                        });
                    }
                });
            });

            it('[Subscribe] Error, "content-type" different from "application/json"', function (done) {
                var publicPath = '/public10';
                var apiKey = 'apiKey9';
                var url = 'http://localhost';
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId9',
                    productId: 'productId9',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {
                    "entities": [
                        {
                            "type": "Room",
                            "isPattern": "false",
                            "id": "Room1"
                        }
                    ],
                    "attributes": [
                        "temperature"
                    ],
                    "reference": "http://localhost:1028/accumulate",
                    "duration": "P1M",
                    "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": [
                                "pressure"
                            ]
                        }
                    ],
                    "throttling": "PT5S"
                }
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/subscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'text/plain')
                        .send(JSON.stringify(payload))
                        .expect(415, { error: 'Content-Type must be "application/json"' }, done);
                    }
                });
            });

            it('[Subscribe] Error sending the request to Context-Broker (504)', function (done) {
                var publicPath = '/public10';
                var apiKey = 'apiKey9';
                var url = 'http://localhost';
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId9',
                    productId: 'productId9',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {
                    "entities": [
                        {
                            "type": "Room",
                            "isPattern": "false",
                            "id": "Room1"
                        }
                    ],
                    "attributes": [
                        "temperature"
                    ],
                    "reference": "http://localhost:1028/accumulate",
                    "duration": "P1M",
                    "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": [
                                "pressure"
                            ]
                        }
                    ],
                    "throttling": "PT5S"
                }
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/subscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'application/json')
                        .type('json')
                        .send(JSON.stringify(payload))
                        .expect(504, done);
                    }
                });
            });

            it('[Subscribe] Correct subscription (200)', function (done) {
                var publicPath = '/public11';
                var apiKey = 'apiKey10';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId10',
                    productId: 'productId10',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {
                    "entities": [
                        {
                            "type": "Room",
                            "isPattern": "false",
                            "id": "Room1"
                        }
                    ],
                    "attributes": [
                        "temperature"
                    ],
                    "reference": "http://localhost:1028/accumulate",
                    "duration": "P1M",
                    "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": [
                                "pressure"
                            ]
                        }
                    ],
                    "throttling": "PT5S"
                }
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/subscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'application/json')
                        .type('json')
                        .send(JSON.stringify(payload))
                        .expect(200)
                        .end(function (err, res) {
                            db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function (err, subsInfo) {
                                assert.equal(err, null);
                                assert.deepEqual(subsInfo, {
                                    apiKey: apiKey,
                                    notificationUrl: payload["reference"],
                                    unit: buys[0].unit
                                });
                                done();
                            });
                        });
                    }
                });
            });

            it('[ubscribe] Error sending the request to Context-Broker (504)', function (done) {
                var publicPath = '/public12';
                var apiKey = 'apiKey11';
                var url = 'http://localhost';
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId11',
                    productId: 'productId11',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {};
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/unsubscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'application/json')
                        .type('json')
                        .send(JSON.stringify(payload))
                        .expect(504, done);
                    }
                });
            });

            it('[Unubscribe (POST)] Correct subscription (200)', function (done) {
                var publicPath = '/public13';
                var apiKey = 'apiKey12';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId12',
                    productId: 'productId12',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {
                    "entities": [
                        {
                            "type": "Room",
                            "isPattern": "false",
                            "id": "Room1"
                        }
                    ],
                    "attributes": [
                        "temperature"
                    ],
                    "reference": "http://localhost:1028/accumulate",
                    "duration": "P1M",
                    "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": [
                                "pressure"
                            ]
                        }
                    ],
                    "throttling": "PT5S"
                };
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/subscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'application/json')
                        .type('json')
                        .send(JSON.stringify(payload))
                        .expect(200)
                        .end(function (err, res) {
                            db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function (err, subsInfo) {
                                assert.equal(err, null);
                                assert.deepEqual(subsInfo, { apiKey: apiKey,
                                    notificationUrl: payload["reference"],
                                    unit: buys[0].unit
                                });
                                request(server.app)
                                .post(publicPath + '/v1/unsubscribeContext')
                                .set('content-type', 'application/json')
                                .set('X-API-KEY', apiKey)
                                .type('json')
                                .send(JSON.stringify({"subscriptionId": res.body.subscribeResponse.subscriptionId}))
                                .expect(200)
                                .end(function (err, res) {
                                    db_mock.getCBSubscription(res.body.subscriptionId, function (err, subsInfo) {
                                        assert.equal(err, null);
                                        assert.equal(subsInfo, null);
                                        done();
                                    });
                                });
                            });
                        });
                    }
                });
            });

            it('[Unubscribe (DELETE)] Correct subscription (200)', function (done) {
                var publicPath = '/public14';
                var apiKey = 'apiKey13';
                var url = 'http://localhost:' + test_config.accounting_CB_port;
                var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: 'orderId13',
                    productId: 'productId13',
                    customer: userProfile.id,
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var payload = {
                    "entities": [
                        {
                            "type": "Room",
                            "isPattern": "false",
                            "id": "Room1"
                        }
                    ],
                    "attributes": [
                        "temperature"
                    ],
                    "reference": "http://localhost:1028/accumulate",
                    "duration": "P1M",
                    "notifyConditions": [
                        {
                            "type": "ONCHANGE",
                            "condValues": [
                                "pressure"
                            ]
                        }
                    ],
                    "throttling": "PT5S"
                };
                prepare_test.addToDatabase(db_mock, services, buys, [], [], function (err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                        .post(publicPath + '/v1/subscribeContext')
                        .set('x-auth-token', userProfile.accessToken)
                        .set('X-API-KEY', apiKey)
                        .set('content-type', 'application/json')
                        .type('json')
                        .send(JSON.stringify(payload))
                        .expect(200)
                        .end(function (err, res) {
                            db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function (err, subsInfo) {
                                assert.equal(err, null);
                                assert.deepEqual(subsInfo, { apiKey: apiKey,
                                    notificationUrl: payload["reference"],
                                    unit: buys[0].unit
                                });
                                request(server.app)
                                .delete(publicPath + '/v1/unsubscribeContext' + res.body.subscribeResponse.subscriptionId)
                                .set('content-type', 'application/json')
                                .set('X-API-KEY', apiKey)
                                .type('json')
                                .send(JSON.stringify({"subscriptionId": res.body.subscribeResponse.subscriptionId}))
                                .expect(200)
                                .end(function (err, res) {
                                    db_mock.getCBSubscription(res.body.subscriptionId, function (err, subsInfo) {
                                        assert.equal(err, null);
                                        assert.equal(subsInfo, null);
                                        done();
                                    });
                                });
                            });
                        });
                    }
                });
            });
        });
    });
});