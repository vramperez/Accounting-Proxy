var assert = require('assert'),
    data = require('../data'),
    proxyquire = require('proxyquire').noCallThru(),
    sinon = require('sinon'),
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

        var orionModule = proxyquire('../../orion_context_broker/orionModule_v2', {
            'request': implementations.requester ? implementations.requester.request : {},
            '../config': config,
            '../accounter': implementations.accounter ? implementations.accounter : {},
            'moment': implementations.moment ? implementations.moment.moment : {},
            '.././db': implementations.db ? implementations.db : {},
            'url': implementations.url ? implementations.url : {}
        });

        return callback(orionModule, spies);
    });
};

describe('Testing orionModule_v2', function () {

    describe('Function "subscribe"', function () {

        var testSubscribe = function (requestErr, respStatusCode, addCBSubscriptionErr, countErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var unit = data.DEFAULT_UNIT;
            var subsId = data.DEFAULT_SUBSCRIPTION_ID;
            var url = data.DEFAULT_URLS[0];
            var expires = data.DEFAULT_EXPIRES;
            var duration = data.DEFAULT_DURATION;
            var respBody = {};
            var body = {
                notification: {
                    http: {
                        url: url
                    }
                },
                expires: expires
            };
            var resp = {
                statusCode: respStatusCode,
                headers: {
                    location: data.DEFAULT_URLS[0] + '/' + subsId
                }
            };
            var options = {
                body: body
            };

            var implementations = {
                req: {
                    get: function (header) {
                        return apiKey;
                    },
                    body: body
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
                        return callback(requestErr, resp, respBody);
                    }
                },
                db: {
                    addCBSubscription: function (apiKey, subsId, notificationUrl, expires, version, callback) {
                        return callback(addCBSubscriptionErr);
                    }
                },
                accounter: {
                    count: function (apiKey, unit, accountInfo, countFunction, callback) {
                        return callback(countErr);
                    }
                },
                momentFunctions: {
                    diff: function (moment) {
                        return duration;
                    }
                }
            };

            implementations.moment = {
                moment: function (date) {
                    return implementations.momentFunctions;
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.subscribe(implementations.req, implementations.res, unit, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.deepEqual(response, {status: 504, body: ''});
                        assert.equal(err, 'Error sending the subscription to the CB');

                    } else if (resp.statusCode !== 201) {
                        assert.deepEqual(response, {status: resp.statusCode,body: respBody});
                        assert.equal(err, null);

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }
                        assert(spies.req.get.calledWith('X-API-KEY'));

                        assert(spies.moment.moment.calledThrice);
                        assert(spies.moment.moment.calledWith(expires));
                        assert(spies.momentFunctions.diff.calledOnce);

                        assert(spies.db.addCBSubscription.calledWith(apiKey, subsId, url, expires, 'v2'));

                        if (addCBSubscriptionErr) {
                            assert.equal(err, addCBSubscriptionErr);

                        } else {

                            assert(spies.accounter.count.calledWith(apiKey, unit, {request: {duration: duration}}, 'subscriptionCount'));

                            if (countErr) {
                                assert.equal(err, countErr.msg);

                            } else {
                                assert.equal(err, null);
                            }

                        }
                    }

                    done();
                });
            });
        };

        it('should return 504 when there is an error sending the subscription to the context broker', function (done) {
            testSubscribe(true, null, null, null, done);
        });

        it('should return the response from the context broker when the status code is not 201', function (done) {
            testSubscribe(false, 400, null, null, done);
        });

        it('should call the callback with error when db fails adding the subscription', function (done) {
            testSubscribe(false, 201, true, null, done);
        });

        it('should call the callback with error when there is an error making the accounting', function (done) {
            testSubscribe(false, 201, false, {msg: 'Error'}, done);
        });

        it('should call the callback without error and make the accounting when there is no error processing the request', function (done) {
            testSubscribe(false, 201, false, null, done);
        });
    });

    describe('Function "unsubscribe"', function () {

        var testUnsubscribe = function (requestErr, statusCode, deleteErr, done) {

            var subsId = data.DEFAULT_SUBSCRIPTION_ID;
            var respBody = {};
            var resp = {
                statusCode: statusCode,
                headers: {
                    header1: 'header1'
                }
            };
            var options = {};

            var implementations = {
                req: {
                    path: data.DEFAULT_PUBLIC_PATHS[0] + '/' + subsId,
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
                        return callback(requestErr, resp, respBody);
                    }
                },
                db: {
                    deleteCBSubscription: function (subsId, callback) {
                        return callback(deleteErr);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.unsubscribe(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.deepEqual(response, {status: 504, body: ''});
                        assert.equal(err, 'Error sending the unsubscription to the CB');

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }

                        if (statusCode !== 204) {
                            assert.equal(err, null);

                        } else {

                            assert(spies.db.deleteCBSubscription.calledWith(subsId));

                            if (deleteErr) {
                                assert.equal(err, deleteErr);

                            } else {
                                assert.equal(err, null);
                            }
                        }
                    }

                    done();
                });
            });
        };

        it('should return 504 and call the callback with error when there is an error sending the request to the context broker', function (done) {
            testUnsubscribe(true, null, null, done);
        });

        it('should return the context broker response and call the callback without error when the request is no correct', function (done) {
            testUnsubscribe(false, 400, null, done);
        });

        it('should return the context broker response and call the callback with error when db fails deleting the subscription', function (done) {
            testUnsubscribe(false, 204, true, done);
        });

        it('should return the context broker response and call the callback without error when there is no error deleting the subscription', function (done) {
            testUnsubscribe(false, 204, false, done);
        });
    });

    describe('Function "updateSubscription"', function () {

        var apiKey = data.DEFAULT_API_KEYS[0];
        var subsId = data.DEFAULT_SUBSCRIPTION_ID;
        var options = {};
        var duration = data.DEFAULT_DURATION;
        var unit = data.DEFAULT_UNIT;
        var url = data.DEFAULT_URLS[0];

        var testUpdateSubscription = function (requestErr, statusCode, getSubsErr, subsInfo, done) {

            var body = {};
            var respBody = {};
            var resp = {
                statusCode: statusCode,
                headers: {
                    header1: 'header1'
                }
            };

            var implementations = {
                req: {
                    path: data.DEFAULT_PUBLIC_PATHS[0] + '/' + subsId,
                    body: body
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
                        return callback(requestErr, resp, respBody);
                    }
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(getSubsErr, subsInfo);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.updateSubscription(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.deepEqual(response, {status: 504, body: ''});
                        assert.equal(err, 'Error sending the subscription to the CB');

                    } else if (resp.statusCode !== 204) {
                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        assert.equal(err, null);

                    } else {
                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }
                        assert(spies.db.getCBSubscription.calledWith(subsId));

                        if (getSubsErr) {
                            assert.equal(err, getSubsErr)
                        } else if (!subsInfo) {
                            assert.equal(err, 'Subscription "' + subsId + '" not in database.')
                        }
                    }

                    done();
                });
            });
        };

        it('should return 504 and call the callback with error when there is an error sending the request to the context broker', function (done) {
            testUpdateSubscription(true, null, null, null, done);
        });

        it('should return the context broker response and call the callback without error when the status code is not 204', function (done) {
            testUpdateSubscription(false, 400, null, null, done);
        });

        it('should call the callback with error when db fails getting the subscription', function (done) {
            testUpdateSubscription(false, 204, true, null, done);
        });

        it('should call the callback with error when the subscription is not a registered subscription', function (done) {
            testUpdateSubscription(false, 204, false, null, done);
        });

        var testUpdateNotificationUrl = function (error, done) {

            var body = {
                notification: {
                    httpCustom: {
                        url: url
                    }
                }
            };

            var implementations = {
                req: {
                    path: data.DEFAULT_PUBLIC_PATHS[0] + '/' + subsId,
                    body: body
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                },
                requester: {
                    request: function (optoins, callback) {
                        return callback(null, {statusCode: 204}, {});
                    }
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(null, {});
                    },
                    updateNotificationUrl: function (subsId, notificationUrl, callback) {
                        return callback(error);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.updateSubscription(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));
                    assert.deepEqual(response, {status: 204, body: {}});
                    assert(spies.db.getCBSubscription.calledWith(subsId));
                    assert(spies.db.updateNotificationUrl.calledWith(subsId, url));

                    var result = error ? error : null;
                    assert.equal(err, result);

                    done();
                });
            });
        };

        it('should call the callback with error when the db fails saving the new notification URL', function (done) {
            testUpdateNotificationUrl('Error', done);
        });

        it('should call the callback without error when there is no error updating the notification URL', function (done) {
            testUpdateNotificationUrl(null, done);
        });

        var testUpdateExpirationDate = function (updateError, countError, done) {

            var newExpires = data.DEFAULT_EXPIRES;
            var body = {
                expires: newExpires
            };

            var implementations = {
                req: {
                    path: data.DEFAULT_PUBLIC_PATHS[0] + '/' + subsId,
                    body: body,
                    get: function (header) {
                        return apiKey;
                    }
                },
                res: {
                    status: function (statusCode) {
                        return this;
                    },
                    send: function (body) {},
                },
                requester: {
                    request: function (optoins, callback) {
                        return callback(null, {statusCode: 204}, {});
                    }
                },
                db: {
                    getCBSubscription: function (subsId, callback) {
                        return callback(null, {unit: unit});
                    },
                    updateExpirationDate: function (subsId, expires, callback) {
                        return callback(updateError);
                    }
                },
                accounter: {
                    count: function (apiKey, unit, accountingInfo, countFunction, callback) {
                        var res = null;

                        if (countError) {
                            res = { msg: countError}
                        }
                        return callback(res);
                    }
                },
                moment: {
                    isAfter: function (date) {
                        return true;
                    },
                    diff: function (moment) {
                        return duration;
                    }
                }
            };

            implementations.moment.moment = function (date) {
                return implementations.moment;
            }

            mocker(implementations, function (orionModule, spies) {

                orionModule.updateSubscription(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));
                    assert.deepEqual(response, {status: 204, body: {}});
                    assert(spies.db.getCBSubscription.calledWith(subsId));
                    assert(spies.moment.moment.calledWith(newExpires));
                    assert(spies.moment.isAfter.calledOnce);
                    assert(spies.db.updateExpirationDate.calledWith(subsId, newExpires));

                    if (updateError) {
                        assert.equal(spies.moment.moment.callCount, 2);
                        assert.equal(err, updateError);
                    } else {

                        assert.equal(spies.moment.moment.callCount, 4);
                        assert(spies.accounter.count.calledWith(apiKey, unit, {request: {duration: duration}}, 'subscriptionCount'));

                        var result = countError ? countError : null;
                        assert.equal(err, result);
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when db fails saving the new expiration date', function (done) {
            testUpdateExpirationDate('Error', null, done);
        });

        it('should call the callback with error when there is an error making the accounting', function (done) {
            testUpdateExpirationDate(null, 'Error', done);
        });

        it('should call the callback without error when there is no error updating the expiration date', function (done) {
            testUpdateExpirationDate(null, null, done);
        });
    });

    describe('Function "cancelSubscription"', function () {

        var testCancelSubscription = function (error, statusCode, done) {

            var subsId = data.DEFAULT_SUBSCRIPTION_ID;
            var protocol = 'http';
            var host = 'localhost:9000';
            var url = protocol + '//' + host + '/v2/subscriptions/' + subsId;
            var subscriptionInfo = {
                url: data.DEFAULT_URLS[0],
                subscriptionId: subsId
            };
            var errorMsg = 'Error cancelling the subscription with Id: ' + subsId;

            var options = {
                url: url,
                method: 'DELETE',
            };

            var implementations = {
                requester: {
                    request: function (options, callback) {
                        return callback(error, {statusCode: statusCode}, {});
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            protocol: protocol,
                            host: host
                        }
                    }
                }
            };

            mocker(implementations, function(orionModule, spies) {
                orionModule.cancelSubscription(subscriptionInfo, function (err) {
                    assert(spies.requester.request.calledWith(options));
                    assert(spies.url.parse.calledWith(subscriptionInfo.url));

                    var result = error ? errorMsg : null;
                    assert.equal(err, result);

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error sending the request to Context Broker', function (done) {
            testCancelSubscription(true, null, done);
        });

        it('should call the callback with error when there is an error cancelling the subscription in Context Broker', function (done) {
            testCancelSubscription(true, 400, done);
        });

        it('should call the callback without error when there is no error cancelling the subscription', function (done) {
            testCancelSubscription(false, 204, done);
        });
    });
});