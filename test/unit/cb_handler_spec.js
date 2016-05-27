var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async'),
    data = require('../data'),
    util = require('../util');

var mocker = function (implementations, callback) {
    
    util.getSpies(implementations, function (spies) {

        var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './db'
        };
        config.resources = {
            notification_port: data.DEFAULT_PORT
        };

        var app = implementations.app ? implementations.app : {};
        app.use = function (middleware) {};
        app.set = function (key, value) {};
        app.post = app.post ? implementations.app.post : function (path, handler) {}; 

        var cb_handler = proxyquire('../../orion_context_broker/cb_handler', {
            express: function () {
                return app;
            },
            '../config': config,
            '.././db': implementations.db ? implementations.db : {},
            request: implementations.requester ? implementations.requester.request : {},
            url: implementations.url ? implementations.url : {},
            './subsUrls': implementations.subsUrls ? implementations.subsUrls : {},
            '../server': implementations.server ? implementations.server : {},
            '../accounter': implementations.accounter ? implementations.accounter : {},
            winston: implementations.logger ? implementations.logger: {}
        });

        return callback(cb_handler, spies);
    });
};

describe('Testing ContextBroker Handler', function () {

    describe('Function "init"', function () {

        it('correct initialization', function (done) {

            var port = data.DEFAULT_PORT;

            var implementations = {
                app: {
                    listen: function (port) {},
                    get: function (prop) {
                        return port;
                    }
                },
                config: {
                    resources: {
                        notification_port: port
                    }
                }
            };

            mocker(implementations, function (cb_handler, spies) {

                cb_handler.run();

                assert(spies.app.get.calledWith('port'));
                assert(spies.app.listen.calledWith(port));

                done();
            });
        });
    });

    describe('Function "getOperation"', function () {

        var testGetOperation = function (path, method, operation, done) {

            var implementations = {
                subsUrls: data.DEFAULT_SUBS_URLS,
                req: {
                    method: method
                }
            };

            mocker(implementations, function (cb_handler, spies) {

                cb_handler.getOperation(path, implementations.req, function (result) {

                    assert.equal(result, operation);

                    done();
                });
            });

        };

        it('should return "subscribe" when the request is a CB subscription', function (done) {
            testGetOperation(data.DEFAULT_SUBS_PATH, 'POST', 'subscribe', done);
        });

        it('should return "unsubscribe" when the request is a CB unsubscription', function (done) {
           testGetOperation(data.DEFAULT_UNSUBS_PATH, 'DELETE', 'unsubscribe', done);
        });

        it('should return "updateSubscription" when the request is a CB subscription update', function (done) {
           testGetOperation(data.DEFAULT_UPDATE_SUBS_PATH, 'POST', 'updateSubscription', done);
        });

        it('should return null when the request is not a subscription, unsubscription or a subscription update', function (done) {
           testGetOperation('/entities', 'PUT', null, done); 
        });
    });

    describe('Function "notificationHandler"', function (done) {

        var testNotificationHandler = function (getCBSubsErr, countErr, requestErr, done) {

            var subsId = data.DEFAULT_SUBS_ID;
            var requestStatus = 200;
            var subscription = data.DEFAULT_SUBSCRIPTION;
            var method = 'POST';

            var implementations = {
                req: {
                    body: {
                        subscriptionId: subsId
                    },
                    method: method
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function () {}
                },
                app: {
                    post: function (path, handler) {
                        return handler(implementations.req, implementations.res);
                    }
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(getCBSubsErr, subscription);
                    }
                },
                accounter:{
                    count: function (apiKey, unit, countInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, {statusCode: requestStatus});
                    }
                },
                logger: {
                    error: function (msg) {}
                }
            };

            mocker(implementations, function (cb_handler, spies) {

                assert(spies.db.getCBSubscription.calledWith(subsId));

                if (getCBSubsErr) {
                    assert(spies.logger.error.calledWith('An error ocurred while making the accounting: Invalid subscriptionId'));
                } else {

                    assert(spies.accounter.count.calledWith(subscription.apiKey, subscription.unit, {request: implementations.req, response: {}}, 'count'));

                    if (countErr) {
                        assert(spies.logger.error.calledWith('An error ocurred while making the accounting'));
                    } else {

                        var options = {
                            url: subscription.notificationUrl,
                            method: method,
                            json: true,
                            body: implementations.req.body
                        };

                        assert(spies.requester.request.calledWith(options));

                        if (requestErr) {
                            assert(spies.logger.error.calledWith('An error ocurred notifying the user, url: ' + options.url));
                            assert(spies.res.status.calledWith(504));
                            assert(spies.res.send.calledOnce);
                        } else {
                            assert(spies.res.status.calledWith(requestStatus));
                            assert(spies.res.send.calledOnce);
                        }
                    }
                }

                done();
            });
        };

        it('should log the error when db fails getting the subscription information', function (done) {
            testNotificationHandler(true, false, false, done);
        });

        it('should log the error when db fails making the accounting', function (done) {
           testNotificationHandler(false, true, false, done); 
        });

        it('should return 504 when the notification fails', function (done) {
           testNotificationHandler(false, false, true, done);
        });

        it('should return 200 when the notification success', function (done) {
           testNotificationHandler(false, false, false, done); 
        });
    });

    describe('Function "subscribe"', function () {

        var testSubscribe = function (requestErr, subsRes, addCBSubsErr, subscriptionCount, countErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var url = data.DEFAULT_URLS[0];
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var unit = data.DEFAULT_UNIT;
            var method = 'POST';
            var headers = {};
            var duration = data.DEFAULT_DURATION;

            var implementations = {
                req: {
                    body: {
                        reference: data.DEFAULT_URLS[0]
                    },
                    get: function (header) {
                        return apiKey;
                    },
                    method: method,
                    headers: headers
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, subsRes)
                    }
                },
                db: {
                    addCBSubscription: function (apiKey, subsId, ref, callback) {
                        return callback(addCBSubsErr);
                    }
                },
                accounter: {
                    count: function (apiKey, unit, accountingInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                }
            }

            var accountingModules = {};
            accountingModules[unit] = {subscriptionCount: subscriptionCount};

            implementations.server = {
                accountingModules: accountingModules
            };

            mocker(implementations, function (cb_handler, spies) {

                cb_handler.subscriptionHandler(implementations.req, implementations.res, url, 'subscribe', unit, function (err) {

                    var options = {
                        url: url,
                        method: method,
                        json: true,
                        headers: headers,
                        body: {
                            reference: 'http://localhost:' + data.DEFAULT_PORT + '/subscriptions'
                        }
                    };

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {

                        assert(spies.res.status.calledWith(504));
                        assert(spies.res.send.calledOnce);

                    } else if (!subsRes.subscribeResponse) {

                        assert(spies.res.status.calledWith(resp.statusCode));
                        assert(spies.res.send.calledWith(subsRes));
                        assert.equal(err, null);

                    } else {

                        assert(spies.res.status.calledWith(resp.statusCode));
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }
                        assert(spies.res.send.calledWith(subsRes));
                        assert(spies.req.get.calledWith('X-API-KEY'));

                        if (addCBSubsErr) {
                            assert.equal(err, addCBSubsErr)
                        } else if (subscriptionCount) {

                            assert(spies.accounter.count.calledWith(apiKey, unit, {request: {duration}}, 'subscriptionCount'));

                            if (countErr) {
                                assert.equal(err, countErr);
                            } else {
                                assert.equal(err, null);
                            }
                        } else {
                            assert.equal(err, null);
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when sending the request to CB fails', function (done) {
            testSubscribe(true, null, false, null, false, done);
        });

        it('should redirect the CB response and call the callback without error when the subscription is not valid', function (done) {
            testSubscribe(false, {}, false, undefined, false, done);
        });

        it('should call the callback with error when db fails adding the subscription', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, 'Error', null, false, done);
        });

        it('should call the callback without error when there is no accounting function for subscriptions', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, false, undefined, false, done);
        });

        it('should call the callback without error when the accounting module fails making the accounting for subscriptions', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, false, {}, true, done);
        });

        it('should call the callback without error when there is no error making the accounting for subscription', function (done) {
            testSubscribe(false, data.DEFAULT_SUBS_RESPONSE, false, {}, false, done);
        });
    });

    describe('Function "unsubscribe"', function () {

        var testUnsubscribe = function (method, subsId, respStatus, requestErr, deleteCBSubsErr, done) {

            var resp = {
                statusCode: respStatus,
                headers: {
                    header1: 'header1'
                }
            };
            var unsubsRes = {};
            var url = data.DEFAULT_URLS[0];
            var unit = data.DEFAULT_UNIT;

            var implementations = {
                req: {
                    path: data.DEFAULT_UNSUBS_PATH + '/' + subsId,
                    method: method,
                    headers: {},
                    body: {
                        subscriptionId: subsId
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, unsubsRes);
                    }
                },
                db: {
                    deleteCBSubscription: function (subsId, callback) {
                        return callback(deleteCBSubsErr);
                    }
                }
            };

            mocker(implementations, function (cb_handler, spies) {

                cb_handler.subscriptionHandler(implementations.req, implementations.res, url, 'unsubscribe', unit, function (err) {

                    var options = {
                        url: url,
                        method: method,
                        json: true,
                        headers: implementations.req.headers,
                        body: implementations.req.body
                    };

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert(spies.res.status.calledWith(504));
                        assert(spies.res.send.calledOnce);
                    } else {

                        assert(spies.res.status.calledWith(resp.statusCode));
                        for (var key in resp.headers) {
                            assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                        }

                        if (respStatus !== 200) {
                            assert(spies.res.send.calledWith(unsubsRes));
                            assert.equal(err, null);
                        } else {

                            assert(spies.db.deleteCBSubscription.calledWith(subsId));
                            assert(spies.res.send.calledWith(unsubsRes));

                            deleteCBSubsErr ? assert.equal(err, deleteCBSubsErr) : assert.equal(err, null);
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error sending the request to CB', function (done) {
            testUnsubscribe('POST', data.DEFAULT_SUBS_ID, null, true, false, done);
        });

        it('should call the callback without error and redirect the response when CB response status is not 200', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, 400, false, false, done);
        });

        it('should call the callback with error when db fails deleting the subscription', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, 200, false, true, done);
        });

        it('should call the callback without error when the unsubscription is correct', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, 200, false, null, done); 
        });
    });

    describe('Function "updateSubscription"', function () {

        var testUpdateSubscription = function (getCBSubsErr, subsInfo, requestErr, updateResp, subscriptionCount, countErr, done) {

            var subsId = data.DEFAULT_SUBS_ID;
            var method = 'POST';
            var url = data.DEFAULT_URLS[0];
            var unit = data.DEFAULT_UNIT;
            var subsInfo = subsInfo ? data.DEFAULT_SUBSCRIPTION : null;
            var updateResp = updateResp ? data.DEFAULT_SUBS_RESPONSE : {};
            var body = {
                subscriptionId: subsId
            };
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };

            var implementations = {
                req: {
                    body: body,
                    get: function (header) {
                        return subsInfo.apiKey;
                    },
                    method: method,
                    headers: {}
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                    setHeader: function (header, value) {}
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(getCBSubsErr, subsInfo);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, resp, updateResp)
                    }
                },
                accounter: {
                    count: function (apiKey, unit, accountingInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                }
            };

            var accountingModules = {};
            accountingModules[unit] = {subscriptionCount: subscriptionCount};

            implementations.server = {
                accountingModules: accountingModules
            };

            mocker(implementations, function (cb_handler, spies) {

                cb_handler.subscriptionHandler(implementations.req, implementations.res, url, 'updateSubscription', unit, function (err) {

                    assert(spies.db.getCBSubscription.calledWith(subsId));

                    if (getCBSubsErr) {

                        assert.equal(err, getCBSubsErr);

                    } else if (!subsInfo) {

                        assert.equal(err, 'Subscription "' + subsId + '" not in database.');

                    } else {

                        var options = {
                            url: url,
                            method: 'POST',
                            json: true,
                            headers: {},
                            body: body
                        };

                        assert(spies.requester.request.calledWith(options));

                        if (requestErr) {

                            assert(spies.res.status.calledWith(504));
                            assert(spies.res.send.calledOnce);

                        } else if (!updateResp.subscribeResponse) {

                            assert(spies.res.status.calledWith(resp.statusCode));
                            assert(spies.res.send.calledWith(updateResp));

                        } else {

                            assert(spies.res.status.calledWith(resp.statusCode));
                            for (var key in resp.headers) {
                                assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                            };
                            assert(spies.res.send.calledWith(updateResp));
                            assert(spies.req.get.calledWith('X-API-KEY'));

                            if (!subscriptionCount) {

                                assert.equal(err, null);

                            } else {

                                assert(spies.accounter.count.calledWith(subsInfo.apiKey, subsInfo.unit, {request: {duration: updateResp.subscribeResponse.duration}}, 'subscriptionCount'));
                                countErr ? assert.equal(err, countErr) : assert.equal(err, null);

                            }
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when db fails getting the subscription information', function (done) {
            testUpdateSubscription(true, false, false, null, null, false, done);
        });

        it('should call the callback with error when there is no subscription to update', function (done) {
            testUpdateSubscription(false, false, false, null, null, false, done);
        });

        it('should call the callback with error when there is an error making the request to CB', function (done) {
            testUpdateSubscription(false, true, true, null, null, false, done);
        });

        it('should call the callback without error and redirect the response when the update is rejected by the CB', function (done) {
            testUpdateSubscription(false, true, false, false, null, false, done);
        });

        it('should call the callback without error when there is no accounting function for subscriptions updates', function (done) {
            testUpdateSubscription(false, true, false, true, false, false, done);
        });

        it('should call the callback with error when there is an error making the accounting of the subscription update', function (done) {
            testUpdateSubscription(false, true, false, true, true, true, done);
        });

        it('should call the callback without error when subscription update is correct', function (done) {
            testUpdateSubscription(false, true, false, true, true, false, done);
        });
    });
});