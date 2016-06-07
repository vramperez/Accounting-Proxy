var assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru(),
    usageAPI_mock = require('./test_endpoint'),
    async = require('async'),
    test_config = require('../config_tests').integration,
    data = require('../data'),
    util = require('../util');

var server, db, notifierMock;
var databaseName = 'testDB_usageAPI.sqlite';

var configMock = util.getConfigMock(false);

// Necessary in order to avoid ERRADDRINUSE when call listening more than once
var appMock = {
    listen: function (port) {},
    use: function (middleware) {},
    set: function (property) {},
    get: function (path, middleware, handler) {},
    post: function (path, middleware, handler)  {}
};

var mocker = function (database, done) {

    var notifierMock;

    if (database === 'sql') {

        configMock.database.type = './db';
        configMock.database.name = databaseName;

        db = proxyquire('../../db', {
            './config': configMock
        });

        notifierMock = proxyquire('../../notifier', {
            './config': configMock,
            'winston': util.logMock,
            './db': db
        });

        server = proxyquire('../../server', {
            express: function () {
                return appMock;
            },
            './config': configMock,
            './db': db,
            './notifier': notifierMock
        });
    } else {

        var redis_host = test_config.redis_host;
        var redis_port = test_config.redis_port;

        if (! redis_host || ! redis_port) {
            done('Variable "redis_host" or "redis_port" are not defined in "config_tests.js".')
        } else {

            configMock.database.type = './db_Redis';
            configMock.database.name = test_config.redis_database;
            configMock.database.redis_host = redis_host;
            configMock.database.redis_port = redis_port;

            db = proxyquire('../../db_Redis', {
                './config': configMock
            });

            notifierMock = proxyquire('../../notifier', {
                './config': configMock,
                'winston': util.logMock,
                './db_Redis': db
            });

            server = proxyquire('../../server', {
                express: function () {
                    return appMock;
                },
                './config': configMock,
                '.db_Redis': db,
                './notifier': notifierMock
            });
        }
    }

    db.init(done);
};

console.log('[LOG]: starting an endpoint for testing...');
usageAPI_mock.run(test_config.usageAPI_port);

// Delete testing database
after(function (done) {
    util.removeDatabase(databaseName, done);
});

describe('Testing the usage notifier', function () {

    async.eachSeries(test_config.databases, function (database, taskCallback) {

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

            // Restore the default configMock values.
            afterEach(function () {
                configMock.usageAPI = {
                    host: 'localhost',
                    port: test_config.usageAPI_port,
                    path: ''
                };
            });

            after(function () {
                taskCallback();
            });

            it('should not send notifications when there is no API Key for notifications available', function (done) {

                var units = ['call', 'megabyte'];

                configMock.modules = {
                    accounting: units
                };

                server.init(function (err) {

                    db.getHref('call', function (err, href) {
                        if (err) {
                            done(err);
                        } else {
                            assert.equal(href, null);
                            assert.equal(err, null);

                            done();
                        }
                    });
                });
            });

            it('should call the callback with error when there is an error notifying specifications', function (done) {

                var unit = data.DEFAULT_UNIT;
                var token = data.DEFAULT_TOKEN;

                configMock.modules = {
                    accounting: [unit]
                };

                configMock.usageAPI = {
                    host: 'wrong',
                    port: '',
                    path: ''
                };

                var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
                var apiKey = data.DEFAULT_API_KEYS[0];
                var service = data.DEFAULT_SERVICES[0];
                var buy = data.DEFAULT_BUY_INFORMATION[0];
                var accounting = {
                    apiKey: apiKey,
                    value: 2
                };

                util.addToDatabase(db, [service], [buy], [], [], [accounting], [], token, function (err) {
                    if (err) {
                        done(err);
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
                var token = data.DEFAULT_TOKEN;
                var apiKey = data.DEFAULT_API_KEYS[0];

                configMock.modules = {
                    accounting: [unit]
                };

                var service = data.DEFAULT_SERVICES[0];
                var buy = data.DEFAULT_BUY_INFORMATION[0];
                var accounting = {
                    apiKey: apiKey,
                    value: 2
                };

                util.addToDatabase(db, [service], [buy], [], [], [accounting], [], token, function (err) {
                    if (err) {
                        done(err);
                    } else {

                        server.init(function (err) {
                            assert.equal(err, null);

                            db.getHref(unit, function (err, href) {
                                if (err) {
                                    done(err);
                                } else {
                                    assert.equal(href, 'http://localhost:9040/usageSpecification/2');
                                    db.getNotificationInfo(function (err, notificationInfo) {
                                        if (err) {
                                            done(err);
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