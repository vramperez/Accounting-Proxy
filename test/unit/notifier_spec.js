var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon'),
    data = require('../data'),
    util = require('../util');

/**
 * Return an object with the mocked dependencies and object with the neecessary spies specified in implementations.
 *
 * @param  {Object}   implementations     Dependencies to mock and spy.
 */
var mocker = function (implementations, callback) {

    util.getSpies(implementations, function (spies) {

        var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './db'
        };

        // Mock dependencies
        var notifier = proxyquire('../../notifier', {
            './config': config,
            './db': implementations.db ? implementations.db : {},
            request: implementations.requester ? implementations.requester.request : {},
            winston: implementations.logger ? implementations.logger : {},
            './server': implementations.server ? implementations.server : {},
        });

        return callback(notifier, spies);
    });
};

describe('Testing Notifier', function () {

    describe('Function "notifyAllUsage"', function () {

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

                notifier.notifyAllUsage(function (err) {

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
                getAllNotificationInfo: function (callback) {
                    return callback(errMsg, notificationInfo);
                }
            };

            var implementations = {
                db: db
            };

            mocker(implementations, function (notifier, spies) {
                notifier.notifyAllUsage(function (err) {
                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getAllNotificationInfo.calledOnce);
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

            var db = {
                getToken: function (callback) {
                    return callback(null, data.DEFAULT_TOKEN);
                },
                getAllNotificationInfo: function (callback) {
                    return callback(null, data.DEFAULT_NOTIFICATION_INFO);
                },
                getHref: function (unit, callback) {
                    return callback(hrefErr, href);
                }
            };

            var accModule = {
                getSpecification: undefined
            };

            var server = {
                getAccountingModules: function () {
                    var accModules = {};
                    accModules[unit] = accModule;

                    return accModules;
                }
            };

            var config = {
                modules: {
                    accounting: [unit]
                }
            };

            var implementations = {
                db: db,
                config: config,
                server: server
            };

            mocker(implementations, function (notifier, spies) {

                notifier.notifyAllUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getAllNotificationInfo.calledOnce);

                    if (unit === data.DEFAULT_UNIT) {
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

            testGetHref(data.DEFAULT_UNIT, errMsg, errMsg, null, done);
        });

        it('should call the callback with error when the function "getSpecification" is not defined in a required accounting module', function (done) {
            var errMsg = 'Error, function getSpecification undefined for unit ' + data.DEFAULT_UNIT;

            testGetHref(data.DEFAULT_UNIT, errMsg, null, null, done);
        });

        var testSendSpecification = function (specification, errMsg, requestResponse, addHrefResult, done) {

            var token = data.DEFAULT_TOKEN;
            var unit = data.DEFAULT_UNIT;

            var db = {
                getToken: function (callback) {
                    return callback(null, data.DEFAULT_TOKEN);
                },
                getAllNotificationInfo: function (callback) {
                    return callback(null, []);
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
                    accounting: [unit]
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

            var server = {};

            var requester = {
                request: function (options, callback) {
                    return callback(requestResponse.error, requestResponse.resp, requestResponse.body);
                }
            };

            var logger = {
                info: function (msg) {}
            };

            var implementations = {
                db: db,
                config: config,
                server: server,
                requester: requester,
                logger: logger,
                accModule: accModule
            };

            implementations.server.getAccountingModules = function () {
                var accModules = {};
                accModules[unit] = implementations.accModule;

                return accModules;
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

                notifier.notifyAllUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getAllNotificationInfo.calledOnce);
                    assert(spies.db.getHref.calledWith(unit));
                    assert(spies.server.getAccountingModules.calledOnce);
                    assert(spies.accModule.getSpecification.calledOnce);

                    if (requestResponse) {
                        assert(spies.requester.request.calledWith(options));
                    }

                    if (addHrefResult) {
                        assert(spies.db.addSpecificationRef.calledWith(unit, data.DEFAULT_HREFS[0]));
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when the usage specification is undefined', function (done) {
            testSendSpecification(undefined, 'Error, specification no available for unit ' + data.DEFAULT_UNIT, null, null, done);
        });

        it('should call the callback with error when there is an error sending the specification', function (done) {
            var requestResponse = {
                error: {
                    code: 'Error'
                }
            };
            var errMsg = 'Error sending the Specification: ' + requestResponse.error.code;

            testSendSpecification({}, errMsg, requestResponse, null, done);
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

            testSendSpecification({}, errMsg, requestResponse, null, done);
        });

        it('should call the callback with error when db fails adding the specification ref', function (done) {
            var requestResponse = {
                error: null,
                resp: {
                    statusCode: 201,
                },
                body: {
                    href: data.DEFAULT_HREFS[0]
                }
            };
            var errMsg = 'Error';

            testSendSpecification({}, errMsg, requestResponse, errMsg, done);
        });

        it('should call the callback without error when the specifications have been sent', function (done) {
            var requestResponse = {
                error: null,
                resp: {
                    statusCode: 201,
                },
                body: {
                    href: data.DEFAULT_HREFS[0]
                }
            };

            testSendSpecification({}, null, requestResponse, null, done);
        });

        var testSendUsage = function (errMsg, getHrefErr, requestResp, resetErr, done) {

            var getHrefCallCount = 0;
            var token = data.DEFAULT_TOKEN;

            var db = {
                getToken: function (callback) {
                    return callback(null, token);
                },
                getAllNotificationInfo: function (callback) {
                    return callback(null, data.DEFAULT_NOTIFICATION_INFO);
                },
                getHref: function (unit, callback) {
                    if (getHrefCallCount !== 0) {
                        return callback(getHrefErr, data.DEFAULT_HREFS[0]);
                    } else {
                        getHrefCallCount ++;
                        return callback(null, data.DEFAULT_HREFS[0]);
                    }
                },
                resetAccounting: function (apiKey, callback) {
                    return callback(resetErr);
                }
            };

            var config = {
                modules: {
                    accounting: [data.DEFAULT_UNIT]
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

            var logger = {
                info: function (msg) {}
            };

            var implementations = {
                db: db,
                config: config,
                requester: requester,
                logger: logger
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
                notifier.notifyAllUsage(function (err) {

                    assert.equal(err, errMsg);
                    assert(spies.db.getToken.calledOnce);
                    assert(spies.db.getAllNotificationInfo.calledOnce);
                    assert(spies.db.getHref.calledWith(data.DEFAULT_UNIT));

                    if (requestResp) {
                        assert(spies.requester.request.calledOnce);
                    }

                    if (resetErr !== undefined) {
                        assert(spies.db.resetAccounting.calledWith(data.DEFAULT_NOTIFICATION_INFO.apiKey));
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

    describe('Function notifyUsage', function () {

        var testNotifyUsage = function (getTokenErr, hasToken, getNotificationErr, hasNotificationInfo, getHrefErr, requestErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var token = hasToken ? data.DEFAULT_TOKEN : null;
            var notificationInfo = hasNotificationInfo ? data.DEFAULT_NOTIFICATION_INFO[0] : null;
            var units = [data.DEFAULT_UNIT, 'call'];

            var implementations = {
                config: {
                    modules: {
                        accounting: units
                    },
                    usageAPI: {
                        host: 'localhost',
                        port: 9000
                    }
                },
                db: {
                    getToken: function (callback) {
                        return callback(getTokenErr, token);
                    },
                    getNotificationInfo: function (apiKey, callback) {
                        return callback(getNotificationErr, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback(getHrefErr, 'href');
                    },
                    resetAccounting: function (apiKey, callback) {
                        return callback(null);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(requestErr, {statusCode: 201}, {});
                    }
                },
                logger: {
                    info: function (msg) {}
                }
            };

            mocker(implementations, function (notifier, spies) {

                notifier.notifyUsage(apiKey, function (err) {

                    assert(spies.db.getToken.calledOnce);

                    if (getTokenErr) {
                        assert.equal(err, getTokenErr);
                    } else if (!token) {
                        assert.equal(err, 'There is no available token.');
                    } else {

                        assert(spies.db.getNotificationInfo.calledWith(apiKey));

                        if (getNotificationErr) {
                            assert.equal(err, getNotificationErr);
                        } else if (!notificationInfo) {
                            assert.equal(err, null);
                        } else {

                            assert(spies.db.getHref.calledWith(units[0]));

                            if (getHrefErr) {
                                assert.equal(err, getHrefErr);
                            } else {
                                for (var i = 1; i < units.length; i += 1) {
                                    assert(spies.db.getHref.calledWith(units[i]));                                    
                                }
                                assert(spies.logger.info.calledWith('Notifying the accounting...'));
                                assert(spies.requester.request.calledOnce);

                                if (requestErr) {
                                    assert.equal(err, 'Error notifying usage to the Usage Management API: ' + requestErr.code);
                                } else {
                                    assert(spies.db.resetAccounting.calledOnce);
                                    assert.equal(err, null);
                                }
                            }
                        }
                    }

                    done();
                });
            });
        };

        it('should call the callback with error when db fails getting the token', function (done) {
            testNotifyUsage('Error', false, false, false, false, false, done);
        });

        it('should call the callback with error when there is no token for usage notification', function (done) {
            testNotifyUsage(false, false, false, false, false, false, done);
        });

        it('should call the callback with error when db fails getting the notification information', function (done) {
            testNotifyUsage(false, true, 'Error', false, false, false, done);
        });

        it('should call the callback without error when there is no usage information to notify', function (done) {
            testNotifyUsage(false, true, false, false, false, false, done);
        });

        it('should call the callback with error when there is an error sending the usage specifications', function (done) {
            testNotifyUsage(false, true, false, true, 'Error', false, done);
        });

        it('should call the callback when there is an error notifying the usage information', function (done) {
            testNotifyUsage(false, true, false, true, false, {code: 400}, done);
        });

        it('should call the callback without error when there is no error notifying the usage information', function (done) {
            testNotifyUsage(false, true, false, true, false, false, done);
        });
    });
});