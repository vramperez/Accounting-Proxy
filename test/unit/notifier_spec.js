var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon');

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
        db: {},
        config: {},
        megabyte: {}
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
        megabyte: {}
    };

    mock.config.database = {
        type: './db'
    }
    async.each(Object.keys(implementations), function (obj, task_callback1) {
        async.each(Object.keys(implementations[obj]), function (implem, task_callback2) {
            mock[obj][implem.toString()] = implementations[obj][implem.toString()];
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
        // Mocking dependencies
        notifier = proxyquire('../../notifier', {
            './db': mock.db,
            './config': mock.config,
            async: mock.async,
            request: mock.requester.request,
            winston: mock.logger,
            './acc_modules/megabyte': mock.megabyte
        });
        return callback(notifier, spies);
    });
};

describe('Testing Notifier', function () {

    describe('Function "notifyUsageSpecification"', function () {

        it('error loaddin accounting module', function (done) {
            var unit = 'wrong';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'No accounting module for unit "' + unit + 
                        '" : missing file acc_modules/' +  unit + '.js');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    done();
                });
            });
        });

        it('error getting the href from db', function (done) {
            var unit = 'megabyte';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback('Error', null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    done();
                });
            });
        });

        it('specification already notify', function (done) {
            var unit = 'megabyte';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, 'href');
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    done();
                });
            });
        });

        it('error, function "getSpecification" not defined in accounting module', function (done) {
            var unit = 'megabyte';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error, function getSpecification undefined for unit ' + unit);
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    done();
                });
            });
        });

        it('error, specification not defined', function (done) {
            var unit = 'megabyte';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(undefined); 
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error, specification no available for unit ' + unit);
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    done();
                });
            });
        });

        it('error getting the token', function (done) {
            var unit = 'megabyte';
            var specification = {
                'key1': 'value1'
            };
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    },
                    getToken: function (callback) {
                        return callback('Error', null);
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(specification);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error getting the access token from db');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    done();
                });
            });
        });

        it('error sending the specification', function (done) {
            var unit = 'megabyte';
            var token = 'token';
            var specification = {
                'key1': 'value1'
            };
            var errCode = 'ECONREFUSED';
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    },
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(specification);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback({code: errCode}, {statusCode: 404, statusMessage: 'Not Found'}, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error sending the Specification: '+ errCode);
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], {
                        url: 'http://' + implementations.config.usageAPI.host + ':' + implementations.config.usageAPI.port +
                            implementations.config.usageAPI.path + '/usageSpecification',
                        json: true,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: token
                        },
                        body: specification
                    });
                    done();
                });
            });
        });

        it('error, response status code other than 201', function (done) {
            var unit = 'megabyte';
            var token = 'token';
            var specification = {
                'key1': 'value1'
            };
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    },
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(specification);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {statusCode: 404, statusMessage: 'Not Found'}, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error, 404 Not Found');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], {
                        url: 'http://' + implementations.config.usageAPI.host + ':' + implementations.config.usageAPI.port +
                            implementations.config.usageAPI.path + '/usageSpecification',
                        json: true,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: token
                        },
                        body: specification
                    });
                    done();
                });
            });
        });

        it('error adding the specification href', function (done) {
            var unit = 'megabyte';
            var token = 'token';
            var href = 'http://example:8080/specification/id'
            var specification = {
                'key1': 'value1'
            };
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    },
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    },
                    addSpecificationRef: function (unit, ref, callback) {
                        return callback('Error');
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(specification);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {statusCode: 201, statusMessage: 'Created'}, {href: href});
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], {
                        url: 'http://' + implementations.config.usageAPI.host + ':' + implementations.config.usageAPI.port +
                            implementations.config.usageAPI.path + '/usageSpecification',
                        json: true,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: token
                        },
                        body: specification
                    });
                    assert.equal(spies.db.addSpecificationRef.callCount, 1);
                    assert.equal(spies.db.addSpecificationRef.getCall(0).args[0], unit);
                    assert.equal(spies.db.addSpecificationRef.getCall(0).args[1], href);
                    done();
                });
            });
        });

        it('correct notification', function (done) {
            var unit = 'megabyte';
            var token = 'token';
            var href = 'http://example:8080/specification/id'
            var specification = {
                'key1': 'value1'
            };
            var implementations = {
                config: {
                    modules: {
                        accounting: [unit]
                    },
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                db: {
                    getHref: function (unit, callback) {
                        return callback(null, null);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    },
                    addSpecificationRef: function (unit, ref, callback) {
                        return callback(null);
                    }
                },
                megabyte: {
                    getSpecification: function (callback) { 
                        return callback(specification);
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {statusCode: 201, statusMessage: 'Created'}, {href: href});
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsageSpecification( function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.async.each.callCount, 1);
                    assert.equal(spies.async.each.getCall(0).args[0], implementations.config.modules.accounting);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.deepEqual(spies.requester.request.getCall(0).args[0], {
                        url: 'http://' + implementations.config.usageAPI.host + ':' + implementations.config.usageAPI.port +
                            implementations.config.usageAPI.path + '/usageSpecification',
                        json: true,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: token
                        },
                        body: specification
                    });
                    assert.equal(spies.db.addSpecificationRef.callCount, 1);
                    assert.equal(spies.db.addSpecificationRef.getCall(0).args[0], unit);
                    assert.equal(spies.db.addSpecificationRef.getCall(0).args[1], href);
                    done();
                });
            });
        });
    });

    describe('Function "notifyUsage"', function () {

        it('error getting the notification info from db', function (done) {
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback('Error', null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    done();
                });
            });
        });

        it('no accounting info vailable to notify', function (done) {
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    done();
                });
            });
        });

        it('error getting the ref from db', function (done) {
            var unit = 'megabyte';
            var notificationInfo = [{
                unit: unit
            }];
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback('Error');
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the accounting...');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.deepEqual(spies.async.each.getCall(0).args[0], notificationInfo);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    done();
                });
            });
        });

        it('error getting the token', function (done) {
            var unit = 'megabyte';
            var href = 'http://example:9223/path';
            var notificationInfo = [{
                unit: unit,
                recordType: 'data',
                orderId: 'orderId',
                productId: 'productId',
                correlationNumber: 0,
                value: 1.326,
                customer: 'user'
            }];
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback(null, href);
                    },
                    getToken: function (callback) {
                        return callback('Error', null);
                    }
                },
                config: {
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, 'Error obteining the token');
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the accounting...');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.deepEqual(spies.async.each.getCall(0).args[0], notificationInfo);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    done();
                });
            });
        });

        it('error sending the accounting information', function (done) {
            var unit = 'megabyte';
            var href = 'http://example:9223/path';
            var token = 'token';
            var notificationInfo = [{
                unit: unit,
                recordType: 'data',
                orderId: 'orderId',
                productId: 'productId',
                correlationNumber: 0,
                value: 1.326,
                customer: 'user'
            }];
            var body = {

            };
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback(null, href);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    }
                },
                config: {
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback('Error', {statusCode: 201}, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, 'Error sending the usage. 201 undefined');
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the accounting...');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.deepEqual(spies.async.each.getCall(0).args[0], notificationInfo);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.equal(spies.requester.request.getCall(0).args[0].url, 'http://' + implementations.config.usageAPI.host +
                     ':' + implementations.config.usageAPI.port + implementations.config.usageAPI.path + '/usage');
                    assert.equal(spies.requester.request.getCall(0).args[0].json, true);
                    assert.equal(spies.requester.request.getCall(0).args[0].method, 'POST');
                    assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {
                        'Content-Type': 'application/json',
                        authorization: token
                    });
                    done();
                });
            });
        });

        it('error reseting the accounting', function (done) {
            var unit = 'megabyte';
            var href = 'http://example:9223/path';
            var token = 'token';
            var notificationInfo = [{
                unit: unit,
                recordType: 'data',
                orderId: 'orderId',
                productId: 'productId',
                correlationNumber: 0,
                value: 1.326,
                customer: 'user'
            }];
            var body = {

            };
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback(null, href);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    },
                    resetAccounting: function (apiKey, callback) {
                        return callback('Error');
                    }
                },
                config: {
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {statusCode: 201}, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, 'Error while reseting the accounting after notify the usage');
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the accounting...');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.deepEqual(spies.async.each.getCall(0).args[0], notificationInfo);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.equal(spies.requester.request.getCall(0).args[0].url, 'http://' + implementations.config.usageAPI.host +
                     ':' + implementations.config.usageAPI.port + implementations.config.usageAPI.path + '/usage');
                    assert.equal(spies.requester.request.getCall(0).args[0].json, true);
                    assert.equal(spies.requester.request.getCall(0).args[0].method, 'POST');
                    assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {
                        'Content-Type': 'application/json',
                        authorization: token
                    });
                    assert.equal(spies.db.resetAccounting.callCount, 1);
                    assert.equal(spies.db.resetAccounting.getCall(0).args[0], notificationInfo.apiKey);
                    done();
                });
            });
        });

        it('correct usage notification', function (done) {
            var unit = 'megabyte';
            var href = 'http://example:9223/path';
            var token = 'token';
            var notificationInfo = [{
                unit: unit,
                recordType: 'data',
                orderId: 'orderId',
                productId: 'productId',
                correlationNumber: 0,
                value: 1.326,
                customer: 'user'
            }];
            var body = {

            };
            var implementations = {
                db: {
                    getNotificationInfo: function (callback) {
                        return callback(null, notificationInfo);
                    },
                    getHref: function (unit, callback) {
                        return callback(null, href);
                    },
                    getToken: function (callback) {
                        return callback(null, token);
                    },
                    resetAccounting: function (apiKey, callback) {
                        return callback(null);
                    }
                },
                config: {
                    usageAPI: {
                        host: 'localhost',
                        port: 8080
                    }
                },
                requester: {
                    request: function (options, callback) {
                        return callback(null, {statusCode: 201}, null);
                    }
                }
            };
            mocker(implementations, function (notifier, spies) {
                notifier.notifyUsage(function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.db.getNotificationInfo.callCount, 1);
                    assert.equal(spies.db.getHref.callCount, 1);
                    assert.equal(spies.logger.info.callCount, 1);
                    assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the accounting...');
                    assert.equal(spies.async.each.callCount, 1);
                    assert.deepEqual(spies.async.each.getCall(0).args[0], notificationInfo);
                    assert.equal(spies.db.getHref.getCall(0).args[0], unit);
                    assert.equal(spies.db.getToken.callCount, 1);
                    assert.equal(spies.requester.request.callCount, 1);
                    assert.equal(spies.requester.request.getCall(0).args[0].url, 'http://' + implementations.config.usageAPI.host +
                     ':' + implementations.config.usageAPI.port + implementations.config.usageAPI.path + '/usage');
                    assert.equal(spies.requester.request.getCall(0).args[0].json, true);
                    assert.equal(spies.requester.request.getCall(0).args[0].method, 'POST');
                    assert.deepEqual(spies.requester.request.getCall(0).args[0].headers, {
                        'Content-Type': 'application/json',
                        authorization: token
                    });
                    assert.equal(spies.db.resetAccounting.callCount, 1);
                    assert.equal(spies.db.resetAccounting.getCall(0).args[0], notificationInfo.apiKey);
                    done();
                });
            });
        });
    });
});