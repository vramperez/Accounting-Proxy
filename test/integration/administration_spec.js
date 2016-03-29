var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    test_config = require('../config_tests').integration,
    async = require('async'),
    redis = require('redis'),
    server,
    db_mock;

var mock_config = {
    modules: {
        accounting: ['call', 'megabyte']
    },
    accounting_proxy: {
        port: 9000
    },
    database: {},
    api: {
        administration_paths: {
            keys: '/accounting_proxy/keys',
            units: '/accounting_proxy/units',
            newBuy: '/accounting_proxy/buys',
            checkUrl: '/accounting_proxy/urls',
        }
    }
};

var log_mock = {
    log: function (level, msg) {},
    info: function (msg) {},
    warn: function (msg) {},
    error: function (msg) {}
}

var prepare_tests = function (database) {
    switch (database) {
        case 'sql':
            mock_config.database.type = './db';
            mock_config.database.name = 'testDB_administration.sqlite1';
            db_mock = proxyquire('../../db', {
                './config': mock_config
            });
            api_server = proxyquire('../../APIServer', {
                './config': mock_config,
                './db': db_mock
            });
            server = proxyquire('../../server', {
                './config': mock_config,
                './db': db_mock,
                './APIServer': api_server,
                './notifier': {},
                'winston': log_mock, // Not display logger messages while testing
                './orion_context_broker/db_handler': {}
            });
            break;
        case 'redis':
            mock_config.database.type = './db_Redis';
            mock_config.database.name = test_config.database_redis;
            db_mock = proxyquire('../../db_Redis', {
                './config': mock_config
            });
            api_server = proxyquire('../../APIServer', {
                './config': mock_config,
                './db_Redis': db_mock
            });
            server = proxyquire('../../server', {
                './config': mock_config,
                './db_Redis': db_mock,
                './APIServer': api_server,
                './notifier': {},
                'winston': log_mock, // Not display logger messages while testing
                './orion_context_broker/db_handler': {}
            });
            break;
    }
    db_mock.init(function (err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        }
    });
}

async.each(test_config.databases, function (database, task_callback) {

    describe('Testing the administration API', function (done) {

        before(function () { // Mock the database
            prepare_tests(database);
        });

        /**
         * Remove the database used for testing.
         */
        after(function (task_callback) {
            if (database === 'sql') {
                fs.access('testDB_administration.sqlite1', fs.F_OK, function (err) {
                    if (!err) {
                        fs.unlinkSync('testDB_administration.sqlite1');
                    }
                });
                task_callback();
            } else {
                var client = redis.createClient();
                client.select(test_config.database_redis, function (err) {
                    if (err) {
                        console.log('Error deleting redis database: ' + test_config.database_redis);
                        task_callback();
                    } else {
                        client.flushdb();
                        task_callback();
                    }
                });
            }
        });

        describe('with database: ' + database, function () {

            describe('[GET:' + mock_config.api.administration_paths.units + '] accounting units request', function () {

                it('correct (200) return all the accounting units', function (done) {
                    request(server.app)
                        .get(mock_config.api.administration_paths.units)
                        .expect(200, {units: mock_config.modules.accounting}, done);
                });
            });

            describe('[GET:' +  mock_config.api.administration_paths.keys + '] user api-keys request', function () {

                it('no "X-Actor-ID header" (400)', function (done) {
                    request(server.app)
                        .get(mock_config.api.administration_paths.keys)
                        .expect(400, {error: 'Undefined "X-Actor-ID" header'}, done);
                });

                it('no valid user (400)', function (done) {
                    var user = 'wrong';
                    request(server.app)
                        .get('/accounting_proxy/keys')
                        .set('X-Actor-ID', user)
                        .expect(404, {error: 'No api-keys available for the user ' + user}, done);
                });

                it('correct (200) return api-keys', function (done) {
                    var buyInfo1 = {
                        apiKey: 'apiKey1',
                        publicPath: '/public1',
                        orderId: 'orderId1',
                        productId: 'productId',
                        customer: '0001',
                        unit: 'megabyte',
                        recordType: 'data'
                    }
                    db_mock.newService(buyInfo1.publicPath, 'http://localhost/private', 'appId', function (err) {
                        if (err) {
                            console.log('Error adding new service');
                            process.exit(1);
                        } else {
                            db_mock.newBuy(buyInfo1, function (err) {
                                if (err) {
                                    console.log('Error adding new service');
                                    process.exit(1);
                                } else {
                                    request(server.app)
                                        .get('/accounting_proxy/keys')
                                        .set('X-Actor-ID', buyInfo1.customer)
                                        .expect(200, [{ apiKey: buyInfo1.apiKey, productId: buyInfo1.productId, orderId: buyInfo1.orderId }], done);
                                }
                            });
                        }
                    });
                });
            });

            describe('[POST:' + mock_config.api.administration_paths.checkUrl +'] checkUrl request', function () {

                it('invalid content-type (415)', function (done) {
                    request(server.app)
                        .post(mock_config.api.administration_paths.checkUrl)
                        .set('content-type', 'text/html')
                        .expect(415, {error: 'Content-Type must be "application/json"'}, done);
                });

                it('incorrect body (400)', function (done) {
                    var url = 'http://localhost:9000/path';
                    request(server.app)
                        .post(mock_config.api.administration_paths.checkUrl)
                        .set('content-type', 'application/json')
                        .expect(400, {error: 'Invalid body, url undefined'}, done);
                });

                it('invalid url (400)', function (done) {
                    var url = 'http://localhost:9000/wrong_path';
                    request(server.app)
                        .post(mock_config.api.administration_paths.checkUrl)
                        .set('content-type', 'application/json')
                        .send({url: url})
                        .expect(400, {error: 'Incorrect url ' + url}, done);
                });

                it('correct url and update the token (200)', function (done) {
                    var url = 'http://localhost:9000/path';
                    var newToken = 'token2';
                    db_mock.addToken('token1', function (err) {
                        if (err) {
                            console.log('Error adding token');
                            process.exit(1);
                        } else {
                            db_mock.newService('/public2', url, 'appId', function (err) {
                                if (err) {
                                    console.log('Error adding new service');
                                    process.exit(1);
                                } else {
                                    request(server.app)
                                        .post(mock_config.api.administration_paths.checkUrl)
                                        .set('content-type', 'application/json')
                                        .set('X-API-KEY', newToken)
                                        .send({url: url})
                                        .expect(200, function () {
                                            db_mock.getToken(function (err, token) {
                                                assert.equal(err, null);
                                                assert.equal(token, newToken);
                                                done();
                                            });
                                    });
                                }
                            });
                        }
                    });
                });
            });

            describe('[POST: ' + mock_config.api.administration_paths.newBuy +'] new buy request', function () {

                it('invalid content-type (415)', function (done) {
                    request(server.app)
                        .post(mock_config.api.administration_paths.newBuy)
                        .set('content-type', 'text/html')
                        .expect(415, {error: 'Content-Type must be "application/json"'}, done);
                });

                it('invalid json (400)', function (done) {
                    request(server.app)
                            .post(mock_config.api.administration_paths.newBuy)
                            .set('content-type', 'application/json')
                            .send({})
                            .expect(400, {error: 'Invalid json'}, done);
                });

                it('correct buy request (200)', function (done) {
                    var url = 'http://example.com/path';
                    var buy = {
                        orderId: 'orderId3',
                        productId: 'productId3',
                        customer: '0003',
                        productSpecification: {
                            url: 'http://example.com/path3',
                            unit: 'megabyte',
                            recordType: 'data',
                        }
                    }
                    db_mock.newService('/path3', url, 'appId', function (err) {
                        if (err) {
                            console.log('Error adding new service');
                            process.exit(1);
                        } else {
                            request(server.app)
                                .post(mock_config.api.administration_paths.newBuy)
                                .set('content-type', 'application/json')
                                .send(buy)
                                .expect(201, {'API-KEY': 'ad07029406d7779de0586a1df57545ab5d14eb45'}, function () {
                                    db_mock.getAccountingInfo('ad07029406d7779de0586a1df57545ab5d14eb45', function (err, res) {
                                        assert.equal(err, null);
                                        assert.deepEqual(res, { unit: buy.productSpecification.unit,
                                          url: url});
                                        done();
                                    });
                            });
                        }
                    });
                });
            });
        });
    });
});