var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    redis_mock = require('fakeredis'),
    test_endpoint = require('./test_endpoint'),
    test_config = require('../config_tests').integration,
    async = require('async'),
    fs = require('fs'),
    prepare_test = require('./prepareDatabase'),
    redis = require('redis');

var server, db_mock, cb_handler_mock;
var mock_config = {};

var logger_mock = { // Avoid display server information while running the tests
    Logger: function(transports) {
        return {
            log: function(level, msg) {},
            info: function(msg) {},
            warn: function(msg) {},
            error: function(msg) {}
        } 
    }
}

var api_mock = {
    run: function(){}
}
var notifier_mock = {
    notify: function(info) {}
}

var log_mock = {
    log: function(level, msg) {},
    info: function(msg) {},
    warn: function(msg) {},
    error: function(msg) {}
}

var mock_config = {
    accounting_proxy: {
        port: 9000
    },
    resources: {
        contextBroker: true
    }
}

var mocker = function(database) {
    switch (database) {
        case 'sql':
            mock_config.database = {
                type: './db',
                name: 'testDB_accounting.sqlite'
            }
            db_mock = proxyquire('../../db', {
                './config': mock_config
            });
            cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
                '../config': mock_config,
                '.././db': db_mock
            });
            break;
        case 'redis':
            mock_config.database = {
                type: './db_Redis',
                name: 15
            }
            db_mock = proxyquire('../../db_Redis', {
                './config': mock_config
            });
            cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
                '../config': mock_config,
                '.././db_Redis': db_mock
            });
            break;
    }
    server = proxyquire('../../server', {
        './config': mock_config,
        './db': db_mock,
        './APIServer': api_mock,
        './notifier': notifier_mock,
        './orion_context_broker/cb_handler': cb_handler_mock,
        'winston': {
            Logger: function(transports) {
                return log_mock;
            },
            transports: {
                File: function(params) {},
                Console: function(params) {}
            }
        }
    });
    db_mock.init(function(err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        }
    });
}

var checkAccounting = function(apiKey, value, callback) {
    db_mock.getNotificationInfo(function(err, allAccInfo) {
        if (err) {
            console.log('Error checking the accounting');
            return callback();
        } else {
            async.each(allAccInfo, function(accInfo, task_callback) {
                if(accInfo.apiKey === apiKey) {
                    assert.equal(accInfo.value, value);
                    return callback();
                } else {
                    task_callback();
                }
            });
        }
    });
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(test_config.accounting_CB_port);

async.each(test_config.databases, function(database, task_callback) {  
    
    describe('Testing the accounting API. Orion Context-Broker requests', function() { 

        describe('with database ' + database, function() { 

            before(function() {
                mocker(database);
            });

            after(function(task_callback) {
                if (database === 'sql') {
                    fs.access('./testDB_accounting.sqlite', fs.F_OK, function(err) {
                        if (!err) {
                            fs.unlinkSync('./testDB_accounting.sqlite');
                        }
                    });
                    task_callback();
                } else {
                    var client = redis.createClient();
                    client.select(test_config.database_redis, function(err) {
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

            it('undefined header "X-Actor-ID" (401)', function(done) {
                request(server.app)
                .get('/private')
                .expect(401, { error: 'Undefined "X-Actor-ID" header'}, done);
            });

            it('undefined header "X-API-KEY" (401)', function(done) {
                request(server.app)
                    .get('/private')
                    .set('X-Actor-ID', '0001')
                    .expect(401, { error: 'Undefined "X-API-KEY" header'}, done);
            });

            it('invalid apiKey (401)', function(done) {
                var services = [{ publicPath: '/contextBroker1', url: 'http://localhost:9000/private1'}];
                var buys = [{
                    apiKey: 'apiKey1',
                    publiPath: services[0].publicPath,
                    orderId: 'orderId1',
                    productId: 'productId1',
                    customer: '0001',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get('/private')
                            .set('X-Actor-ID', '0001')
                            .set('X-API-KEY', 'wrong')
                            .expect(401, { error: 'Invalid API_KEY or user'}, done);
                    }
                });
            });

            it('invalid user (401)', function(done) {
                var services = [{ publicPath: '/public2', url: 'http://localhost:9000/private2'}];
                var buys = [{
                    apiKey: 'apiKey2',
                    publiPath: services[0].publicPath,
                    orderId: 'orderId2',
                    productId: 'productId2',
                    customer: '0002',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get('/private')
                            .set('X-Actor-ID', '0002')
                            .set('X-API-KEY', 'wrong')
                            .expect(401, { error: 'Invalid API_KEY or user'}, done);
                    }
                });
            });

            it('Invalid path (400)', function(done) {
                var services = [ { publicPath: '/public3', url: 'http://localhost:9000/private3' } ];
                var buys = [{
                    apiKey: 'apiKey3',
                    publicPath: '/public3',
                    orderId: 'orderId3',
                    productId: 'productId3',
                    customer: '0003',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                var path = '/wrong';
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(path)
                            .set('X-Actor-ID', '0003')
                            .set('X-API-KEY', 'apiKey3')
                            .expect(400, { error: 'Invalid public path ' + path}, done);
                    }
                });
            });

            it('Error sending request to the Context Broker (504)', function(done) {
                var services = [ { publicPath: '/public4', url: 'wrong_url'} ];
                var buys = [{
                    apiKey: 'apiKey4',
                    publicPath: '/public4',
                    orderId: 'orderId4',
                    productId: 'productId4',
                    customer: '0004',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath)
                            .set('X-Actor-ID', '0004')
                            .set('X-API-KEY', 'apiKey4')
                            .expect(504, done);
                    }
                });
            });

            it('Get entity (200), correct accounting (megabyte unit)', function(done) {
                var services = [ {publicPath: '/public5', url: 'http://localhost:' + test_config.accounting_CB_port } ];
                var buys = [{
                    apiKey: 'apiKey5',
                    publicPath: '/public5',
                    orderId: 'orderId5',
                    productId: 'productId5',
                    customer: '0005',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath + '/v1/contextEntity/Room1')
                            .set('X-Actor-ID', '0005')
                            .set('X-API-KEY', 'apiKey5')
                            .expect(200, function() {
                                checkAccounting(buys[0].apiKey, 0.00022125244140625, function() {
                                    done();
                                });
                        });
                    }
                });
            });

            it('Get entity (200), correct accounting (call unit)', function(done) {
                var services = [ {publicPath: '/public6', url: 'http://localhost:' + test_config.accounting_CB_port } ];
                var buys = [{
                    apiKey: 'apiKey6',
                    publicPath: '/public6',
                    orderId: 'orderId6',
                    productId: 'productId6',
                    customer: '0006',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath + '/v1/contextEntity/Room1')
                            .set('X-Actor-ID', '0006')
                            .set('X-API-KEY', 'apiKey6')
                            .expect(200, function() {
                                checkAccounting(buys[0].apiKey, 1, function() {
                                    done();
                                });
                        });
                    }
                });
            });

            it('Get all entities (200), correct accounting (megabyte unit)', function(done) {
                var services = [ {publicPath: '/public7', url: 'http://localhost:' + test_config.accounting_CB_port } ];
                var buys = [{
                    apiKey: 'apiKey7',
                    publicPath: '/public7',
                    orderId: 'orderId7',
                    productId: 'productId7',
                    customer: '0007',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath + '/v1/contextEnties')
                            .set('X-Actor-ID', '0007')
                            .set('X-API-KEY', 'apiKey7')
                            .expect(200, function() {
                                checkAccounting(buys[0].apiKey, 0.00002765655517578125, function() {
                                    done();
                                });
                        });
                    }
                });
            });

            it('Get all entities (200), correct accounting (call unit)', function(done) {
                var services = [ {publicPath: '/public8', url: 'http://localhost:' + test_config.accounting_CB_port } ];
                var buys = [{
                    apiKey: 'apiKey8',
                    publicPath: '/public8',
                    orderId: 'orderId8',
                    productId: 'productId8',
                    customer: '0008',
                    unit: 'call',
                    recordType: 'callusage'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath + '/v1/contextEnties')
                            .set('X-Actor-ID', '0008')
                            .set('X-API-KEY', 'apiKey8')
                            .expect(200, function() {
                                checkAccounting(buys[0].apiKey, 1, function() {
                                    done();
                                });
                        });
                    }
                });
            });

            it('Browse all types and  (200), correct accounting (megabyte unit)', function(done) {
                var services = [ { publicPath: '/public9', url: 'http://localhost:' + test_config.accounting_CB_port } ];
                var buys = [{
                    apiKey: 'apiKey9',
                    publicPath: '/public9',
                    orderId: 'orderId9',
                    productId: 'productId9',
                    customer: '0009',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .get(services[0].publicPath + '/v1/contextTypes')
                            .set('X-Actor-ID', '0009')
                            .set('X-API-KEY', 'apiKey9')
                            .expect(200, function() {
                                checkAccounting(buys[0].apiKey, 0.0001773834228515625, function() {
                                    done();
                                });
                        });
                    }
                });
            });

            it('[Subscribe] Error sending the request to Context-Broker (504)', function(done) {
                var services = [ { publicPath: '/public10', url: 'http://localhost' } ];
                var buys = [{
                    apiKey: 'apiKey10',
                    publicPath: services[0].publicPath,
                    orderId: 'orderId10',
                    productId: 'productId10',
                    customer: '0010',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .post(services[0].publicPath + '/v1/subscribeContext')
                            .set('X-Actor-ID', '0010')
                            .set('X-API-KEY', 'apiKey10')
                            .expect(504, done);
                    }
                });
            });

            it('[Subscribe] Correct subscription (200)', function(done) {
                var services = [ { publicPath: '/v1/subscribeContext', url: 'http://localhost:' + test_config.accounting_CB_port } ]
                var buys = [{
                    apiKey: 'apiKey11',
                    publicPath: services[0].publicPath,
                    orderId: 'orderId11',
                    productId: 'productId11',
                    customer: '0011',
                    unit: 'megabyte',
                    recordType: 'data'
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
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .post('/v1/subscribeContext')
                            .set('content-type', 'application/json')
                            .set('X-Actor-ID', '0011')
                            .set('X-API-KEY', 'apiKey11')
                            .type('json')
                            .send(JSON.stringify(payload))
                            .expect(200)
                            .end(function(err, res) {
                                db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function(err, subsInfo) {
                                    assert.equal(err, null);
                                    assert.deepEqual(subsInfo, { apiKey: 'apiKey11',
                                        notificationUrl: payload["reference"],
                                        unit: buys[0].unit 
                                    });
                                    done();
                                });
                            });
                    }
                });
            });

            it('[ubscribe] Error sending the request to Context-Broker (504)', function(done) {
                var services = [ { publicPath: '/public12', url: 'http://localhost' } ];
                var buys = [{
                    apiKey: 'apiKey12',
                    publicPath: services[0].publicPath,
                    orderId: 'orderId12',
                    productId: 'productId12',
                    customer: '0012',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .post(services[0].publicPath + '/v1/unsubscribeContext')
                            .set('X-Actor-ID', '0012')
                            .set('X-API-KEY', 'apiKey12')
                            .expect(504, done);
                    }
                });
            });

            it('[Unubscribe (POST)] Correct subscription (200)', function(done) {
                var services = [ { publicPath: '/public13', url: 'http://localhost:' + test_config.accounting_CB_port } ]
                var buys = [{
                    apiKey: 'apiKey13',
                    publicPath: services[0].publicPath,
                    orderId: 'orderId13',
                    productId: 'productId13',
                    customer: '0013',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                var payload_subs = {
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
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .post('/public13/v1/subscribeContext')
                            .set('content-type', 'application/json')
                            .set('X-Actor-ID', '0013')
                            .set('X-API-KEY', 'apiKey13')
                            .type('json')
                            .send(JSON.stringify(payload_subs))
                            .expect(200)
                            .end(function(err, res) {
                                db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function(err, subsInfo) {
                                    assert.equal(err, null);
                                    assert.deepEqual(subsInfo, { apiKey: 'apiKey13',
                                        notificationUrl: payload_subs["reference"],
                                        unit: buys[0].unit 
                                    });
                                    request(server.app)
                                    .post('/public13/v1/unsubscribeContext')
                                    .set('content-type', 'application/json')
                                    .set('X-Actor-ID', '0013')
                                    .set('X-API-KEY', 'apiKey13')
                                    .type('json')
                                    .send(JSON.stringify({"subscriptionId": res.body.subscribeResponse.subscriptionId}))
                                    .expect(200)
                                    .end(function(err, res) {
                                        db_mock.getCBSubscription(res.body.subscriptionId, function(err, subsInfo) {
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

            it('[Unubscribe (DELETE)] Correct subscription (200)', function(done) {
                var services = [ { publicPath: '/public14', url: 'http://localhost:' + test_config.accounting_CB_port } ]
                var buys = [{
                    apiKey: 'apiKey14',
                    publicPath: services[0].publicPath,
                    orderId: 'orderId14',
                    productId: 'productId14',
                    customer: '0014',
                    unit: 'megabyte',
                    recordType: 'data'
                }];
                var payload_subs = {
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
                prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
                    if (err) {
                        console.log('Error preparing the database');
                        process.exit(1);
                    } else {
                        request(server.app)
                            .post('/public14/v1/subscribeContext')
                            .set('content-type', 'application/json')
                            .set('X-Actor-ID', '0014')
                            .set('X-API-KEY', 'apiKey14')
                            .type('json')
                            .send(JSON.stringify(payload_subs))
                            .expect(200)
                            .end(function(err, res) {
                                db_mock.getCBSubscription(res.body.subscribeResponse.subscriptionId, function(err, subsInfo) {
                                    assert.equal(err, null);
                                    assert.deepEqual(subsInfo, { apiKey: 'apiKey14',
                                        notificationUrl: payload_subs["reference"],
                                        unit: buys[0].unit 
                                    });
                                    request(server.app)
                                    .delete('/public14/v1/contextSubscriptions/' + res.body.subscribeResponse.subscriptionId)
                                    .set('content-type', 'application/json')
                                    .set('X-Actor-ID', '0014')
                                    .set('X-API-KEY', 'apiKey14')
                                    .type('json')
                                    .send(JSON.stringify({"subscriptionId": res.body.subscribeResponse.subscriptionId}))
                                    .expect(200)
                                    .end(function(err, res) {
                                        db_mock.getCBSubscription(res.body.subscriptionId, function(err, subsInfo) {
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