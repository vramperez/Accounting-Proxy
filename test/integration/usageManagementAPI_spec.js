var assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    usageAPI_mock = require('./test_endpoint'),
    async = require('async'),
    test_config = require('../config_tests').integration,
    redis = require('redis'),
    fs = require('fs'),
    prepare_test = require('./prepareDatabase');

var server, db_mock, notifier_mock;

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

var mocker = function (database) {
    if (database === 'sql') {
        mock_config.database.type = './db';
        mock_config.database.name = 'testDB_usageAPI.sqlite';
        db_mock = proxyquire('../../db', {
            './config': mock_config
        });
        notifier_mock = proxyquire('../../notifier', {
            './config': mock_config,
            'winston': {
                info: function (msg) {}
            },
            './db': db_mock
        });
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
            notifier_mock = proxyquire('../../notifier', {
                './config': mock_config,
                'winston': {
                    info: function (msg) {}
                },
                './db_Redis': db_mock
            });
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
        }
    }
};

var checkUsageNotifications = function (apiKey, value, correlationNumber, callback) {
    db_mock.getNotificationInfo(function (err, allAccInfo) {
        if (err) {
            console.log('Error checking the accounting');
            return callback();
        } else if (allAccInfo === null) {
            assert.equal(value, 0);
            return callback();
        } else {
            async.each(allAccInfo, function (accInfo, task_callback) {
                if(accInfo.apiKey === apiKey) {
                    assert.equal(accInfo.value, value);
                    assert.equal(accInfo.correlationNumber, correlationNumber);
                    return callback();
                } else {
                    task_callback();
                }
            });
        }
    });
};

console.log('[LOG]: starting an endpoint for testing...');
usageAPI_mock.run(test_config.usageAPI_port);

async.each(test_config.databases, function (database, task_callback) {

    describe('Testing the usage specification and usage notifications', function () {

        before(function () {
            mocker(database);
        });

        // Restore the default mock_config values.
        afterEach(function () {
            mock_config.usageAPI = {
                host: 'localhost',
                port: test_config.usageAPI_port,
                path: ''
            };
        });

        after(function (task_callback) {
            if (database === 'sql') {
                fs.access('./testDB_usageAPI.sqlite', fs.F_OK, function (err) {
                    if (!err) {
                        fs.unlinkSync('./testDB_usageAPI.sqlite');
                    }
                });
                task_callback();
            } else {
                var client = redis.createClient();
                client.select(test_config.redis_database, function (err) {
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

            describe('Notify usage specification', function() {
                var unitIds = {
                    call: 1,
                    megabyte: 2
                };

                it('Error notifying the usage specification', function (done) {
                    mock_config.usageAPI = {
                        host: 'wrong',
                        port: '',
                        path: ''
                    };
                    mock_config.modules = {
                        accounting: ['call']
                    };
                    server.init( function (err) {
                        assert.equal(err, 'Error starting the accounting-proxy. Error sending the Specification: ENOTFOUND');
                        done();
                    });
                });

                it('Notify one usage specification (should save the href)', function (done) {
                    mock_config.modules = {
                        accounting: ['call']
                    };
                    server.init( function (err) {
                        db_mock.getHref(mock_config.modules.accounting[0], function (err, href) {
                            if (err) {
                                console.log('Error getting the href for unit: ' + mock_config.modules.accounting[0]);
                                process.exit(1);
                            } else {
                                assert.equal(href, 'http://localhost:9040/usageSpecification/1');
                                done();
                            }
                        });
                    });
                });

                it('Notify two usage specification (should save the hrefs)', function (done) {
                    mock_config.modules = {
                        accounting: ['call', 'megabyte']
                    };
                    server.init( function (err) {
                        async.each(mock_config.modules.accounting, function (unit, task_callback) {
                            db_mock.getHref(unit, function (err, href) {
                                if (err) {
                                    console.log('Error getting the href for unit: ' + unit);
                                    process.exit(1);
                                } else {
                                    assert.equal(href, 'http://localhost:9040/usageSpecification/' + unitIds[unit]);
                                    task_callback();
                                }
                            });
                        }, done);
                    });
                });

                it('Specification already notified, should not notify', function (done) {
                    var unit = 'unitStub';
                    mock_config.modules = {
                        accounting: [unit]
                    };
                    var href = 'http://example:3333/usageSpecification/Id';
                    prepare_test.addToDatabase(db_mock, [], [], [], [], [], [{unit: unit, href: href}], function (err) {
                        if (err) {
                            console.log('Error preparing test');
                            process.exit(1);
                            done();
                        } else {
                            server.init(function (err) {
                                db_mock.getHref(mock_config.modules.accounting[0], function (err, res) {
                                    if (err) {
                                        console.log('Error getting the href for unit: ' + mock_config.modules.accounting[0]);
                                        process.exit(1);
                                    } else {
                                        assert.equal(res, href);
                                        done();
                                    }
                                });
                            });
                        }
                    });
                });

                it('Specifications already notified, should not notify', function (done) {
                    mock_config.modules = {
                        accounting: ['unitStub1', 'unitStub2']
                    };
                    var href = 'http://example:3333/usageSpecification/Id';
                    async.each(mock_config.modules.accounting, function (unit, task_callback) {
                        prepare_test.addToDatabase(db_mock, [], [], [], [], [], [{unit: unit, href: href}], function (err) {
                            if (err) {
                                console.log('Error preparing test');
                                process.exit(1);
                            } else {
                                task_callback();
                            }
                        });
                    }, function () {
                        async.each(mock_config.modules.accounting, function (unit, task_callback) {
                            db_mock.getHref(unit, function (err, res) {
                                if (err) {
                                    console.log('Error getting the href for unit: ' + unit);
                                    process.exit(1);
                                } else {
                                    assert.equal(res, href);
                                    task_callback();
                                }
                            });
                        }, done);
                    });
                });
            });

            describe('Notify usage', function() {

                it('Error notifying the usage', function (done) {
                    var unit = 'call';
                    mock_config.usageAPI = {
                        host: 'wrong',
                        port: '',
                        path: ''
                    };
                    mock_config.modules = {
                        accounting: [unit]
                    };
                    var publicPath = '/public1';
                    var apiKey = 'apiKey1';
                    var services = [{publicPath: publicPath, url: 'http://example/path', appId: 'appId'}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId1',
                        productId: 'productId1',
                        customer: 'user1',
                        unit: unit,
                        recordType: 'typeUsage'
                    }];
                    var accountings = [{
                        apiKey: apiKey,
                        value: 2
                    }];
                    var specifications = [{
                        unit: unit,
                        href: 'http://example/usageSpecification/Id'
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, specifications, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            server.init(function (err) {
                                assert.equal(err, 'Error starting the accounting-proxy. Error sending the usage: ENOTFOUND');
                                done();
                            });
                        }
                    });
                });

                it('One usage accounting to notify, correct notification', function (done) {
                    var unit = 'call';
                    mock_config.modules = {
                        accounting: [unit]
                    };
                    var publicPath = '/public2';
                    var apiKey = 'apiKey2';
                    var services = [{publicPath: publicPath, url:'http://example/path', appId: 'appId'}];
                    var buys = [{
                        apiKey: apiKey,
                        publicPath: publicPath,
                        orderId: 'orderId2',
                        productId: 'productId2',
                        customer: 'user2',
                        unit: unit,
                        recordType: 'typeUsage'
                    }];
                    var accountings = [{
                        apiKey: apiKey,
                        value: 2
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, [], function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            server.init(function (err) {
                                checkUsageNotifications(apiKey, 0, 1, function () {
                                    done();
                                });
                            });
                        }
                    });
                });

                it('Two usage accountings to notify,correct notification', function (done) {
                    var units = ['call', 'megabyte'];
                    mock_config.modules = {
                        accounting: units
                    };
                    var href = 'http://example/usageSpecification/Id';
                    var publicPath = '/public3';
                    var apiKeys = ['apiKey1', 'apiKey2'];
                    var services = [{publicPath: publicPath, url: 'http://example/path', appId: 'appId'}];
                    var buys = [{
                        apiKey: apiKeys[0],
                        publicPath: publicPath,
                        orderId: 'orderId3',
                        productId: 'productId3',
                        customer: 'user3',
                        unit: units[0],
                        recordType: 'typeUsage'
                    }, {
                        apiKey: apiKeys[1],
                        publicPath: publicPath,
                        orderId: 'orderId4',
                        productId: 'productId4',
                        customer: 'user4',
                        unit: units[1],
                        recordType: 'typeUsage'
                    }];
                    var accountings = [{
                        apiKey: apiKeys[0],
                        value: 2
                    }, {
                        apiKey: apiKeys[1],
                        value: 2
                    }];
                    var specifications = [{
                        unit: units[0],
                        href: href
                    }, {
                        unit: units[1],
                        href: href
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, specifications, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            server.init(function (err) {
                                async.each(apiKeys, function (apiKey, task_callback) {
                                    checkUsageNotifications(apiKey, 0, 1, function () {
                                        task_callback();
                                    });
                                }, done);
                            });
                        }
                    });
                });

                it('No usage accounting to notify, should not notify', function (done) {
                    var units = ['call', 'megabyte'];
                    mock_config.modules = {
                        accounting: units
                    };
                    var href = 'http://example/usageSpecification/Id';
                    var publicPath = '/public3';
                    var apiKeys = ['apiKey1', 'apiKey2'];
                    var services = [{publicPath: publicPath, url: 'http://example/path', appId: 'appId'}];
                    var buys = [{
                        apiKey: apiKeys[0],
                        publicPath: publicPath,
                        orderId: 'orderId3',
                        productId: 'productId3',
                        customer: 'user3',
                        unit: units[0],
                        recordType: 'typeUsage'
                    }, {
                        apiKey: apiKeys[1],
                        publicPath: publicPath,
                        orderId: 'orderId4',
                        productId: 'productId4',
                        customer: 'user4',
                        unit: units[1],
                        recordType: 'typeUsage'
                    }];
                    var accountings = [{
                        apiKey: apiKeys[0],
                        value: 0
                    }, {
                        apiKey: apiKeys[1],
                        value: 0
                    }];
                    var specifications = [{
                        unit: units[0],
                        href: href
                    }, {
                        unit: units[1],
                        href: href
                    }];
                    prepare_test.addToDatabase(db_mock, services, buys, [], [], accountings, specifications, function (err) {
                        if (err) {
                            console.log('Error preparing the database');
                            process.exit(1);
                        } else {
                            server.init(function (err) {
                                async.each(apiKeys, function (apiKey, task_callback) {
                                    checkUsageNotifications(apiKey, 0, 0, function () {
                                        task_callback();
                                    });
                                }, done);
                            });
                        }
                    });
                });
            });
        });
    });
});