var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async');
    
var adminPaths = {
    keys: '/accounting_proxy/keys',
    units: '/accounting_proxy/units',
    newBuy: '/accounting_proxy/buys',
    checkUrl: '/accounting_proxy/urls',
}

var mocker = function (implementations, callback) {
    var mocks, spies, proxy_server;

    mocks = {
        app: {
            set: function (prop, value) {},
            listen: function (port) {},
            get: function (prop) {},
            use: function (middleware) {},
            post: function (path, middleware, handler) {}
        },
        expressWinston: {
            logger: function (transports) {}
        },
        req: {},
        res: {},
        config: {},
        api: {},
        notifier: {},
        cron: {},
        async: {
            series: async.series,
            each: async.each
        },
        url: {},
        requester: {
            request: {}
        },
        db: {},
        logger: {
            log: function (level, msg) {},
            info: function (msg) {},
            warn: function (msg) {},
            error: function (msg) {},
            transports: {
                File: function (options) {}
            }
        },
        contextBroker: {},
        acc_modules: {},
        accounter: {}
    }

    spies = {
        app: {},
        req: {},
        res: {},
        config: {},
        api: {},
        notifier: {},
        cron: {},
        async: {
            series: sinon.spy(mocks.async, 'series'),
            each: sinon.spy(mocks.async, 'each')
        },
        url: {},
        requester: {},
        db: {},
        logger: {
            log: sinon.spy(mocks.logger, 'log'),
            warn: sinon.spy(mocks.logger, 'warn'),
            info: sinon.spy(mocks.logger, 'info'),
            error: sinon.spy(mocks.logger, 'error')
        },
        contextBroker: {},
        acc_modules: {},
        accounter: {}
    }

    // Complete app_mock implementation and add spies
    if (implementations.config == undefined) {
        mocks.config = {
            accounting_proxy: {
                port: 9000
            }
        }
    } else if (implementations.config.accounting_proxy == undefined) {
        mocks.config.accounting_proxy = {
            port: 9000
        }
    }
    mocks.config.database = {
        type: './db'
    }
    mocks.config.api = {
        administration_paths: adminPaths
    }
    mocks.config.log = {
        file: 'file'
    };
    async.each(Object.keys(implementations), function (obj, task_callback1) {
        async.each(Object.keys(implementations[obj]), function (implem, task_callback2) {
            mocks[obj][implem.toString()] = implementations[obj][implem.toString()];
            if ( typeof implementations[obj][implem] == 'function' && implementations[obj][implem] != undefined) {
                if (obj == 'req' || obj == 'res') {
                    spies[obj][implem.toString()] = sinon.spy(implementations[obj], implem.toString());
                } else {
                    spies[obj][implem.toString()] = sinon.spy(mocks[obj], implem.toString());
                }
                task_callback2();
            } else {
                task_callback2();
            }
        }, function () {
            return task_callback1();
        });
    }, function () {
        // Mocking dependencies
        server = proxyquire('../../server', {
            express: function () {
                return mocks.app;
            },
            request: mocks.requester.request,
            './config': mocks.config,
            './db': mocks.db,
            'async': mocks.async,
            './APIServer': mocks.api,
            'winston': mocks.logger,
            './notifier': mocks.notifier,
            'node-schedule': mocks.cron,
            './acc_modules/megabyte': mocks.acc_modules,
            'url': mocks.url,
            'express-winston': mocks.expressWinston,
            './orion_context_broker/cb_handler': mocks.contextBroker,
            './accounter': mocks.accounter
        });
        return callback(server, spies);
    });
}

describe('Testing Server', function () {

    describe('Function "initialize"', function () {

        it('error initializing the database', function (done) {
            var implementations = {
                db: {
                    init: function (callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                server.init(function (err) {
                    assert.equal(err, 'Error starting the accounting-proxy. Error');
                    assert.equal(spies.async.series.callCount, 1);
                    assert.equal(spies.db.init.callCount, 1);
                    done();
                });
            });
        });

        it('error notifying the specifications', function (done) {
            var implementations = {
                db: {
                    init: function (callback) {
                        return callback(null);
                    }
                },
                notifier: {
                    notifyUsageSpecification: function (callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                server.init(function (err) {
                    assert.equal(err, 'Error starting the accounting-proxy. Error');
                    assert.equal(spies.async.series.callCount, 1);
                    assert.equal(spies.db.init.callCount, 1);
                    assert.equal(spies.notifier.notifyUsageSpecification.callCount, 1);
                    done();
                });
            });
        });

        it('error notifying the usage', function (done) {
            var implementations = {
                db: {
                    init: function (callback) {
                        return callback(null);
                    }
                },
                notifier: {
                    notifyUsageSpecification: function (callback) {
                        return callback(null);
                    },
                    notifyUsage: function (callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                server.init(function (err) {
                    assert.equal(err, 'Error starting the accounting-proxy. Error');
                    assert.equal(spies.async.series.callCount, 1);
                    assert.equal(spies.db.init.callCount, 1);
                    assert.equal(spies.notifier.notifyUsageSpecification.callCount, 1);
                    assert.equal(spies.notifier.notifyUsage.callCount, 1);
                    done();
                });
            });
        });

        it('error notifying the accounting (cron service)', function (done) {
            var cron = false;
            var port = 9000;
            var implementations = {
                db: {
                    init: function (callback) {
                        return callback(null);
                    }
                },
                notifier: {
                    notifyUsageSpecification: function (callback) {
                        return callback(null);
                    },
                    notifyUsage: function (callback) {
                        if (cron) {
                            cron = false;
                            return callback('Error');
                        } else {
                            cron = true;
                            return callback(null);
                        }
                    }
                },
                cron: {
                    scheduleJob: function (config, callback) {
                        return callback();
                    }
                },
                app: {
                    listen: function (port) {},
                    get: function (prop) {
                        return port;
                    }
                },
                contextBroker: {
                    run: function () {}
                },
                config: {
                    resources: {
                        contextBroker: true
                    },
                    usageAPI: {
                        schedule: '00 00 * * *'
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                server.init(function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.async.series.callCount, 1);
                    assert.equal(spies.db.init.callCount, 1);
                    assert.equal(spies.notifier.notifyUsageSpecification.callCount, 1);
                    assert.equal(spies.notifier.notifyUsage.callCount, 2);
                    assert.equal(spies.cron.scheduleJob.callCount, 1);
                    assert.equal(spies.cron.scheduleJob.getCall(0).args[0], implementations.config.usageAPI.schedule);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Loading module for Orion Context Broker...');
                    assert.equal(spies.contextBroker.run.callCount, 1);
                    assert.equal(spies.logger.error.callCount, 1);
                    assert.equal(spies.logger.error.getCall(0).args[0], 'Error while notifying the accounting: Error');
                    assert.equal(spies.app.listen.callCount, 1);
                    assert.equal(spies.app.listen.getCall(0).args[0], port);
                    assert.equal(spies.app.get.callCount, 3);
                    assert.equal(spies.app.get.getCall(2).args[0], 'port');
                    done();
                });
            });
        });

        
    });

    describe('[Admin]', function () {

        it('error getting url from dtabase', function (done) {
            var userId = 'admin';
            var publicPath = '/publicPath';
            var implementations = {
                app: {
                    use: function (path, middleware, middleware, handler) {
                        if (path === '/') {
                            return handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return undefined;
                    },
                    user: {id: userId},
                    publicPath: publicPath
                },
                res:{
                    status: function (code) {
                        return this;
                    },
                    send: function () {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback('Error', null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('error redirecting the request to the service', function (done) {
            var userId = 'admin';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware, middleware, handler) {
                        if (path === '/') {
                            return handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return undefined;
                    },
                    method: method,
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {}
                },
                res:{
                    status: function (code) {
                        return this;
                    },
                    send: function () {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, url);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback('Error', {}, null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.requester.request.callCount, 1);
                assert.equal(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.equal(spies.requester.request.getCall(0).args[0].method, method);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {});
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 504);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('correct redirection to the service', function (done) {
            var userId = 'admin';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return undefined;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    method: method,
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {}
                },
                res:{
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, url);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {headers: {'header1': 'value1'}}, null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].method, method);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {});
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });
    });

    describe('[No Admin | REST API]', function () {

        it('error, "API-KEY" header missing', function (done) {
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return undefined;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                },
                res:{
                    json: function (json) {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.logger.log.callCount, 1);
                assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
                assert.equal(spies.logger.log.getCall(0).args[1], 'Undefined API_KEY');
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Undefined "X-API-KEY" header'});
                done();
            });
        });

        it('error checking the request', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback('Error', null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('error, invalid api-key or user', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                },
                res:{
                    json: function (json) {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, false);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0],{ error: 'Invalid API_KEY or user'});
                done();
            });
        });

        it('error getting accounting info', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback('Error', null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('error, no accounting info available', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'GET';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) {},
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('error sending the request to the service', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'POST';
            var unit = 'megabyte';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return false
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    }
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    }
                },
                config: {
                    resources: {
                        contextBroker: false
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback('Error', {}, null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].method, method);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {});
                assert.deepEqual(spies.requester.request.getCall(0).args[0].body, '');
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 504);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('error making the accounting (invalid unit)', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'POST';
            var unit = 'wrong';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return false
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    },
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    }
                },
                config: {
                    resources: {
                        contextBroker: false
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {headers: {'header1': 'value1'}}, {});
                    }
                },
                notifier: {
                    acc_modules: {}
                },
                accounter: {
                    count: function (apiKey, unit, countInfo, countFunction, callback) {
                        return callback('invalid accounting unit "' + unit + '"');
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].method, method);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {});
                assert.deepEqual(spies.requester.request.getCall(0).args[0].body, '');
                assert.equal(spies.res.setHeader.callCount, 1);
                assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                assert.equal(spies.res.setHeader.getCall(0).args[1], 'value1');
                assert.equal(spies.accounter.count.callCount, 1);
                assert.equal(spies.accounter.count.getCall(0).args[0], apiKey);
                assert.equal(spies.accounter.count.getCall(0).args[1], unit);
                assert.equal(spies.accounter.count.getCall(0).args[3], 'count');
                assert.equal(spies.logger.warn.callCount, 1);
                assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] Error making the accounting: invalid accounting unit "' + unit + '"');
                assert.equal(spies.logger.warn.getCall(0).args[1], apiKey);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('correct', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/restPath';
            var url = 'http://localhost:9000/path';
            var method = 'POST';
            var unit = 'megabyte';
            var amount = 1.357;
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return false
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    send: function () {},
                    status: function (code) {
                        return this;
                    },
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    },
                    makeAccounting: function (apiKey, amount, callback) {
                        return callback(null);
                    }
                },
                config: {
                    resources: {
                        contextBroker: false
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {headers: {'header1': 'value1'}}, {});
                    }
                },
                notifier: {
                    acc_modules: {
                        megabyte: {
                            count: function (body, callback) {
                                return callback(null, amount);
                            }
                        }
                    }
                },
                accounter: {
                    count: function (apiKey, unit, countInfo, countFunction, callback) {
                        return callback(null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].method, method);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {});
                assert.deepEqual(spies.requester.request.getCall(0).args[0].body, '');
                assert.equal(spies.accounter.count.callCount, 1);
                assert.equal(spies.accounter.count.getCall(0).args[0], apiKey);
                assert.equal(spies.accounter.count.getCall(0).args[1], unit);
                assert.equal(spies.accounter.count.getCall(0).args[3], 'count');
                assert.equal(spies.res.setHeader.callCount, 1);
                assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                assert.equal(spies.res.setHeader.getCall(0).args[1], 'value1');
                assert.equal(spies.res.send.callCount, 1);
                assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                done();
            });
        });
    });

    describe('[No Admin | Context Broker]', function () {

        it('error, Content-Type is not a JSON', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/v1/subscribeContext';
            var url = 'http://localhost:1026';
            var method = 'POST';
            var unit = 'megabyte';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return false
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    json: function (JSON) {},
                    status: function (code) {
                        return this;
                    },
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    }
                },
                config: {
                    resources: {
                        contextBroker: true
                    }
                },
                url: {
                    parse: function (url) {
                        return { pathname: restPath}
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 1);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 415);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Content-Type must be "application/json"'});
                done();
            });
        });

        it('error handling the subscription/unsubscription', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/v1/subscribeContext';
            var url = 'http://localhost:1026';
            var method = 'POST';
            var unit = 'megabyte';
            var operation = 'subscribe';
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return true;
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('{}');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    json: function (JSON) {},
                    status: function (code) {
                        return this;
                    },
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    }
                },
                config: {
                    resources: {
                        contextBroker: true
                    }
                },
                url: {
                    parse: function (url) {
                        return { pathname: restPath}
                    }
                },
                contextBroker: {
                    getOperation: function (path, req, callback) {
                        return callback(operation);
                    },
                    subscriptionHandler: function (req, res, url, operation, unit, callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 2);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.contextBroker.getOperation.callCount, 1);
                assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], restPath);
                assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
                assert.equal(spies.contextBroker.subscriptionHandler.callCount, 1);
                assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[0], implementations.req);
                assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[2], url + restPath);
                assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[3], operation);
                assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[4], unit);
                assert.equal(spies.logger.warn.callCount, 1);
                assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] Error');
                done();
            });
        });

        it('correct', function (done) {
            var apiKey = 'apiKey';
            var userId = 'user';
            var publicPath = '/publicPath';
            var restPath = '/v1/subscribeContext';
            var url = 'http://localhost:1026';
            var method = 'POST';
            var unit = 'megabyte';
            var operation = 'another';
            var amount = 1.357;
            var implementations = {
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                req: {
                    is: function (type) { 
                        return true;
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback('{}');
                    },
                    user: {id: userId},
                    publicPath: publicPath,
                    restPath: restPath,
                    headers: {},
                    method: method
                },
                res:{
                    send: function (JSON) {},
                    status: function (code) {
                        return this;
                    },
                    setHeader: function (header, value) {}
                },
                db: {
                    getAdminUrl: function (userId, publicPath, callback) {
                        return callback(null, null);
                    },
                    checkRequest: function (userId, apiKey, publicPath, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, {url: url, unit: unit});
                    },
                    makeAccounting: function (apiKey, amount, callback) {
                        return callback(null);
                    }
                },
                config: {
                    resources: {
                        contextBroker: true
                    }
                },
                url: {
                    parse: function (url) {
                        return { pathname: restPath}
                    }
                },
                contextBroker: {
                    getOperation: function (path, req, callback) {
                        return callback(operation);
                    },
                    subscriptionHandler: function (req, res, url, unit, operation, callback) {
                        return callback('Error');
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {headers: {'header1': 'value1'}}, {});
                    }
                },
                notifier: {
                    acc_modules: {
                        megabyte: {
                            count: function (body, callback) {
                                return callback(null, amount);
                            }
                        }
                    }
                },
                accounter: {
                    count: function (apiKey, unit, countInfo, countFunction, callback) {
                        return callback(null);
                    }
                }
            }
            mocker(implementations, function (server, spies) {
                assert.equal(spies.req.on.callCount, 2);
                assert.equal(spies.req.on.getCall(0).args[0], 'data');
                assert.equal(spies.req.on.getCall(1).args[0], 'end');
                assert.equal(spies.req.get.callCount, 2);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
                assert.equal(spies.req.is.callCount, 2);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.req.is.getCall(1).args[0], 'application/json');
                assert.equal(spies.db.getAdminUrl.callCount, 1);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[0], userId);
                assert.equal(spies.db.getAdminUrl.getCall(0).args[1], publicPath);
                assert.equal(spies.db.checkRequest.callCount, 1);
                assert.equal(spies.db.checkRequest.getCall(0).args[0], userId);
                assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
                assert.equal(spies.db.checkRequest.getCall(0).args[2], publicPath);
                assert.equal(spies.db.getAccountingInfo.callCount, 1);
                assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
                assert.equal(spies.contextBroker.getOperation.callCount, 1);
                assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], restPath);
                assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].url, url + restPath);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].method, 'POST');
                assert.deepEqual(spies.requester.request.getCall(0).args[0].json, true);
                assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {'content-length': undefined });
                assert.deepEqual(spies.requester.request.getCall(0).args[0].body, {});
                assert.equal(spies.res.setHeader.callCount, 1);
                assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                assert.equal(spies.res.setHeader.getCall(0).args[1], 'value1');
                assert.equal(spies.accounter.count.callCount, 1);
                assert.equal(spies.accounter.count.getCall(0).args[0], apiKey);
                assert.equal(spies.accounter.count.getCall(0).args[1], unit);
                assert.equal(spies.accounter.count.getCall(0).args[3], 'count');
                assert.equal(spies.res.send.callCount, 1);
                assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                done();
            });
        });
    });
});