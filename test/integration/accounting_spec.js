var request = require('supertest'),
    assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    test_endpoint = require('./test_endpoint'),
    async = require('async'),
    test_config = require('../config_tests').integration,
    fs = require('fs'),
    prepare_test = require('./prepareDatabase'),
    redis = require('redis');

var server, db_mock;

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
    }
};

var api_mock = {
    checkIsJSON: function() {},
    checkUrl: function() {},
    newBuy: function() {},
    getApiKeys: function(){},
    getUnits: function() {}
}

var notifier_mock = {
    notify: function(info, callback) {}
}

var log_mock = {
    log: function(level, msg) {},
    info: function(msg) {},
    warn: function(msg) {},
    error: function(msg) {}
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
    OAuth2Strategy: function(options, callback) {
        return {
            userProfile: function(authToken, callback) {
                return callback(null, userProfile);
            }
        }
    }
}

var mocker = function(database) {
    switch (database) {
        case 'sql':
            mock_config.database.type = './db';
            mock_config.database.name = 'testDB_accounting.sqlite';
            db_mock = proxyquire('../../db', {
                './config': mock_config
            });
            authentication_mock = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategy_mock,
                './config': mock_config,
                'winston': log_mock
            });
            server = proxyquire('../../server', {
                './config': mock_config,
                './db': db_mock,
                './APIServer': api_mock,
                './notifier': notifier_mock,
                'winston': log_mock, // Not display logger messages while testing
                './orion_context_broker/db_handler': {},
                'OAuth2_authentication': authentication_mock
            });
            break;
        case 'redis':
            mock_config.database.type = './db_Redis';
            mock_config.database.name = test_config.database_redis;
            db_mock = proxyquire('../../db_Redis', {
                './config': mock_config
            });
            authentication_mock = proxyquire('../../OAuth2_authentication', {
                'passport-fiware-oauth': FIWAREStrategy_mock,
                './config': mock_config,
                'winston': log_mock
            });
            server = proxyquire('../../server', {
                './config': mock_config,
                './db_Redis': db_mock,
                './APIServer': api_mock,
                './notifier': notifier_mock,
                'winston': log_mock, // Not display logger messages while testing
                './orion_context_broker/db_handler': {},
                'OAuth2_authentication': authentication_mock
            });
            break;
    }
    db_mock.init(function(err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        }
    });
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(test_config.accounting_port);

async.each(test_config.databases, function(database, task_callback) {

    describe('Testing the accounting API. Generic REST use', function() {

        before(function() {
            mocker(database);
        });

        /**
         * Remove the database used for testing.
         */
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

        describe('with database ' + database, function() {

            describe('ADMINISTRATOR', function() {

                it('undefined authotization header (401)', function(done) {
                    request(server.app)
                    .get('/public/resource')
                    .expect(401, { error: 'Auth-token not found in request headers'}, done);
                });

                it('invalid authorization token (401)', function(done) {
                    var type = 'wrong';
                    request(server.app)
                    .get('/public/resource')
                    .set('authorization', type + ' token')
                    .expect(401, { error: 'Invalid Auth-Token type (' + type + ')' }, done);
                });

                it('token from other application, wrong appId (401)', function(done) {
                    request(server.app)
                    .get('/public/resource')
                    .set('x-auth-token', userProfile.accessToken)
                    .expect(401, {error: 'The auth-token scope is not valid for the current application'}, done);
                });

                it('error sending request to the endpoint (504)', function(done) {
                    var publicPath = '/public1';
                    var services = [{publicPath: publicPath, url: 'wrong_url', appId: userProfile.appId}];
                    var admins = [{idAdmin: userProfile.id, publicPath: publicPath}];
                    prepare_test.addToDatabase(db_mock, services, [], [], admins, function(err) {
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

                it('correct', function(done) {
                    var publicPath = '/public2';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    var admins = [{idAdmin: userProfile.id, publicPath: publicPath}];
                    prepare_test.addToDatabase(db_mock, services, [], [], admins, function(err) {
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

            describe('USER', function() {

                it('undefined "X-API-KEY" header', function(done) {
                    var publicPath = '/public3';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url + '/rest/call', appId: userProfile.appId}];
                    prepare_test.addToDatabase(db_mock, services, [], [], [], function(err) {
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

                it('invalid api-key or user', function(done) {
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
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], function(err) {
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

                it('error sending request to the endpoint (504)', function(done) {
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
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], function(err) {
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

                it('error making th accounting, wrong unit (500)', function(done) {
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
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], function(err) {
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

                it('correct (200) response and accounting (call unit)', function(done) {
                    var publicPath = '/public7';
                    var apiKey = 'apiKey3';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId3',
                        productId: 'productId3',
                        customer: userProfile.id,
                        unit: 'call',
                        recordType: 'callusage'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], function(err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                            .get(publicPath + '/rest/call')
                            .set('x-auth-token', userProfile.accessToken)
                            .set('X-API-KEY', apiKey)
                            .expect(200, function() {
                                db_mock.getNotificationInfo(function(err, accInfo) {
                                    async.each(accInfo, function(acc, task_callback) {
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
                                    }, function() {
                                        done();
                                    });
                                });
                            });
                        }
                    });
                });

                it('correct (200) response and accounting (megabyte unit)', function(done) {
                    var publicPath = '/public8';
                    var apiKey = 'apiKey4';
                    var url = 'http://localhost:' + test_config.accounting_port;
                    var services = [{publicPath: publicPath, url: url, appId: userProfile.appId}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId4',
                        productId: 'productId4',
                        customer: userProfile.id,
                        unit: 'megabyte',
                        recordType: 'amountData'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], function(err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            request(server.app)
                            .get(publicPath + '/rest/megabyte')
                            .set('x-auth-token', userProfile.accessToken)
                            .set('X-API-KEY', apiKey)
                            .expect(200, function() {
                                db_mock.getNotificationInfo(function(err, accInfo) {
                                    async.each(accInfo, function(acc, task_callback) {
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
                                                value: '0.00000858306884765625'
                                            });
                                            task_callback();
                                        } else {
                                            task_callback();
                                        }
                                    }, function() {
                                        done();
                                    });
                                });
                            });
                        }
                    });
                });
            });
        });
    });
});