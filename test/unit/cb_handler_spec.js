var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async');

var mocker = function(implementations, callback) {
    var mocks, spies, cb_handler;

    // Create mocks and spies
    var logger = {
        error: function(msg) {}
    }
    mocks = {
        app: {
            use: function(middleware) {},
            set: function(key, value) {},
            post: function(path, handler) {}
        },
        config: {
            database: {
                type: './db' 
            },
            resources: {
                notification_port: 9002
            }
        },
        db: {},
        async: {
            forEachOf: async.forEachOf
        },
        req: {},
        res: {},
        requester: {
            request: function(options, callback) {}
        },
        url: {},
        server: {},
        subsUrls: {}
    }
    spies = {
        logger: {
            error: sinon.spy(logger, 'error')
        },
        app: {},
        config: {},
        db: {},
        async: {
            forEachOf: sinon.spy(mocks.async, 'forEachOf')
        },
        req: {},
        res: {},
        requester: {},
        url: {},
        server: {},
        subsUrls: {}
    }

    // Complete app_mock implementation and add spies
    async.each(Object.keys(implementations), function(obj, task_callback1) {
        async.each(Object.keys(implementations[obj]), function(implem, task_callback2) {
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
        }, function() {
            return task_callback1();
        });
    }, function() {
        // Mocking dependencies
        mocks.server.logger = logger;
        cb_handler = proxyquire('../../orion_context_broker/cb_handler', {
            express: function() {
                return mocks.app;
            },
            '../config': mocks.config,
            '.././db': mocks.db,
            'async': mocks.async,
            request: mocks.requester.request,
            'url': mocks.url,
            '../server': mocks.server,
            './subsUrls': mocks.subsUrls,
            'winston': logger
        });
        return callback(cb_handler, spies);
    });
}

describe('Testing ContextBroker Handler', function() {

    describe('Function "init"', function() {

        it('correct initialization', function() {
            var port = 9002;
            var implementations = {
                app: {
                    listen: function(port) {},
                    get: function(prop) {
                        return port;
                    },
                    use: function(middleware) {},
                    set: function(prop, value) {},
                    post: function(path, handler) {}
                },
                config: {
                    database: {
                        type: './db'
                    },
                    resources: {
                        notification_port: port
                    }
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.run();
                assert.equal(spies.app.use.callCount, 1);
                assert.equal(spies.app.set.callCount, 1);
                assert.equal(spies.app.set.getCall(0).args[0], 'port');
                assert.equal(spies.app.set.getCall(0).args[1], port);
                assert.equal(spies.app.post.callCount, 1);
                assert.equal(spies.app.post.getCall(0).args[0], '/subscriptions');
                assert.equal(spies.app.get.callCount, 1);
                assert.equal(spies.app.get.getCall(0).args[0], 'port');
                assert.equal(spies.app.listen.callCount, 1);
                assert.equal(spies.app.listen.getCall(0).args[0], port);
            });
        });
    });

    describe('Function "getOperation"', function() {

        it('correct, subscription operation', function(done) {
            var path = '/subs_path';
            var subsUrls = [
                ['DELETE', '/unsubs_path', 'unsubscribe'],
                ['POST', path, 'subscribe']
            ]
            var implementations = {
                subsUrls: subsUrls,
                req: {
                    method: 'POST'
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.getOperation(path, implementations.req, function(operation) {
                    assert.equal(operation, 'subscribe');
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0],  { 
                        '0': [ 'DELETE', '/unsubs_path', 'unsubscribe' ],
                          '1': [ 'POST', '/subs_path', 'subscribe' ] });
                    done();
                });
            });
        });

        it('correct, unsubscription operation', function(done) {
            var path = '/unsubs_path';
            var subsUrls = [
                ['DELETE', path, 'unsubscribe'],
                ['POST', '/subs_path', 'subscribe']
            ]
            var implementations = {
                subsUrls: subsUrls,
                req: {
                    method: 'DELETE'
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.getOperation(path, implementations.req, function(operation) {
                    assert.equal(operation, 'unsubscribe');
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0],  { 
                        '0': [ 'DELETE', '/unsubs_path', 'unsubscribe' ],
                          '1': [ 'POST', '/subs_path', 'subscribe' ] });
                    done();
                });
            });
        });

        it('correct, administration operation', function(done) {
            var path = '/administration';
            var subsUrls = [
                ['DELETE', '/unsubs_path', 'unsubscribe'],
                ['POST', '/subs_path', 'subscribe']
            ]
            var implementations = {
                subsUrls: subsUrls,
                req: {
                    method: 'DELETE'
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.getOperation(path, implementations.req, function(operation) {
                    assert.equal(operation, null);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0],  { 
                        '0': [ 'DELETE', '/unsubs_path', 'unsubscribe' ],
                          '1': [ 'POST', '/subs_path', 'subscribe' ] });
                    done();
                });
            });
        });
    });

    describe('Function "notificationHandler"', function(done) {

        it('error getting subscription information from databse', function(done) {
            var subscriptionId = 'subscriptionId';
            var implementations = {
                db: {
                    getCBSubscription: function(subscriptionId, callback) {
                        return callback('Error', null);
                    }
                },
                req: {
                    body: {
                        subscriptionId: subscriptionId
                    }
                },
                res: {

                },
                app: {
                    post: function(path, handler) {
                        return handler(implementations.req, implementations.res);
                    }
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                assert.equal(spies.db.getCBSubscription.callCount, 1);
                assert.equal(spies.db.getCBSubscription.getCall(0).args[0], subscriptionId);
                assert.equal(spies.logger.error.callCount, 1);
                assert.equal(spies.logger.error.getCall(0).args[0], 'An error ocurred while making the accounting: Invalid subscriptionId');
                done();
            });
        });

        it('error making the accounting', function(done) {
            var subscriptionId = 'subscriptionId';
            var body = {
                subscriptionId: subscriptionId
            }
            var subscriptionInfo = {
                apiKey: 'apiKey',
                unit: 'megabyte',
                notificationUrl: 'http://example.com/path'
            }
            var implementations = {
                db: {
                    getCBSubscription: function(subscriptionId, callback) {
                        return callback(null, subscriptionInfo);
                    }
                },
                req: {
                    body: body
                },
                res: {

                },
                app: {
                    post: function(path, handler) {
                        return handler(implementations.req, implementations.res);
                    }
                },
                server: {
                    count: function(apiKey, unit, body, callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                assert.equal(spies.db.getCBSubscription.callCount, 1);
                assert.equal(spies.db.getCBSubscription.getCall(0).args[0], subscriptionId);
                assert.equal(spies.server.count.callCount, 1);
                assert.equal(spies.server.count.getCall(0).args[0], subscriptionInfo.apiKey);
                assert.equal(spies.server.count.getCall(0).args[1], subscriptionInfo.unit);
                assert.equal(spies.server.count.getCall(0).args[2], body);
                assert.equal(spies.logger.error.callCount, 1);
                assert.equal(spies.logger.error.getCall(0).args[0], 'An error ocurred while making the accounting');
                done();
            });
        });

        it('error notifying the user', function(done) {
            var subscriptionId = 'subscriptionId';
            var body = {
                subscriptionId: subscriptionId
            }
            var subscriptionInfo = {
                apiKey: 'apiKey',
                unit: 'megabyte',
                notificationUrl: 'http://example.com/path'
            }
            var options = {
                url: subscriptionInfo.notificationUrl,
                method: 'POST',
                headers: {},
                json: true,
                body: body
            }
            var implementations = {
                db: {
                    getCBSubscription: function(subscriptionId, callback) {
                        return callback(null, subscriptionInfo);
                    }
                },
                req: {
                    body: body,
                    method: options.method,
                    headers: options.headers
                },
                res: {},
                app: {
                    post: function(path, handler) {
                        return handler(implementations.req, implementations.res);
                    }
                },
                server: {
                    count: function(apiKey, unit, body, callback) {
                        return callback(null);
                    }
                },
                requester: {
                    request: function(options, callback) {
                        return callback('Error', null, null);
                    }
                }
            }
            mocker(implementations, function(cb_handler, spies) {
                assert.equal(spies.db.getCBSubscription.callCount, 1);
                assert.equal(spies.db.getCBSubscription.getCall(0).args[0], subscriptionId);
                assert.equal(spies.server.count.callCount, 1);
                assert.equal(spies.server.count.getCall(0).args[0], subscriptionInfo.apiKey);
                assert.equal(spies.server.count.getCall(0).args[1], subscriptionInfo.unit);
                assert.equal(spies.server.count.getCall(0).args[2], body);
                assert.equal(spies.requester.request.callCount, 1);
                assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                assert.equal(spies.logger.error.callCount, 1);
                assert.equal(spies.logger.error.getCall(0).args[0], 'An error ocurred notifying the user, url: ' + options.url);
                done();
            });
        });
    });

    describe('Function "subscriptionHandler"', function() {

        it('[subscription] error sending request to CB', function(done) {
            var body = {
                reference: 'http://reference/path'
            }
            var unit = 'megabyte';
            var req = {
                method: 'POST',
                body: body,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                send: function() {}
            };
            var implementations = {
                req: req,
                requester: {
                    request: function(options, callback) {
                        return callback('Error', null, null);
                    }    
                },
                res: res
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, unit, 'subscribe', function(err) {
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], 504);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.equal(err, 'Error sending the subscription to the CB');
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    done();
                });
            });
        });

        it('[subscription] contextBroker response no OK (no add subscription)', function(done) {
            var subscriptionId = 'subscriptionId';
            var body = {
                reference: 'http://reference/path',
            }
            var unit = 'megabyte';
            var req = {
                method: 'POST',
                body: body,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            };
            var resp =  { 
                statusCode: 400, 
                headers: {header1: 'header1'}
            }
            var body_CB = {
                subscribeResponse: {
                    subscriptionId: subscriptionId
                }
            }
            var implementations = {
                req: req,
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, body_CB);
                    }    
                },
                res: res
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, unit, 'subscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.deepEqual(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], resp.headers.header1);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], body_CB);
                    done();
                });
            });
        });

        it('[subscription] error adding the subscription to database', function(done) {
            var subscriptionId = 'subscriptionId';
            var apiKey = 'apiKey';
            var body = {
                reference: 'http://reference/path',
            }
            var unit = 'megabyte';
            var req = {
                method: 'POST',
                body: body,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                get: function(header) {
                    return apiKey;
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            };
            var resp =  { 
                statusCode: 200, 
                headers: {header1: 'header1'}
            }
            var body_CB = {
                subscribeResponse: {
                    subscriptionId: subscriptionId
                }
            }
            var implementations = {
                req: req,
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, body_CB);
                    }    
                },
                res: res,
                db: {
                    addCBSubscription: function(apiKey, subscriptionId, reference_url, callback) {
                        return callback('Error');
                    }
                }
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, unit, 'subscribe', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.deepEqual(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], resp.headers.header1);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], body_CB);
                    assert.equal(spies.db.addCBSubscription.callCount, 1);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[0], apiKey);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[1], subscriptionId);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[2], 'http://reference/path');
                    done();
                });
            });
        });

        it('[subscription] incorrect subscription', function(done) {
            var subscriptionId = 'subscriptionId';
            var apiKey = 'apiKey';
            var body = {
                reference: 'http://reference/path',
            }
            var unit = 'megabyte';
            var req = {
                method: 'POST',
                body: body,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                get: function(header) {
                    return apiKey;
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                send: function(body) {}
            };
            var resp =  { 
                statusCode: 200, 
                headers: {header1: 'header1'}
            }
            var body_CB = {}
            var implementations = {
                req: req,
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, body_CB);
                    }    
                },
                res: res
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, unit, 'subscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.deepEqual(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], body_CB);
                    done();
                });
            });
        });

        it('[subscription] correct subscription', function(done) {
            var subscriptionId = 'subscriptionId';
            var apiKey = 'apiKey';
            var body = {
                reference: 'http://reference/path',
            }
            var unit = 'megabyte';
            var req = {
                method: 'POST',
                body: body,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                get: function(header) {
                    return apiKey;
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            };
            var resp =  { 
                statusCode: 200, 
                headers: {header1: 'header1'}
            }
            var body_CB = {
                subscribeResponse: {
                    subscriptionId: subscriptionId
                }
            }
            var implementations = {
                req: req,
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, body_CB);
                    }    
                },
                res: res,
                db: {
                    addCBSubscription: function(apiKey, subscriptionId, reference_url, callback) {
                        return callback(null);
                    }
                }
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, unit, 'subscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.deepEqual(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.deepEqual(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], resp.headers.header1);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], body_CB);
                    assert.equal(spies.db.addCBSubscription.callCount, 1);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[0], apiKey);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[1], subscriptionId);
                    assert.equal(spies.db.addCBSubscription.getCall(0).args[2], 'http://reference/path');
                    done();
                });
            });
        });

        it('[unsubscribe] error sending the request ti the CB', function(done) {
            var subscriptionId = 'subscriptionId';
            var req = {
                body: {
                    subscriptionId: subscriptionId
                },
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                }
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                send: function() {}
            }
            var implementations = {
                requester: {
                    request: function(options, callback) {
                        return callback('Error', null, null);
                    }
                },
                req: req,
                res: res
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: req.body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, 'megabyte', 'unsubscribe', function(err) {
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], 504);
                    assert.equal(spies.res.send.callCount, 1);
                    assert.equal(err, 'Error sending the unsubscription to the CB');
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    done();
                });
            });
        });

        it('[unsubscribe] error, context broker response no OK', function(done) {
            var subscriptionId = 'subscriptionId';
            var req = {
                body: {
                    subscriptionId: subscriptionId
                },
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                method: 'POST'
            }
            var resp = {
                headers: { header1: 'header1'},
                statusCode: 400
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            }
            var implementations = {
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, {});
                    }
                },
                req: req,
                res: res,
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: req.body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, 'megabyte', 'unsubscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.equal(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                    done();
                });
            });
        });

        it('[unsubscribe] error deleting the subscription from database', function(done) {
            var subscriptionId = 'subscriptionId';
            var req = {
                body: {
                    subscriptionId: subscriptionId
                },
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                method: 'POST'
            }
            var resp = {
                headers: { header1: 'header1'},
                statusCode: 200
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            }
            var implementations = {
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, {});
                    }
                },
                req: req,
                res: res,
                db: {
                    deleteCBSubscription: function(subscriptionId, callback) {
                        return callback('Error');
                    }
                }
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: req.body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, 'megabyte', 'unsubscribe', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.equal(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                    assert.equal(spies.db.deleteCBSubscription.callCount, 1);
                    assert.deepEqual(spies.db.deleteCBSubscription.getCall(0).args[0], req.body.subscriptionId);
                    done();
                });
            });
        });

        it('[unsubscribe] correct unsubscription', function(done) {
            var subscriptionId = 'subscriptionId';
            var req = {
                body: {
                    subscriptionId: subscriptionId
                },
                method: 'DELETE',
                path: '/path/subscriptionId',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                }
            }
            var resp = {
                headers: { header1: 'header1'},
                statusCode: 200
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            }
            var implementations = {
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, {});
                    }
                },
                req: req,
                res: res,
                db: {
                    deleteCBSubscription: function(subscriptionId, callback) {
                        return callback(null);
                    }
                }
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: req.body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, 'megabyte', 'unsubscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.equal(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                    assert.equal(spies.db.deleteCBSubscription.callCount, 1);
                    assert.deepEqual(spies.db.deleteCBSubscription.getCall(0).args[0], req.body.subscriptionId);
                    done();
                });
            });
        });

        it('[unsubscribe] correct unsubscription', function(done) {
            var subscriptionId = 'subscriptionId';
            var req = {
                body: {
                    subscriptionId: subscriptionId
                },
                method: 'DELETE',
                path: '/path/subscriptionId',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json'
                }
            }
            var resp = {
                headers: { header1: 'header1'},
                statusCode: 400
            }
            var res = {
                status: function(statusCode) {
                    return this;
                },
                setHeader: function(header, value) {},
                send: function(body) {}
            }
            var implementations = {
                requester: {
                    request: function(options, callback) {
                        return callback(null, resp, {});
                    }
                },
                req: req,
                res: res
            }
            var options = {
                url: 'http://contextBroker/path',
                method: req.method,
                json: true,
                headers: implementations.req.headers,
                body: req.body
            }
            mocker(implementations, function(cb_handler, spies) {
                cb_handler.subscriptionHandler(req, res, options.url, 'megabyte', 'unsubscribe', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], options);
                    assert.equal(spies.res.status.callCount, 1);
                    assert.equal(spies.res.status.getCall(0).args[0], resp.statusCode);
                    assert.equal(spies.async.forEachOf.callCount, 1);
                    assert.equal(spies.async.forEachOf.getCall(0).args[0], resp.headers);
                    assert.equal(spies.res.setHeader.callCount, 1);
                    assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
                    assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
                    assert.equal(spies.res.send.callCount, 1);
                    assert.deepEqual(spies.res.send.getCall(0).args[0], {});
                    done();
                });
            });
        });
    });
});