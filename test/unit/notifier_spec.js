var proxyquire = require('proxyquire'),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon');

var DEFAULT_UNIT = 'call';
var DEFAULT_NOTIFICATION_INFO = [
    {
        recordType: 'calls',
        unit: 'call',
        orderId: '1',
        productId: '1',
        correlationNumber: '0',
        value: '2'
    }
];
var DEFAULT_SPECIFICATION = {};
var DEFAULT_HREF = 'http://localhost/DSUsageManagement/1';

/**
 * Return an object with the mocked dependencies and object with the neecessary spies specified in implementations.
 *
 * @param  {Object}   implementations     Dependencies to mock and spy.
 */
var mocker = function (implementations, callback) {
    var mock, spies;

    mock = {
        logger: {
            info: function (msg) {}
        },
        requester: {
            request: function () {}
        },
        async: {
            each: async.each
        },
        db:{},
        config: {},
        accModule: {}
    };

    spies = {
        logger: {
            info: sinon.spy(mock.logger, 'info')
        },
        requester: {
            request: sinon.spy(mock.requester, 'request')
        },
        async: {
            each: sinon.spy(mock.async, 'each')
        },
        db: {},
        accModule: {}
    };

    async.each(Object.keys(implementations), function (obj, task_callback1) {
        mock[obj] = implementations[obj];
        async.each(Object.keys(implementations[obj]), function (implem, task_callback2) {
            if ( typeof implementations[obj][implem] == 'function' && implementations[obj][implem] != undefined) {
                spies[obj][implem.toString()] = sinon.spy(mock[obj], implem.toString());
                task_callback2();
            } else {
                task_callback2();
            }
        }, function () {
            return task_callback1();
        });
    }, function () {

        mock.config.database = {
            type: './db'
        };

        var accModulePath = './acc_modules/' + DEFAULT_UNIT;

        // Mocking dependencies
        notifier = proxyquire('../../notifier', {
            './db': mock.db,
            './config': mock.config,
            async: mock.async,
            request: mock.requester.request,
            winston: mock.logger,
            './acc_modules/call': mock.accModule
        });
        return callback(notifier, spies);
    });
};

describe('Testing Notifier', function () {

    describe('Function "notifyUsage"', function () {

        var testGetToken = function (errMsg, token, done) {
            var db = { 
                getToken: function (callback) {
                    return callback(errMsg, token);
                }
            };

            var implementations = {
                db: db
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    done();
                });
            });
        };

        it('should call the callback with error when db fails getting the token', function (done) {
            testGetToken('Error', null, done);
        });

        it('should not notify when there is no token available', function(done) {
           testGetToken(null, null, done); 
        });

        var testNotificationInfo = function (errMsg, notificationInfo, done) {

            var db = {
                getToken: function (callback) {
                    return callback(null, 'token');
                },
                getNotificationInfo: function (callback) {
                    return callback(errMsg, notificationInfo);
                }
            };

            var implementations = {
                db: db
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getNotificationInfo.calledOnce);
                    done();
                });
            });
        };

        it('should call the callback with error when db fails getting the notification information', function (done) {
            testNotificationInfo('Error', null, done);
        });

        it('should call the callback without error when there is no accounting information available', function (done) {
            testNotificationInfo(null, null, done);
        });

        var testGetHref = function (unit, errMsg, hrefErr, href, done) {

            var unit = unit;

            var db = {
                getToken: function (callback) {
                    return callback(null, 'token');
                },
                getNotificationInfo: function (callback) {
                    return callback(null, DEFAULT_NOTIFICATION_INFO);
                },
                getHref: function (unit, callback) {
                    return callback(hrefErr, href);
                }
            };

            var accModule = {
                getSpecification: undefined
            }

            var config = {
                modules: {
                    accounting: [unit]
                }
            };

            var implementations = {
                db: db,
                config: config,
                accModule: accModule
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getNotificationInfo.calledOnce);

                    if (unit === DEFAULT_UNIT) {
                        assert(spies.db.getHref.calledOnce);
                        assert(spies.db.getHref.calledWith(unit));
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when there is no accounting module for one of the accounting units', function (done) {
            var unit = 'wrongUnit';
            var errMsg = 'No accounting module for unit "' + unit + '" : missing file acc_modules/' + unit + '.js';

            testGetHref(unit, errMsg, errMsg, null, done);
        });

        it('should call the callback with error when db fails getting the href', function (done) {
            var errMsg = 'Error';

            testGetHref(DEFAULT_UNIT, errMsg, errMsg, null, done);
        });

        it('should call the callback with error when the function "getSpecification" is not defined in a required accounting module', function (done) {
            var errMsg = 'Error, function getSpecification undefined for unit ' + DEFAULT_UNIT;

            testGetHref(DEFAULT_UNIT, errMsg, null, null, done);
        });

        var testSendSpecification = function (specification, errMsg, requestResponse, addHrefResult, done) {
            var token = 'token';

            var db = {
                getToken: function (callback) {
                    return callback(null, token);
                },
                getNotificationInfo: function (callback) {
                    return callback(null, DEFAULT_NOTIFICATION_INFO);
                },
                getHref: function (unit, callback) {
                    return callback(null, null);
                },
                addSpecificationRef: function (unit, href, callback) {
                    return callback(addHrefResult);
                }
            };

            var config = {
                modules: {
                    accounting: [DEFAULT_UNIT]
                },
                usageAPI: {
                    host: 'localhost',
                    port: 9099,
                    path: 'DSUsageSpecification/api/v2/'
                }
            };

            var accModule = {
                getSpecification: function () {
                    return specification;
                }
            };

            var requester = {
                request: function (options, callback) {
                    return callback(requestResponse.error, requestResponse.resp, requestResponse.body);
                }
            }

            var implementations = {
                db: db,
                config: config,
                accModule: accModule,
                requester: requester
            };

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + 
                config.usageAPI.port + config.usageAPI.path + '/usageSpecification',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: specification
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getNotificationInfo.calledOnce);
                    assert(spies.db.getHref.calledWith(DEFAULT_UNIT));
                    assert(spies.accModule.getSpecification.calledOnce);

                    if (requestResponse) {
                        assert(spies.requester.request.calledWith(options));
                    }

                    if (addHrefResult) {
                        assert(spies.db.addSpecificationRef.calledWith(DEFAULT_UNIT, DEFAULT_HREF));
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when the usage specification is undefined', function (done) {

            testSendSpecification(undefined, 'Error, specification no available for unit ' + DEFAULT_UNIT, null, null, done);
        });

        it('should call the callback with error when there is an error sending the specification', function (done) {
            var requestResponse = {
                error: {
                    code: 'Error'
                }
            };
            var errMsg = 'Error sending the Specification: ' + requestResponse.error.code;

            testSendSpecification(DEFAULT_SPECIFICATION, errMsg, requestResponse, null, done);
        });

        it('should call the callback with error if the usage specification response is not 201', function (done) {
            var requestResponse = {
                error: null,
                resp: {
                    statusCode: 400,
                    statusMessage: 'Bad request'
                }
            };
            var errMsg = 'Error, ' + requestResponse.resp.statusCode + ' ' + requestResponse.resp.statusMessage;

            testSendSpecification(DEFAULT_SPECIFICATION, errMsg, requestResponse, null, done);
        });

        it('should call the callback with error when db fails adding the specification ref', function (done) {
            var requestResponse = {
                error: null,
                resp: {
                    statusCode: 201,
                },
                body: {
                    href: DEFAULT_HREF
                }
            };
            var errMsg = 'Error';

            testSendSpecification(DEFAULT_SPECIFICATION, errMsg, requestResponse, errMsg, done);
        });

        it('should call the callback without error when the specifications have been sent', function (done) {
            var requestResponse = {
                error: null,
                resp: {
                    statusCode: 201,
                },
                body: {
                    href: DEFAULT_HREF
                }
            };

            testSendSpecification(DEFAULT_SPECIFICATION, null, requestResponse, null, done);
        });

        var testSendUsage = function (errMsg, getHrefErr, requestResp, resetErr, done) {
            var getHrefCallCount = 0;
            var token = 'token';

            var db = {
                getToken: function (callback) {
                    return callback(null, token);
                },
                getNotificationInfo: function (callback) {
                    return callback(null, DEFAULT_NOTIFICATION_INFO);
                },
                getHref: function (unit, callback) {
                    if (getHrefCallCount !== 0) {
                        return callback(getHrefErr, DEFAULT_HREF);
                    } else {
                        getHrefCallCount ++;
                        return callback(null, DEFAULT_HREF);
                    }
                },
                resetAccounting: function (apiKey, callback) {
                    return callback(resetErr);
                }
            };

            var config = {
                modules: {
                    accounting: [DEFAULT_UNIT]
                },
                usageAPI: {
                    host: 'localhost',
                    port: 9099,
                    path: 'DSUsageSpecification/api/v2/'
                }
            };

            var requester = {
                request: function (options, callback) {
                    return callback(requestResp.error, requestResp.resp, requestResp.body);
                }
            };

            var implementations = {
                db: db,
                config: config,
                requester: requester
            };

            var options = {
                url: 'http://' + config.usageAPI.host + ':' + 
                config.usageAPI.port + config.usageAPI.path + '/usage',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: {}
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getNotificationInfo.calledOnce);
                    assert(spies.db.getHref.calledWith(DEFAULT_UNIT));

                    if (requestResp) {
                        assert(spies.requester.request.calledOnce);
                    }

                    if (resetErr !== undefined) {
                        assert(spies.db.resetAccounting.calledWith(DEFAULT_NOTIFICATION_INFO.apiKey));
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when db fails gettins the href to send usage', function (done) {
            var errMsg = 'Error';

            testSendUsage(errMsg, errMsg, null, undefined, done);
        });

        it('should call the callback with error when there is an error sending the usage', function (done) {
            var reqResp = {
                error: {
                    code: 'Error'
                }
            };
            var errMsg = 'Error notifying usage to the Usage Management API: ' + reqResp.error.code;

            testSendUsage(errMsg, null, reqResp, undefined, done);
        });

        it('should call the callback with error when the usage response is not 201', function (done) {
            var reqResp = {
                error: null,
                resp: {
                    statusCode: 400,
                    statusMessage: 'Bad request'
                }
            };
            var errMsg = 'Error notifying usage to the Usage Management API: ' + reqResp.resp.statusCode + ' ' + reqResp.resp.statusMessage;

            testSendUsage(errMsg, null, reqResp, undefined, done);
        });

        it('should call the callback with error when db fails resetting the accounting', function (done) {
            var reqResp = {
                error: null,
                resp: {
                    statusCode: 201,
                    statusMessage: 'created'
                }
            };
            var errMsg = 'Error while reseting the accounting after notify the usage';

            testSendUsage(errMsg, null, reqResp, 'Error', done);
        });

        it('should send the usage specifications and the usage information when there are not errors', function (done) {
            var reqResp = {
                error: null,
                resp: {
                    statusCode: 201,
                    statusMessage: 'created'
                }
            };

            testSendUsage(null, null, reqResp, null, done);
        });
    });
});