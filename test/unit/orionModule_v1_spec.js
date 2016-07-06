var proxyquire = require('proxyquire').noCallThru(),
	assert = require('assert'),
	sinon = require('sinon'),
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

        var orionModule = proxyquire('../../orion_context_broker/orionModule_v1', {
        	'request': implementations.requester ? implementations.requester.request : {},
        	'../config': config,
        	'../accounter': implementations.accounter ? implementations.accounter : {},
        	'.././db': implementations.db ? implementations.db : {},
            'url': implementations.url ? implementations.url : {}
        });

        return callback(orionModule, spies);
	});
};

describe('Testing orionModule_v1', function () {

	describe('Function "subscribe"', function () {

		var testSubscribe = function (requestErr, subsRes, addCBSubsErr, subscriptionCount, countErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var options = {};
            var url = data.DEFAULT_URLS[0];
            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var unit = data.DEFAULT_UNIT;
            var duration = data.DEFAULT_DURATION;

            var implementations = {
                req: {
                    body: {
                        reference: url
                    },
                    get: function (header) {
                        return apiKey;
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
                        return callback(requestErr, resp, subsRes)
                    }
                },
                db: {
                    addCBSubscription: function (apiKey, subsId, ref, expires, version, callback) {
                        return callback(addCBSubsErr);
                    }
                },
                accounter: {
                    count: function (apiKey, unit, accountingInfo, countFunction, callback) {
                        var err = null;

                        if (countErr) {
                            err = {
                                code: 'invalidUnit',
                                msg: countErr
                            }
                        }

                        return callback(err);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.subscribe(implementations.req, implementations.res, unit, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.equal(err, 'Error sending the subscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''});

                    } else if (!subsRes.subscribeResponse) {

                        assert.equal(err, null);
                        assert.deepEqual(response, {status: resp.statusCode, body: {}});

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: subsRes});
                        for (var header in resp.headers) {
                            assert(spies.res.setHeader.calledWith(header, resp.headers[header]));
                        }
                        assert(spies.req.get.calledWith('X-API-KEY'));
                        assert(spies.db.addCBSubscription.calledWith(apiKey, subsRes.subscribeResponse.subscriptionId, url, '', 'v1'));

                        if (addCBSubsErr) {
                            assert.equal(err, addCBSubsErr);
                        } else if (subscriptionCount) {

                            assert(spies.accounter.count.calledWith(apiKey, unit, {request: {duration: duration}}, 'subscriptionCount'));

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

		var testUnsubscribe = function (method, subsId, respBody, requestErr, deleteCBSubsErr, done) {

            var resp = {
                statusCode: 200,
                headers: {
                    header1: 'header1'
                }
            };
            var options = {};
            var unit = data.DEFAULT_UNIT;

            var implementations = {
                req: {
                    path: data.DEFAULT_UNSUBS_PATH + '/' + subsId,
                    method: method,
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
                        return callback(requestErr, resp, respBody);
                    }
                },
                db: {
                    deleteCBSubscription: function (subsId, callback) {
                        return callback(deleteCBSubsErr);
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.unsubscribe(implementations.req, implementations.res, options, function (err, response) {

                    assert(spies.requester.request.calledWith(options));

                    if (requestErr) {
                        assert.equal(err, 'Error sending the unsubscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''})

                    } else {

                        assert.deepEqual(response, {status: resp.statusCode, body: respBody});
                        for (var key in resp.headers) {
                            assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                        }

                        if (respBody.orionError) {
                            assert.equal(err, null);

                        } else {

                            assert(spies.db.deleteCBSubscription.calledWith(subsId));

                            deleteCBSubsErr ? assert.equal(err, deleteCBSubsErr) : assert.equal(err, null);
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when there is an error sending the request to CB', function (done) {
            testUnsubscribe('POST', data.DEFAULT_SUBS_ID, {}, true, false, done);
        });

        it('should call the callback without error and redirect the response when CB response status is not 200', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {orionError: 'Error'}, false, false, done);
        });

        it('should call the callback with error when db fails deleting the subscription', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {}, false, true, done);
        });

        it('should call the callback without error when the unsubscription is correct', function (done) {
           testUnsubscribe('DELETE', data.DEFAULT_SUBS_ID, {}, false, null, done); 
        });
	});

	describe('Function "updateSubscription"', function () {

		var testUpdateSubscription = function (requestErr, getCBSubsErr, subsInfo, updateResp, subscriptionCount, countErr, done) {

            var subsId = data.DEFAULT_SUBS_ID;
            var options = {};
            var apiKey = data.DEFAULT_API_KEYS[0];
            var unit = data.DEFAULT_UNIT;
            var subsInfo = subsInfo ? data.DEFAULT_SUBSCRIPTION_v1 : null;
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
                        return apiKey;
                    }
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

            mocker(implementations, function (orionModule, spies) {

                orionModule.updateSubscription(implementations.req, implementations.res, options, function (err, response) {

                	assert(spies.requester.request.calledWith(options));

                	if (requestErr) {
                        assert.equal(err, 'Error sending the subscription to the CB');
                        assert.deepEqual(response, {status: 504, body: ''});

                	} else if (!updateResp.subscribeResponse) {
                        assert.equal(err, null);
                        assert.deepEqual(response, {status: resp.statusCode, body: updateResp});

                	} else {

                        assert.deepEqual(response, {status: resp.statusCode, body: updateResp});
                		for (var key in resp.headers) {
                			assert(spies.res.setHeader.calledWith(key, resp.headers[key]));
                		};
                		assert(spies.req.get.calledWith('X-API-KEY'));
                		assert(spies.db.getCBSubscription.calledWith(subsId));

	                    if (getCBSubsErr) {
	                        assert.equal(err, getCBSubsErr);

	                    } else if (!subsInfo) {
	                        assert.equal(err, 'Subscription "' + subsId + '" not in database.');

	                    } else {

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

        it('should call the callback with error when there is an error making the request to CB', function (done) {
            testUpdateSubscription(true, false, null, null, null, false, done);
        });

        it('should call the callback with error when db fails getting the subscription information', function (done) {
            testUpdateSubscription(false, true, false, true, null, false, done);
        });

        it('should call the callback with error when there is no subscription to update', function (done) {
            testUpdateSubscription(false, false, false, true, null, false, done);
        });

        it('should call the callback without error and redirect the response when the update is rejected by the CB', function (done) {
            testUpdateSubscription(false, false, true, false, null, false, done);
        });

        it('should call the callback without error when there is no accounting function for subscriptions updates', function (done) {
            testUpdateSubscription(false, false, true, true, false, false, done);
        });

        it('should call the callback with error when there is an error making the accounting of the subscription update', function (done) {
            testUpdateSubscription(false, false, true, true, true, true, done);
        });

        it('should call the callback without error when subscription update is correct', function (done) {
            testUpdateSubscription(false, false, true, true, true, false, done);
        });
	});

    describe('Function "cancelSubscription"', function () {

        var testCancelSubscription = function (error, statusCode, done) {

            var protocol = 'http';
            var host = 'localhost:9000';
            var subsId = data.DEFAULT_SUBS_ID;
            var body = {
                'subscriptionId': subsId
            };
            var subscriptionInfo = {
                url: data.DEFAULT_URLS[0],
                subscriptionId: subsId
            };
            var errorMsg = 'Error cancelling the subscription with Id: ' + subsId;

            var options = {
                url: protocol + '//' + host + '/v1/unsubscribeContext',
                method: 'POST',
                json: true, 
                body: body
            };

            var implementations = {
                requester: {
                    request: function (options, callback) {
                        return callback(error, {}, {statusCode: {code: statusCode}}); 
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            protocol: protocol,
                            host: host
                        };
                    }
                }
            };

            mocker(implementations, function (orionModule, spies) {

                orionModule.cancelSubscription(subscriptionInfo, function (err) {

                    assert(spies.requester.request.calledWith(options));
                    assert(spies.url.parse.calledWith(subscriptionInfo.url));

                    var result = error ? errorMsg : null;
                    assert.equal(err,  result);

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

        it('should call the callback without error when there is no error sending the request to the Context Broker', function (done) {
            testCancelSubscription(false, 200, done);
        });
    });
});