var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    test_config = require('../config_tests').integration,
    async = require('async'),
    redis = require('redis'),
    api_server,
    db_mock;
    
var mock_config = {
    modules: {
        accounting: ['call', 'megabyte']
    },
    accounting_proxy: {
        admin_port: 9001
    },
    database: {}
};

var prepare_tests = function(database) {
    switch (database) {
        case 'sql':
            mock_config.database.type = './db';
            mock_config.database.name = 'testDB_administration.sqlite1';
            db_mock = proxyquire('../../db', {
                './config': mock_config
            });
            break;
        case 'redis':
            mock_config.database.type = './db_Redis';
            mock_config.database.name = test_config.database_redis;
            db_mock = proxyquire('../../db_Redis', {
                './config': mock_config
            });
            break;
    }
    api_server = proxyquire('../../APIServer', {
        './config': mock_config,
        './db': db_mock,
        './server': { logger: function() {}} // Not display logger messages while testing
    });
    db_mock.init(function(err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        }
    });
}

async.each(test_config.databases, function(database, task_callback) {

    describe('Testing the administration API', function(done) {

        before(function() { // Mock the database
            prepare_tests(database);
        });

        /**
         * Remove the database used for testing.
         */
        after(function(task_callback) {
            if (database === 'sql') {
                fs.access('testDB_administration.sqlite1', fs.F_OK, function(err) {
                    if (!err) {
                        fs.unlinkSync('testDB_administration.sqlite1');
                    }
                });
                task_callback();
            } else {
                var client = redis.createClient();
                client.select(test_config.database_redis, function(err) {
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

        describe('with database: ' + database, function() {

            describe('[GET: /api/units] accounting units request', function() {

                it('correct (200) return all the accounting units', function(done) {
                    request(api_server.app)
                        .get('/api/units')
                        .expect(200, {units: ['call', 'megabyte']}, done);
                });
            });

            describe('[GET: /api/users/keys] user api-keys request', function() {

                it('no "X-Actor-ID header" (400)', function(done) {
                    request(api_server.app)
                        .get('/api/users/keys')
                        .expect(400, {error: 'Undefined "X-Actor-ID" header'}, done);
                });

                it('no valid user (400)', function(done) {
                    request(api_server.app)
                        .get('/api/users/keys')
                        .set('X-Actor-ID', 'wrong')
                        .expect(400, done);
                });

                it('correct (200) return api-keys', function(done) {
                    var buyInfo1 = {
                        apiKey: 'apiKey1',
                        publicPath: '/public1',
                        orderId: 'orderId1',
                        productId: 'productId',
                        customer: '0001',
                        unit: 'megabyte',
                        recordType: 'data'
                    }
                    db_mock.newService(buyInfo1.publicPath, 'http://localhost/private', function(err) {
                        if (err) {
                            console.log('Error adding new service');
                            process.exit(1);
                        } else {
                            db_mock.newBuy(buyInfo1, function(err) {
                                if (err) {
                                    console.log('Error adding new service');
                                    process.exit(1);
                                } else {
                                    request(api_server.app)
                                                .get('/api/users/keys')
                                                .set('X-Actor-ID', buyInfo1.customer)
                                                .expect(200, [{ apiKey: 'apiKey1', productId: 'productId', orderId: 'orderId1' }], done);
                                }
                            });
                        }
                    });
                });
            });

            describe('[POST: /api/resources] checkUrl request', function() {

                it('invalid content-type (415)', function(done) {
                    request(api_server.app)
                        .post('/api/resources')
                        .set('content-type', 'text/html')
                        .expect(415, {error: 'Content-Type must be "application/json"'}, done);
                });

                it('incorrect body (400)', function(done) {
                    var url = 'http://localhost:9000/path';
                    request(api_server.app)
                        .post('/api/resources')
                        .set('content-type', 'application/json')
                        .expect(400, {error: 'Invalid body, url undefined'}, done);
                });

                it('invalid url (400)', function(done) {
                    var url = 'http://localhost:9000/wrong_path';
                    request(api_server.app)
                        .post('/api/resources')
                        .set('content-type', 'application/json')
                        .send({url: url})
                        .expect(400, {error: 'Incorrect url ' + url}, done);
                });

                it('correct url and update the token (200)', function(done) {
                    var url = 'http://localhost:9000/path';
                    db_mock.addToken('token1', function(err) {
                        if (err) {
                            console.log('Error adding token');
                            process.exit(1);
                        } else {
                            db_mock.newService('/public2', url, function(err) {
                                if (err) {
                                    console.log('Error adding new service');
                                    process.exit(1);
                                } else {
                                    request(api_server.app)
                                        .post('/api/resources')
                                        .set('content-type', 'application/json')
                                        .set('X-API-KEY', 'token2')
                                        .send({url: url})
                                        .expect(200, function() {
                                            db_mock.getToken(function(err, token) {
                                                assert.equal(err, null);
                                                assert.equal(token, 'token2');
                                                done();
                                            });
                                    });
                                }
                            });
                        }
                    });
                });
            });

            describe('[POST: /api/users] new buy request', function() {

                it('invalid content-type (415)', function(done) {
                    request(api_server.app)
                        .post('/api/users')
                        .set('content-type', 'text/html')
                        .expect(415, {error: 'Content-Type must be "application/json"'}, done);
                });

                it('invalid json (400)', function(done) {
                    request(api_server.app)
                            .post('/api/users')
                            .set('content-type', 'application/json')
                            .send({})
                            .expect(400, {error: 'Invalid json'}, done);
                });

                it('correct buy request (200)', function(done) {
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
                    db_mock.newService('/path3', 'http://example.com/path', function(err) {
                        if (err) {
                            console.log('Error adding new service');
                            process.exit(1);
                        } else {
                            request(api_server.app)
                                .post('/api/users')
                                .set('content-type', 'application/json')
                                .send(buy)
                                .expect(201, {'API-KEY': 'ad07029406d7779de0586a1df57545ab5d14eb45'}, function() {
                                    db_mock.getAccountingInfo('ad07029406d7779de0586a1df57545ab5d14eb45', function(err, res) {
                                        assert.equal(err, null);
                                        assert.deepEqual(res, { unit: 'megabyte',
                                          url: 'http://example.com/path',
                                          publicPath: '/path3' });
                                        done();
                                    });
                            });
                        }
                    })
                });
            });
        });
    });    
});