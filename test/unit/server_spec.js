var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async'),
    data = require('../data'),
    util = require('../util');

var DEFAULT_CONFIG = {
    database: {
        type: './db'
    },
    accounting_proxy: {
        port: 9000
    },
    log: {
        file: 'file'
    },
    api: {
        administration_paths: data.DEFAULT_ADMINISTRATION_PATHS
    }
};

var mocker = function (implementations, callback) {

    util.getSpies(implementations, function (spies) {

        // Add default configuration
        var config = implementations.config ? implementations.config : DEFAULT_CONFIG;
        if (implementations.config) {
            for (var key in DEFAULT_CONFIG) {
                if (config[key] === undefined) {
                    config[key] = DEFAULT_CONFIG[key]
                }
            };
        }

        var app = implementations.app ? implementations.app : {};
        app.use = app.use ? app.use : function (path, middleware1, middleware2, handler) {}
        app.set = function (property, value) {} ;
        app.post = function (path, middleware1, middleware2, middleware3, handler) {};
        app.get = app.get ? app.get : function (path, middleware, handler) {};

        var logger = implementations.logger ? implementations.logger : {};
        logger.transports = {
            File: function (options) {}
        };

        var utilMock = {
            getBody: function (req, res, callback) {
                return callback();
            },
            validateCert: function (req, res, callback) {
                return callback();
            }
        };

        var server = proxyquire('../../server', {
            express: function () {
                return app;
            },
            request: implementations.requester ? implementations.requester.request : {},
            './config': config,
            './db': implementations.db ? implementations.db : {},
            './APIServer': implementations.api ? implementations.api : {},
            'winston': logger,
            './notifier': implementations.notifier ? implementations.notifier : {},
            'node-schedule': implementations.cron ? implementations.cron : {},
            './acc_modules/megabyte': implementations.accModule ? implementations.accModule : {},
            'url': implementations.url ? implementations.url : {},
            'express-winston': {logger: function (transports) {} },
            './orion_context_broker/cbHandler': implementations.contextBroker ? implementations.contextBroker : {},
            './accounter': implementations.accounter ? implementations.accounter : {},
            './OAuth2_authentication': implementations.authenticator ? implementations.authenticator : {},
            'https': implementations.https ? implementations.https : {},
            'fs': implementations.fs ? implementations.fs : {},
            './util': utilMock
        });

        return callback(server, spies);
    });
}

describe('Testing Server', function () {

    var testInitAndStop = function (initErr, unit, notifyErr, notifyErrCron, stopErr, getAccModules, enableHttps, done) {

            var port = data.DEFAULT_PORT;
            var notifyCallCount = 0;
            var mockConfig = util.getConfigMock(true, enableHttps);
            mockConfig.database.type = './db';
            mockConfig.modules = {
                accounting: [unit]
            };

            var implementations = {
                db: {
                    init: function (callback) {
                        return callback(initErr)
                    }
                },
                notifier: {
                    notifyAllUsage: function (callback) {
                        notifyCallCount += 1;

                        if (notifyCallCount === 1) {
                            return callback(notifyErr);
                        } else {
                            return callback(notifyErrCron);
                        }
                    }
                },
                config: mockConfig,
                cron: {
                    scheduleJob: function (schedule, callback) {
                        return callback(true)
                    }
                },
                app: {
                    get: function (property) {
                        return port;
                    }
                },
                logger: {
                    error: function (msg) {},
                    info: function (msg) {}
                },
                contextBroker: {
                    run: function () {}
                },
                server: {
                    close: function (callback) {
                        return callback(stopErr);
                    }
                },
                https: {
                    createServer: function (opts, app) {
                        return app;
                    }
                },
                fs: {
                    readFileSync: function (file) {
                        return 'file content';
                    }
                }
            };

            implementations.app.listen = function (port) {
                return implementations.server;
            };

            var options = {
                cert: 'file content',
                key: 'file content',
                ca: 'file content',
                requestCert: true,
                rejectUnauthorized: false
            };

            mocker(implementations, function (server, spies) {

                server.init(function (err) {

                    assert(spies.db.init.calledOnce);

                    if (initErr) {
                        assert.equal(err, 'Error starting the accounting-proxy. ' + initErr);
                    } else if (unit !== data.DEFAULT_UNIT) {
                        assert.equal(err, 'Error starting the accounting-proxy. ' + 
                            'No accounting module for unit "' + unit + '" : missing file acc_modules/' + unit + '.js');
                    } else if (notifyErr) {
                        assert.equal(err, 'Error starting the accounting-proxy. ' + notifyErr);
                    } else {

                        assert(spies.logger.info.calledWith('Loading modules for Orion Context Broker...'));
                        assert(spies.contextBroker.run.calledOnce);
                        assert(spies.cron.scheduleJob.calledWith(implementations.config.usageAPI.schedule));
                        assert(spies.notifier.notifyAllUsage.calledTwice);
                        assert(spies.logger.error.calledWith('Error while notifying the accounting: ' + notifyErrCron));

                        if (enableHttps) {
                            assert(spies.fs.readFileSync.calledWith(implementations.config.accounting_proxy.https.certFile));
                            assert(spies.fs.readFileSync.calledWith(implementations.config.accounting_proxy.https.keyFile));
                            assert(spies.fs.readFileSync.calledWith(implementations.config.accounting_proxy.https.caFile));
                            assert(spies.https.createServer.calledWith(options));
                        }

                        assert(spies.app.get.calledWith('port'));
                        assert(spies.app.listen.calledWith(port));

                        if (stopErr !== undefined) {

                            server.stop(function (err) {
                                assert.equal(err, stopErr);
                            });
                        }

                        if (getAccModules) {

                            var accModules = {};
                            accModules[unit] = {};

                            assert.deepEqual(server.getAccountingModules(), accModules);
                        }
                    }

                    done();
                });
            });
        };

    describe('Function "initialize"', function () {

        it('should call the callback with error when db fails initializing', function (done) {
            testInitAndStop(true, null, false, false, undefined, false, false, done);
        });

        it('should call the callback with error when there is no accounting module for an accounting unit', function (done) {
            testInitAndStop(false, 'wrong', false, false, undefined, false, false, done);
        });

        it('should call the callback with error when there is an error notifying the usage', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, true, false, undefined, false, false, done);
        });

        it('should call the callback without error and initialize the proxy when there is no error initializing over http', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, false, true, undefined, false, false, done);
        });

        it('should call the callback without error and initialize the proxy when there is no error initializing over https', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, false, true, undefined, false, true, done);
        });
    });

    describe('Function "stop"', function () {

        it('should call the callback with error when there is an error stopping the server', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, false, true, 'Error', false, false, done);
        });

        it('should call the callback without error when there is no error stopping the server', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, false, true, null, false, false, done);
        });
    });

    describe('Function "getAccountingModules"', function () {

        it('should return the accounting modules when they have been loaded', function (done) {
            testInitAndStop(false, data.DEFAULT_UNIT, false, true, undefined, true, false, done);
        });
    });

    describe('Function "handler"', function () {

        var testHandler = function (adminInfo, getAdminURLErr, apiKey, checkReqErr, checkReqRes, getAccInfoErr, done) {

            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
            var userId = data.DEFAULT_USER_ID;
            var method = data.DEFAULT_HTTP_METHODS_LIST[0];

            var implementations = {
                req: {
                    get: function (header) {
                        return apiKey;
                    },
                    on: function (event, callback) {
                        return callback();
                    },
                    publicPath: publicPath,
                    user: {
                        id: userId
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                db: {
                    getAdminURL: function (userId, path, method, callback) {
                        return callback(getAdminURLErr, adminInfo);
                    },
                    checkRequest: function (userId, apiKey, path, method, callback) {
                        return callback(checkReqErr, checkReqRes);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(getAccInfoErr, null);
                    }
                },
                logger: {
                    log: function (level, msg) {}
                },
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            middleware2(implementations.req, implementations.res, function () {});
                            handler(implementations.req, implementations.res);
                        }
                    }
                }
            };

            mocker(implementations, function (server, spies) {

                assert(spies.req.get.calledWith('X-API-KEY'));
                assert(spies.db.getAdminURL.calledWith(userId, publicPath));

                if (getAdminURLErr) {

                    assert(spies.res.status.calledWith(500));
                    assert(spies.res.json.calledWith({error: getAdminURLErr}));

                } else if (adminInfo.isAdmin) {

                    if (adminInfo.errorCode === 'method') {
                        assert(spies.res.status.calledWith(405));
                        assert(spies.res.json.calledWith({error: adminInfo.errorMsg}));
                    }

                } else { 

                    if (!apiKey) {

                        assert(spies.logger.log.calledWith('debug', 'Undefined API_KEY'));
                        assert(spies.res.status.calledWith(401));
                        assert(spies.res.json.calledWith({ error: 'Undefined "X-API-KEY" header'}));

                    } else {

                        assert(spies.db.checkRequest.calledWith(userId, apiKey, publicPath));

                        if (checkReqErr) {

                            assert(spies.res.status.calledWith(500));
                            assert(spies.res.send.calledOnce);

                        } else if (!checkReqRes.isCorrect) {

                            if (checkReqRes.errorCode === 'apiKey') {
                                assert(spies.res.status.calledWith(401));
                                assert(spies.res.json.calledWith({error: checkReqRes.errorMsg}));

                            } else if (checkReqRes.errorCode === 'method') {
                                assert(spies.res.status.calledWith(405));
                                assert(spies.res.json.calledWith({error: checkReqRes.errorMsg}));

                            }

                        } else {

                            assert(spies.db.getAccountingInfo.calledWith(apiKey));
                            assert(spies.res.status.calledWith(500));
                            assert(spies.res.send.calledOnce);

                        }
                    }
                }

                done();
            });
        };

        it('should return 500 when db fails getting admin URLs', function (done) {
            testHandler({isAdmin: false}, true, null, false, false, false, done);
        });

        it('should return 401 when there is no API-Key in the reques headers', function (done) {
            testHandler({isAdmin: false}, false, undefined, false, null, false, done);
        });

        it('should return 500 when db fails checking the request', function (done) {
            testHandler({isAdmin: false}, false, data.DEFAULT_API_KEYS[0], true, null, false, done);
        });

        it('should return 405 when request method is not a valid http method and the user is an admin', function (done) {
            var adminInfo = {isAdmin: true, errorCode: 'method', errorMsg: 'Error'};

            testHandler(adminInfo, false, data.DEFAULT_API_KEYS[0], true, null, false, done); 
        });

        it('should return 401 when the apiKey or user is invalid', function (done) {
            var checkReqRes = {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Error'};

            testHandler({isAdmin: false}, false, data.DEFAULT_API_KEYS[0], false, checkReqRes, false, done);
        });

        it('should return 405 when the request method is not a valid http method', function (done) {
            var checkReqRes = {isCorrect: false, errorCode: 'method', errorM: 'Error'};

            testHandler({isAdmin: false}, false, data.DEFAULT_API_KEYS[0], false, checkReqRes, false, done);
        });

        it('should return 500 when db fails getting the accounting information', function (done) {
            testHandler({isAdmin: false}, false, data.DEFAULT_API_KEYS[0], false, true, true, done);
        });

        it('should return 500 whenthere is no accounting information', function (done) {
            testHandler({isAdmin: false}, false, data.DEFAULT_API_KEYS[0], false, true, false, done);
        });
    });

    describe('Admin user request', function (done) {

        var testAdminRequest = function (wrongBody, requestErr, done) {

            var url = data.DEFAULT_URLS[0];
            var restPath = '/rest';
            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
            var userId = data.DEFAULT_USER_ID;
            var method = 'POST';
            var headers = {};
            var respBody = {};
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };

            var options = {
                url: url + restPath,
                method: method,
                headers: {'content-length': undefined},
                json: true,
                body: {},
                time: true
            };

            var implementations = {
                req:  {
                    method: method,
                    headers: headers,
                    restURL: restPath,
                    body: wrongBody ? '{' : '{}',
                    publicPath: publicPath,
                    user: {
                        id: userId
                    },
                    is: function (mimeType) {
                        return true;
                    },
                    get: function (header) {
                        return undefined;
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function () {},
                    setHeader: function (header, value) {},
                    json: function (json) {}
                },
                db: {
                    getAdminURL: function (userId, path, method, callback) {
                        return callback(null, {isAdmin: true, url: url});
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, respBody);
                    }
                },
                logger: {
                    warn: function (msg, param) {}
                },
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path === '/') {
                            handler(implementations.req, implementations.res);
                        }
                    }
                }
            };

            mocker(implementations, function (server, spies) {

                assert(spies.req.get.calledWith('X-API-KEY'));
                assert(spies.db.getAdminURL.calledWith(userId, publicPath));

                if (wrongBody) {

                    assert(spies.res.status.calledWith(400));
                    assert(spies.res.json.calledWith({error: 'Invalid JSON'}));

                } else {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {

                    assert(spies.res.status.calledWith(504));
                    assert(spies.res.send.calledOnce);
                    assert(spies.logger.warn.calledWith('[%s] An error ocurred requesting the endpoint: ' + options.url, null));

                    } else {

                        for (var key in resp.headers) {
                            assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                        }
                        assert(spies.res.status.calledWith(resp.statusCode));
                        assert(spies.res.send.calledWith(respBody));
                    }
                }

                done();
            });
        };

        it('should return 400 when the body is an invalid JSON', function (done) {
            testAdminRequest(true, false, done);
        });

        it('should return 504 when there is a problem sending request to the service', function (done) {
            testAdminRequest(false, true, done);
        });

        it('should redirect the response to the administrator when there is no error sending the request to the service', function (done) {
            testAdminRequest(false, false, done);
        });
    });

    describe('Normal user request', function () {

        var testUserRequest = function (contextBroker, isJson, operation, requestErr, countErr, getTypeError, isCBService, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var url = data.DEFAULT_URLS[0];
            var cbPath = '/v1/entities';
            var method = 'POST';
            var unit = data.DEFAULT_UNIT;
            var restURL = '/rest';
            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
            var userId = data.DEFAULT_USER_ID;
            var body = isJson ? '{}' : {};
            var statusCode = 504;
            var respBody = '';

            var accountingInfo = {
                url: url,
                unit: unit
            };
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var respBody = {};

            var options = {
                url: url + restURL,
                method: method,
                headers: {},
                body: {},
                time: true
            };

            var implementations = {
                req: {
                    method: method,
                    headers: {},
                    restURL: restURL,
                    user: {
                        id: userId
                    },
                    publicPath: publicPath,
                    body: body,
                    get: function (header) {
                        return apiKey;
                    },
                    is: function (mimeType) {
                        return isJson;
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {},
                    json: function (msg) {}
                },
                db: {
                    getAdminURL: function (userId, path, method, callback) {
                        return callback(null, {isAdmin: false});
                    },
                    checkRequest: function (userId, apiKey, path, method, callback) {
                        return callback(null, true);
                    },
                    getAccountingInfo: function (apiKey, callback) {
                        return callback(null, accountingInfo);
                    },
                    isCBService: function (publicPath, callback) {
                        return callback(getTypeError, isCBService)
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, respBody);
                    }
                },
                app: {
                    use: function (path, middleware1, middleware2, handler) {
                        if (path == '/') {
                            handler(implementations.req, implementations.res);
                        }
                    }
                },
                accounter: {
                    count: function (apiKey, unit, requestInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                },
                contextBroker: {
                    getOperation: function (path, req, callback) {
                        return callback(operation)
                    },
                    subscriptionHandler: function (req, res, options, operation, unit, version, callback) {
                        return callback('Error', {
                            status: statusCode,
                            body: respBody
                        });
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            pathname: cbPath
                        };
                    }
                },
                logger: {
                    warn: function (msg, param) {}
                },
                config: {
                    resources: {
                        contextBroker: contextBroker
                    }
                }
            };

            mocker(implementations, function (server, spies) {

                assert(spies.req.get.calledWith('X-API-KEY'));
                assert(spies.db.getAdminURL.calledWith(userId, publicPath));
                assert(spies.db.checkRequest.calledWith(userId, apiKey, publicPath));
                assert(spies.db.getAccountingInfo.calledWith(apiKey));
                assert(spies.req.is.calledWith('application/json'));

                if (!contextBroker || (contextBroker && isCBService === null && !getTypeError)) {
                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {

                        assert(spies.res.status.calledWith(504));
                        assert(spies.res.send.calledOnce);
                        assert(spies.logger.warn.calledWith('[%s] An error ocurred requesting the endpoint: ' + options.url, apiKey));

                    } else {

                        for (var key in resp.headers) {
                            assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                        }
                        assert(spies.accounter.count.calledWith(apiKey, unit));

                        if (countErr) {

                            assert(spies.logger.warn.calledWith('[%s] Error making the accounting: ' + countErr.msg, apiKey));
                            assert(spies.res.status.calledWith(500));
                            assert(spies.res.send.calledOnce);

                        } else {

                            assert(spies.res.status.calledWith(resp.statusCode));
                            assert(spies.res.send.calledWith(respBody));

                        }
                    }

                } else {
                    assert(spies.db.isCBService.calledWith(publicPath));

                    if (getTypeError) {
                        assert(spies.logger.warn.calledWith('[%s] ' + getTypeError));
                        assert(spies.res.status.calledWith(500));
                        assert(spies.res.send.calledOnce);

                    } else {
                        assert(spies.url.parse.calledWith(options.url));

                        if (!isJson) {
                            assert(spies.res.status.calledWith(415));
                            assert(spies.res.json.calledWith({error: 'Content-Type must be "application/json"'}));
                        } else {
                            assert(spies.url.parse.calledTwice);
                            assert(spies.contextBroker.getOperation.calledWith(cbPath, implementations.req));

                            if (operation) {
                                assert(spies.logger.warn.calledWith('[%s] ' + 'Error', apiKey));
                                assert(spies.res.status.calledWith(statusCode));
                                assert(spies.res.send.calledWith(respBody));
                            }
                        }
                    }
                }

                done();
            });
        };

        it('should return 504 when there is an error sending the request to the service', function (done) {
            testUserRequest(false, false, null, true, null, null, null, done);
        });

        it('should return 500 when there is an error making the accounting', function (done) {
            testUserRequest(false, false, null, false, {msg: 'Error'}, null, null, done);
        });

        it('should return the service response and make the accounting when there is no error', function (done) {
            testUserRequest(false, false, null, false, null, null, null, done);
        });

        it('should return the service response and make the accounting when there is no error (context broker modules load)', function (done) {
            testUserRequest(true, false, null, false, null, false, null, done);
        });

        it('should return 500 when the db fails getting the service type', function (done) {
            testUserRequest(true, false, 'updateSubscription', false, null, 'Error', null, done);
        });

        it('should return 415 when the CB request mime type is not "application/json"', function (done) {
            testUserRequest(true, false, 'updateSubscription', false, null, false, true, done);
        });

        it('should return 415 when the CB request mime type is not "application/json"', function (done) {
            testUserRequest(true, false, 'updateSubscription', false, null, false, true, done);
        });

        it('should return the CB response and make the accounting when there is no error (updateSubscription)', function (done) {
            testUserRequest(true, true, 'update', false, null, false, true, done);
        });

        it('should return the CB response and make the accounting when there is no error (GET entities)', function (done) {
            testUserRequest(true, true, null, false, null, false, true, done);
        });
    });
});