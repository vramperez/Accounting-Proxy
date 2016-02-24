var proxyquire = require('proxyquire'),
    assert = require('assert'),
    sinon = require('sinon');

/**
 * Return an object with the mocked dependencies and object with the neecessary spies specified in implementations. 
 * 
 * @param  {Object}   implementations     Dependencies to mock and spy.
 */
var mocker = function(implementations, callback) {
    var mock, spies = {};

    var db_mock = {
        getToken: implementations.getToken,
        resetAccounting: implementations.resetAccounting
    }
    var request_mock = {
        request: function() {}
    }
    var config_mock = {
        database: './db',
        WStore: implementations.WStore
    }
    // Create spies
    if (implementations.getToken !== undefined) {
        spies.getToken = sinon.spy(db_mock, 'getToken');
    }
    if (implementations.resetAccounting !== undefined) {
        spies.resetAccounting = sinon.spy(db_mock, 'resetAccounting');
    }
    if (implementations.request !== undefined) {
        request_mock.request = implementations.request;
        spies.request = sinon.spy(request_mock, 'request');
    }

    mock = proxyquire('../../notifier', {
        request: request_mock.request,
        './config': config_mock,
        './db': db_mock
    });
    return callback(mock, spies);
}

describe('Testing Notifier', function() {
    var notificationInfo = {
        customer: '0001',
        value: '2',
        correlationNumber: '3',
        recordType: 'callUsage',
        unit: 'call',
        productId: 'productId',
        orderId: 'orderId',
        apiKey: 'apiKey'
    }

    describe('Function "notify"', function() {

        it('error getting the Token', function(done) {
            var implementations = {
                getToken: function(callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(notifier, spies){
                notifier.notify({}, function(err) {
                    assert.equal(err, 'Error obtaining the token');
                    assert.equal(spies.getToken.callCount, 1);
                    done();
                });
            });
        });

        it('error notifying the WStore', function(done) {
            var implementations = {
                getToken: function(callback) {
                    return callback(null, 'token');
                },
                request: function(options, callback) {
                    return callback('Error', null, null);
                },
                WStore: {
                    url: 'http://host:port/path/'    
                }
            }
            mocker(implementations, function(notifier, spies){
                notifier.notify(notificationInfo, function(err) {
                    assert.equal(err, 'Error notifying the WStore');
                    assert.equal(spies.getToken.callCount, 1);
                    assert.equal(spies.request.callCount, 1);
                    assert.equal(spies.request.getCall(0).args[0].url , implementations.WStore.url + notificationInfo.orderId + '/' + notificationInfo.productId);
                    assert.equal(spies.request.getCall(0).args[0].headers['X-API-KEY'] , 'token');
                    done();
                });
            });
        });

        it('error while reseting the accounting', function(done) {
            var implementations = {
                getToken: function(callback) {
                    return callback(null, 'token');
                },
                request: function(options, callback) {
                    return callback(null, {statusCode: 200}, null);
                },
                WStore: {
                    url: 'http://host:port/path/'    
                },
                resetAccounting: function(apiKey, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(notifier, spies){
                notifier.notify(notificationInfo, function(err) {
                    assert.equal(err, 'Error while reseting the accounting after notify the WStore');
                    assert.equal(spies.getToken.callCount, 1);
                    assert.equal(spies.request.callCount, 1);
                    assert.equal(spies.request.getCall(0).args[0].url , implementations.WStore.url + notificationInfo.orderId + '/' + notificationInfo.productId);
                    assert.equal(spies.request.getCall(0).args[0].headers['X-API-KEY'] , 'token');
                    assert.equal(spies.resetAccounting.callCount, 1);
                    assert.equal(spies.resetAccounting.getCall(0).args[0] , 'apiKey');
                    done();
                });
            });
        });

        it('response from WStore failed', function(done) {
            var implementations = {
                getToken: function(callback) {
                    return callback(null, 'token');
                },
                request: function(options, callback) {
                    return callback(null, {statusCode: 400}, null);
                },
                WStore: {
                    url: 'http://host:port/path/'    
                }
            }
            mocker(implementations, function(notifier, spies){
                notifier.notify(notificationInfo, function(err) {
                    assert.equal(err, 'Error notifying the WStore');
                    assert.equal(spies.getToken.callCount, 1);
                    assert.equal(spies.request.callCount, 1);
                    assert.equal(spies.request.getCall(0).args[0].url , implementations.WStore.url + notificationInfo.orderId + '/' + notificationInfo.productId);
                    assert.equal(spies.request.getCall(0).args[0].headers['X-API-KEY'] , 'token');
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                getToken: function(callback) {
                    return callback(null, 'token');
                },
                request: function(options, callback) {
                    return callback(null, {statusCode: 200}, null);
                },
                WStore: {
                    url: 'http://host:port/path/'    
                },
                resetAccounting: function(apiKey, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(notifier, spies){
                notifier.notify(notificationInfo, function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.getToken.callCount, 1);
                    assert.equal(spies.request.callCount, 1);
                    assert.equal(spies.request.getCall(0).args[0].url , implementations.WStore.url + notificationInfo.orderId + '/' + notificationInfo.productId);
                    assert.equal(spies.request.getCall(0).args[0].headers['X-API-KEY'] , 'token');
                    assert.equal(spies.resetAccounting.callCount, 1);
                    assert.equal(spies.resetAccounting.getCall(0).args[0] , 'apiKey');
                    done();
                });
            });
        });
    });
});