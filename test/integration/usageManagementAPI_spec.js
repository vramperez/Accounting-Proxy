var assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    usageAPI_mock = require('./test_endpoint'),
    async = require('async'),
    test_config = require('../config_tests').integration,
    prepare_test = require('./prepareDatabase'),
    data = require('../data');

var server, db_mock, notifier_mock;
var databaseName = 'testDB_usageAPI.sqlite';

var mock_config = {
    accounting_proxy: {
        port: 9060
    },
    usageAPI: {
        host: 'localhost',
        port: test_config.usageAPI_port,
        path: ''
    },
    resources: {
        contextBroker: false
    },
    database: {},
    resources: {
        contextBroker: false
    },
    api: {
        administration_paths: {
            keys: '/accounting_proxy/keys',
            units: '/accounting_proxy/units',
            newBuy: '/accounting_proxy/buys',
            checkUrl: '/accounting_proxy/urls',
        }
    },
    log: {
        file: 'file'
    }
};

var expressWinston_mock = {
    logger: function (options) {
        return function (req, res, next) {
            next();
        };
    }
};

var api_mock = {
    checkIsJSON: function () {},
    checkUrl: function () {},
    newBuy: function () {},
    getApiKeys: function (){},
    getUnits: function () {}
};

var OAuth2authentication_mock = {
    headerAuthentication: function(req, res) {}
};

var app_mock = {
    set: function (prop, value) {},
    listen: function (port) {},
    get: function (prop) {},
    use: function (middleware) {},
    post: function (path, middleware, handler) {}
};

var mocker = function (database, done) {
    if (database === 'sql') {
        async.series([
            function (callback) {
                mock_config.database.type = './db';
                mock_config.database.name = databaseName;
                db_mock = proxyquire('../../db', {
                    './config': mock_config
                });
                callback(null);
            },
            function (callback) {
                notifier_mock = proxyquire('../../notifier', {
                    './config': mock_config,
                    'winston': {
                        info: function (msg) {}
                    },
                    './db': db_mock
                });
                callback(null);
            },
            function (callback) {
                server = proxyquire('../../server', {
                    express: function () {
                        return app_mock;
                    },
                    './config': mock_config,
                    './db': db_mock,
                    './notifier': notifier_mock,
                    './APIServer': api_mock,
                    'express-winston': expressWinston_mock,
                    'winston': {transports: {
                        File: function (options) {}
                    }},
                    'orion_context_broker/cb_handler': {},
                    './OAuth2_authentication': OAuth2authentication_mock
                });
                callback(null);
            }
        ]);
    } else {
        async.series([
            function (callback) {
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
                    callback();
                }
            },
            function (callback) {
                notifier_mock = proxyquire('../../notifier', {
                    './config': mock_config,
                    'winston': {
                        info: function (msg) {}
                    },
                    './db_Redis': db_mock
                });
                callback();
            },
            function (callback) {
                server = proxyquire('../../server', {
                    express: function () {
                        return app_mock;
                    },
                    './config': mock_config,
                    '.db_Redis': db_mock,
                    './notifier': notifier_mock,
                    './APIServer': api_mock,
                    'express-winston': expressWinston_mock,
                    'winston': {
                        transports: {
                            File: function (options) {}
                        }
                    },
                    'orion_context_broker/cb_handler': {},
                    './OAuth2_authentication': OAuth2authentication_mock
                });
                callback();
            }
        ]);
    }

    db_mock.init(function (err) {
        if (err) {
            console.log('Error initializing the database');
            process.exit(1);
        } else {
            return done();
        }
    });
};

console.log('[LOG]: starting an endpoint for testing...');
usageAPI_mock.run(test_config.usageAPI_port);

after(function (done) {
    prepare_test.removeDatabase(databaseName, done);
});

describe('Testing the usage notifier', function () {

    async.eachSeries(test_config.databases, function (database, task_callback) {
        describe('with database ' + database, function () {

            before(function (done) {
                prepare_test.clearDatabase(database, databaseName, function () {
                    mocker(database, done);
                });
            });

            // Restore the default mock_config values.
            afterEach(function () {
                mock_config.usageAPI = {
                    host: 'localhost',
                    port: test_config.usageAPI_port,
                    path: ''
                };
            });

            after(function () {
                task_callback();
            });

            it('should not send notifications when there is no API Key for notifications available', function (done) {

                var units = ['call'];

                mock_config.modules = {
                    accounting: units
                };

                server.init(function (err) {

                    db_mock.getHref('call', function (err, href) {
                        if (err) {
                            throw new Error('Error getting the Href ' + href);
                        } else {
                            assert.equal(href, null);
                            assert.equal(err, null);

                            done();
                        }
                    });
                });
            });

            it('should call the callback with error when there is an error notifying specifications', function (done) {

                var unit = 'call';

                mock_config.modules = {
                    accounting: [unit]
                };

                mock_config.usageAPI = {
                    host: 'wrong',
                    port: '',
                    path: ''
                };

                var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                var apiKey = data.DEFAULT_API_KEYS[0];
                var services = [{publicPath: publicPath, url: data.DEFAULT_URLS[0], appId: data.DEFAULT_APP_IDS[0]}];
                var buys = data.DEFAULT_BUY_INFORMATION;
                var accountings = [{
                    apiKey: apiKey,
                    value: 2
                }];

                prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, [], 'token', function (err) {
                    if (err) {
                        throw new Error('Error preparing database');
                    } else {
                        server.init(function (err) {

                            assert.equal(err, 'Error starting the accounting-proxy. Error sending the Specification: ENOTFOUND');
                            done();
                        });
                    }
                });
            });

            it('should notify the usage specifications and the usage when they have not been notified and there is an available token', function (done) {

                var unit = data.DEFAULT_UNIT;

                mock_config.modules = {
                    accounting: [unit]
                };

                var publicPath = data.DEFAULT_PUBLIC_PATHS[1];
                var apiKey = data.DEFAULT_API_KEYS[1];
                var services = [{publicPath: publicPath, url: data.DEFAULT_URLS[1], appId: data.DEFAULT_APP_IDS[1]}];
                var buys = [{
                    apiKey: apiKey,
                    publicPath: publicPath,
                    orderId: data.DEFAULT_ORDER_IDS[1],
                    productId: data.DEFAULT_PRODUCT_IDS[1],
                    customer: 'user2',
                    unit: unit,
                    recordType: data.DEFAULT_RECORD_TYPE
                }];
                var accountings = [{
                    apiKey: apiKey,
                    value: 2
                }];

                prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, [], 'token', function (err) {
                    if (err) {
                        throw new Error('Error preparing database');
                    } else {
                        server.init(function (err) {

                            assert.equal(err, null);

                            db_mock.getHref(unit, function (err, href) {
                                if (err) {
                                    throw new Error ('Error getting the href');
                                } else {
                                    assert.equal(href, 'http://localhost:9040/usageSpecification/1');
                                    db_mock.getNotificationInfo(function (err, notificationInfo) {
                                        if (err) {
                                            throw new Error ('Error getting the href');    
                                        } else {
                                            assert.equal(notificationInfo, null);
                                            done();
                                        }
                                    });
                                }
                            });
                        });
                    }
                });
            });
        });
    });
});