var proxyquire = require('proxyquire'),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async');

/**
 * Return an object database with the mocked dependencies and object with the neecessary spies specified in implementations. 
 * 
 * @param  {Object}   implementations Dependencies to mock and spy.
 */
var mocker = function(implementations, callback) {

    var config_mock = {
        database: {
            name: 15
        }
    }
    var db_mock = {
        multi: function() {
            return this;
        },
        sadd: implementations.sadd,
        srem: implementations.srem,
        smembers: implementations.smembers,
        hmset: implementations.hmset,
        hget: implementations.hget,
        hgetall: implementations.hgetall,
        hdel: implementations.hdel,
        del: implementations.del,
        exec: implementations.exec,
        select: implementations.select
    }
    var redis_stub = {
        createClient: function() {
            return db_mock;
        }
    }
    var async_stub = {
        each: async.each,
        waterfall: async.waterfall,
        apply: async.apply,
        forEachOf: async.forEachOf
    }
    // Create necessary spies
    var spies = {
        each: sinon.spy(async_stub, 'each'),
        apply: sinon.spy(async_stub, 'apply'),
        waterfall: sinon.spy(async_stub, 'waterfall'),
        forEachOf: sinon.spy(async_stub, 'forEachOf')
    }
    async.forEachOf(implementations, function(implementation, method, task_callback) {
        spies[method.toString()] = sinon.spy(db_mock, method.toString());
        task_callback();
    }, function() {
        var db = proxyquire('../../db_Redis', {
            'redis': redis_stub,
            './config': config_mock,
            'async': async_stub
        });
        return callback(db, spies);
    });
}

describe('Testing REDIS database', function() {

    describe('Function "init"', function() {

        it('initialization', function(done) {
            var implementations = {
                select: function(db, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.init(function(err) {
                    assert.equal(err, 'Error selecting datbase 15: Error');
                    assert.equal(spies.select.callCount, 1);
                    assert.equal(spies.select.getCall(0).args[0], 15);
                    done();
                });
            });
        });

        it('correct intialization', function(done) {
            var implementations = {
                select: function(db, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.init(function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.select.callCount, 1);
                    assert.equal(spies.select.getCall(0).args[0], 15);
                    done();
                });
            });
        });
    });

    describe('Function "addToken"', function() {

        it('error executing', function(done) {
            var implementations = {
                del: function() {},
                sadd: function() {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.addToken('token', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0], 'token');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['token', 'token']);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('token added', function(done) {
            var implementations = {
                del: function() {},
                sadd: function() {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.addToken('token', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0], 'token');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['token', 'token']);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getToken"', function() {

        it('error getting token', function(done) {
            var implementations = {
                smembers: function(key, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getToken(function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'token');
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                smembers: function(key, callback) {
                    return callback(null, ['token']);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getToken(function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'token');
                    done();
                });
            });
        });
    });

    describe('Function "newService"', function() {

        it('error executing', function(done) {
            var implementations = {
                hmset: function(hash, key, value){},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            var params = ['/public', 'http://example.com/url']
            mocker(implementations, function(db, spies) {
                db.newService(params[0], params[1], function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], 'services');
                    assert.equal(spies.hmset.getCall(0).args[1], params[0]);
                    assert.equal(spies.hmset.getCall(0).args[2], params[1]);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hmset: function(hash, key, value){},
                exec: function(callback) {
                    return callback(null);
                }
            }
            var params = ['/public', 'http://example.com/url']
            mocker(implementations, function(db, spies) {
                db.newService(params[0], params[1], function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], 'services');
                    assert.equal(spies.hmset.getCall(0).args[1], params[0]);
                    assert.equal(spies.hmset.getCall(0).args[2], params[1]);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "deleteService"', function() {

        it('Error getting the api-keys', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback('Error', null);
                },
                hdel: function(hash, value) {},
                del: function(hash) {}
            }
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hdel.callCount, 1);
                    assert.equal(spies.hdel.getCall(0).args[0] , 'services');
                    assert.equal(spies.hdel.getCall(0).args[1] , '/public');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , '/public');
                    done();                  
                });
            });
        });

        it('error getting subscriptions', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    if (hash === '/public') {
                        return callback(null, ['apiKey1']);
                    } else {
                        return callback('Error');
                    }
                },
                hdel: function(hash, value) {},
                del: function(hash) {}
            }
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hdel.callCount, 1);
                    assert.equal(spies.hdel.getCall(0).args[0] , 'services');
                    assert.equal(spies.hdel.getCall(0).args[1] , '/public');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 1);
                    assert.deepEqual(spies.each.getCall(0).args[0] , ['apiKey1']);
                    assert.equal(spies.smembers.callCount, 2);
                    assert.equal(spies.smembers.getCall(0).args[0] , '/public');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    done();                  
                });
            });
        });

        it('error getting the customer', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    if (hash === '/public') {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                hdel: function(hash, value) {},
                del: function(hash) {},
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hdel.callCount, 1);
                    assert.equal(spies.hdel.getCall(0).args[0] , 'services');
                    assert.equal(spies.hdel.getCall(0).args[1] , '/public');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['apiKey1', 'apiKey2', 'subs1']);
                    assert.equal(spies.smembers.callCount, 3);
                    assert.equal(spies.smembers.getCall(0).args[0] , '/public');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    assert.equal(spies.smembers.getCall(2).args[0] , 'apiKey2subs');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey1');
                    done();                  
                });
            });
        });

        it('error executing the query', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    if (hash === '/public') {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                hdel: function(hash, value) {},
                del: function(hash) {},
                hget: function(hash, key, callback) {
                    return callback(null, '0001');
                },
                srem: function(hash, key) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            var del_args = ['/public', 'apiKey1', 'apiKey1subs', 'apiKey2', 'apiKey2subs', 'subs1', 'subs1subs'];
            var hget_args = ['apiKey1', 'apiKey2', 'subs1'];
            var srem_args = ['0001', 'apiKeys', '0001', 'apiKeys', '0001', 'apiKeys']
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hdel.callCount, 1);
                    assert.equal(spies.hdel.getCall(0).args[0] , 'services');
                    assert.equal(spies.hdel.getCall(0).args[1] , '/public');
                    assert.equal(spies.del.callCount, 7);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    async.forEachOf(del_args, function(arg, i, task_callback) {
                        assert.equal(spies.del.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['apiKey1', 'apiKey2', 'subs1']);
                    assert.equal(spies.smembers.callCount, 3);
                    assert.equal(spies.smembers.getCall(0).args[0] , '/public');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    assert.equal(spies.smembers.getCall(2).args[0] , 'apiKey2subs');
                    assert.equal(spies.hget.callCount, 3);
                    async.forEachOf(hget_args, function(arg, i, task_callback) {
                        assert.equal(spies.hget.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.srem.callCount, 6);
                    async.forEachOf(srem_args, function(arg, i, task_callback) {
                        assert.equal(spies.srem.getCall(i).args[0] , arg);
                    });
                    done();                  
                });
            });
        });

        it('error executing the query', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    if (hash === '/public') {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                hdel: function(hash, value) {},
                del: function(hash) {},
                hget: function(hash, key, callback) {
                    return callback(null, '0001');
                },
                srem: function(hash, key) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            var del_args = ['/public', 'apiKey1', 'apiKey1subs', 'apiKey2', 'apiKey2subs', 'subs1', 'subs1subs'];
            var hget_args = ['apiKey1', 'apiKey2', 'subs1'];
            var srem_args = ['0001', 'apiKeys', '0001', 'apiKeys', '0001', 'apiKeys']
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.hdel.callCount, 1);
                    assert.equal(spies.hdel.getCall(0).args[0] , 'services');
                    assert.equal(spies.hdel.getCall(0).args[1] , '/public');
                    assert.equal(spies.del.callCount, 7);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    async.forEachOf(del_args, function(arg, i, task_callback) {
                        assert.equal(spies.del.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['apiKey1', 'apiKey2', 'subs1']);
                    assert.equal(spies.smembers.callCount, 3);
                    assert.equal(spies.smembers.getCall(0).args[0] , '/public');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    assert.equal(spies.smembers.getCall(2).args[0] , 'apiKey2subs');
                    assert.equal(spies.hget.callCount, 3);
                    async.forEachOf(hget_args, function(arg, i, task_callback) {
                        assert.equal(spies.hget.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.srem.callCount, 6);
                    async.forEachOf(srem_args, function(arg, i, task_callback) {
                        assert.equal(spies.srem.getCall(i).args[0] , arg);
                    });
                    done();                  
                });
            });
        });
    });

    describe('Function "getService"', function() {

        it('error executing', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, 'Error');
                    assert.equal(service, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], 'services');
                    assert.equal(spies.hget.getCall(0).args[1], '/public');
                    done();
                });
            });
        });

        it('no service available', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, null);
                    assert.equal(service, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], 'services');
                    assert.equal(spies.hget.getCall(0).args[1], '/public');
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 'http://example.com/url');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, null);
                    assert.equal(service, 'http://example.com/url');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], 'services');
                    assert.equal(spies.hget.getCall(0).args[1], '/public');
                    done();
                });
            });
        });
    });

    describe('Function "checkPath"', function(done) {

        it('error getting the service', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkPath('/url', function(err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check, false);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'services');
                    done();
                });
            }); 
        });

        it('invalid url', function(done) {
            var services = {
                '/public1': 'http://example.com/url1',
                '/public2': 'http://example.com/url2'
            }
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, services);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkPath('/no_exist', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'services');
                    assert.equal(spies.forEachOf.callCount, 1);
                    assert.equal(spies.forEachOf.getCall(0).args[0], services);
                    done();
                });
            });
        });

        it('correct url', function(done) {
            var services = {
                '/public1': 'http://example.com/url1',
                '/public2': 'http://example.com/url2'
            }
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, services);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkPath('/public2', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, true);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'services');
                    assert.equal(spies.forEachOf.callCount, 1);
                    assert.equal(spies.forEachOf.getCall(0).args[0], services);
                    done();
                });
            }); 
        });
    });
    
    describe('Function "newBuy"', function() {

        it('executing error', function(done) {
            var implementations = {
                sadd: function(list) {},
                hmset: function(hash, object) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            var buyInfo = {
                apiKey: 'apiKey',
                publicPath: '/public',
                orderId: 'orderId',
                productId: 'productId',
                customer: '0001',
                unit: 'call',
                recordType: 'callUsage'
            }
            var args = {
                sadd: [ ['apiKeys', buyInfo.apiKey],
                        [buyInfo.publicPath, buyInfo.apiKey],
                        [buyInfo.customer, buyInfo.apiKey]],
                hmset: {
                    publicPath: buyInfo.publicPath,
                    orderId: buyInfo.orderId,
                    productId: buyInfo.productId,
                    customer: buyInfo.customer,
                    unit: buyInfo.unit,
                    value: 0,
                    recordType: buyInfo.recordType,
                    correlationNumber: 0
                }
            }
            mocker(implementations, function(db, spies) {
                db.newBuy(buyInfo, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.sadd.callCount, 3);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], args.sadd[0]);
                    assert.deepEqual(spies.sadd.getCall(1).args[0], args.sadd[1]);
                    assert.deepEqual(spies.sadd.getCall(2).args[0], args.sadd[2]);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], buyInfo.apiKey);
                    assert.deepEqual(spies.hmset.getCall(0).args[1], args.hmset);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct buy', function(done) {
            var implementations = {
                sadd: function(list) {},
                hmset: function(hash, object) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            var buyInfo = {
                apiKey: 'apiKey',
                publicPath: '/public',
                orderId: 'orderId',
                productId: 'productId',
                customer: '0001',
                unit: 'call',
                recordType: 'callUsage'
            }
            var args = {
                sadd: [ ['apiKeys', buyInfo.apiKey],
                        [buyInfo.publicPath, buyInfo.apiKey],
                        [buyInfo.customer, buyInfo.apiKey]],
                hmset: {
                    publicPath: buyInfo.publicPath,
                    orderId: buyInfo.orderId,
                    productId: buyInfo.productId,
                    customer: buyInfo.customer,
                    unit: buyInfo.unit,
                    value: 0,
                    recordType: buyInfo.recordType,
                    correlationNumber: 0
                }
            }
            mocker(implementations, function(db, spies) {
                db.newBuy(buyInfo, function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.sadd.callCount, 3);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], args.sadd[0]);
                    assert.deepEqual(spies.sadd.getCall(1).args[0], args.sadd[1]);
                    assert.deepEqual(spies.sadd.getCall(2).args[0], args.sadd[2]);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], buyInfo.apiKey);
                    assert.deepEqual(spies.hmset.getCall(0).args[1], args.hmset);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getApiKeys"', function(done) {

        it('error getting user api-keys', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, 'Error');
                    assert.equal(apiKeys, null);
                    assert.equal(spies.smembers.callCount, 1);
                    done();
                });
            });
        });

        it('no api-keys available', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, null);
                    assert.equal(apiKeys, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], '0001');
                    done();
                });
            });
        });

        it('error getting accounting info', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, ['apiKey1']);
                },
                hgetall: function(hash, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, 'Error');
                    assert.equal(apiKeys, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], '0001');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'apiKey1');
                    done();
                });
            });
        });

        it('correct', function(done) {
            var keys = ['apiKey1', 'apiKey2'];
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, keys);
                },
                hgetall: function(hash, callback) {
                    if(hash === keys[0]) {
                        return callback(null, {
                            apiKey: hash,
                            productId: 'productId1',
                            orderId: 'orderId1',
                        });
                    } else {
                        return callback(null, {
                            apiKey: hash,
                            productId: 'productId2',
                            orderId: 'orderId2',
                        });
                    }
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, null);
                    assert.deepEqual(apiKeys, [
                    {
                        apiKey: 'apiKey1',
                        productId: 'productId1',
                        orderId: 'orderId1'
                    },
                    {
                        apiKey: 'apiKey2',
                        productId: 'productId2',
                        orderId: 'orderId2'
                    }
                    ]);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], '0001');
                    assert.equal(spies.each.callCount, 1);
                    assert.deepEqual(spies.each.getCall(0).args[0] , keys);
                    assert.equal(spies.hgetall.callCount, 2);
                    assert.equal(spies.hgetall.getCall(0).args[0], keys[0]);
                    assert.equal(spies.hgetall.getCall(1).args[0], keys[1]);
                    done();
                });
            });
        });
    });

    describe('Function "checkRequest"', function(done) {

        it('error getting accounting information', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check, false);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });

        it('no info available', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, '0002');
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, '0001');
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, true);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getAccountingInfo"', function(done) {

        it('error getting the accounting info', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , 'apiKey');
                    done();
                });
            });
        });

        it('no accounting info available', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, null);
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , 'apiKey');
                    done();
                });
            });
        });

        it('error getting the url', function(done) {
            var accountingInfo = {
                publicPath: '/public',
                unit: 'megabyte'
            }
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, accountingInfo);
                },
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'services');
                    assert.equal(spies.hget.getCall(0).args[1] , accountingInfo.publicPath);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var accountingInfo = {
                publicPath: '/public',
                unit: 'megabyte'
            }
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, accountingInfo);
                },
                hget: function(hash, key, callback) {
                    return callback(null, 'http://example.com/url');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, null);
                    assert.deepEqual(accInfo, {
                        unit: 'megabyte',
                        url: 'http://example.com/url',
                        publicPath: '/public'
                    });
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'services');
                    assert.equal(spies.hget.getCall(0).args[1] , accountingInfo.publicPath);
                    done();
                });
            });
        });
    });

    describe('Function "getNotificationInfo"', function() {

        it('error getting apiKeys', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    done();
                });
            });
        });

        it('error getting accounting information', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, ['apiKey']);
                },
                hgetall: function(hash, callback) {
                    return callback('Error', null);25
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    done();
                });
            });
        });

        it('no notification info available', function(done) {
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, null);
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    assert.equal(spies.each.callCount, 1);
                    assert.equal(spies.each.getCall(0).args[0], null);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var notificationInfo1 = {
                apiKey: 'apiKey1',
                orderId: 'orderId',
                productId: 'productId',
                customer: '0001',
                value: 1.5,
                correlationNumber: 2,
                recordType: 'callUsage',
                unit: 'call'
            }
            var notificationInfo2 = {
                value: 0
            }
            var implementations = {
                smembers: function(hash, callback) {
                    return callback(null, ['apiKey1', 'apiKey2']);
                },
                hgetall: function(hash, callback) {
                    if (hash === 'apiKey1') {
                        return callback(null, notificationInfo1);
                    } else {
                        return callback(null, notificationInfo2);
                    }
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, null);
                    assert.deepEqual(notificationInfo, [notificationInfo1]);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    assert.equal(spies.hgetall.callCount, 2);
                    assert.equal(spies.hgetall.getCall(0).args[0] , 'apiKey1');
                    assert.equal(spies.hgetall.getCall(1).args[0] , 'apiKey2');
                    done();
                });
            });
        });
    });

    describe('Function "makeAccounting"', function() {

        it('amount less than 0', function(done) {
            mocker({}, function(db, spies) {
                db.makeAccounting('apikey', -1.3, function(err) {
                    assert.equal(err, '[ERROR] The aomunt must be greater than 0');
                    done();
                });
            });
        });

        it('error getting previous value', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.3, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'value');
                    done();
                });
            });
        });

        it('error executing', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 1);
                },
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.3, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'value');
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0] , 'apiKey');
                    assert.deepEqual(spies.hmset.getCall(0).args[1] , {
                        value: 2.3
                    });
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 1);
                },
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.3, function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'value');
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0] , 'apiKey');
                    assert.deepEqual(spies.hmset.getCall(0).args[1] , {
                        value: 2.3
                    });
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "resetAccounting"', function() {

        it('error getting correlation number', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'correlationNumber');
                    done();
                });
            });
        });

        it('error executing', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 0);
                },
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'correlationNumber');
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0] , 'apiKey');
                    assert.deepEqual(spies.hmset.getCall(0).args[1] , {
                        correlationNumber: 1,
                        value: '0'
                    });
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 0);
                },
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'correlationNumber');
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0] , 'apiKey');
                    assert.deepEqual(spies.hmset.getCall(0).args[1] , {
                        correlationNumber: 1,
                        value: '0'
                    });
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "addCBSubscription"', function() {

        it('error executing', function(done) {
            var implementations = {
                sadd: function(list) {},
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.addCBSubscription('apiKey', 'subsId', 'http://example.com/url', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['apiKeysubs', 'subsId']);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.deepEqual(spies.hmset.getCall(0).args[0], 'subsId');
                    assert.deepEqual(spies.hmset.getCall(0).args[1], { apiKey: 'apiKey', notificationUrl: 'http://example.com/url'});
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                sadd: function(list) {},
                hmset: function(hash, value) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.addCBSubscription('apiKey', 'subsId', 'http://example.com/url', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['apiKeysubs', 'subsId']);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.deepEqual(spies.hmset.getCall(0).args[0], 'subsId');
                    assert.deepEqual(spies.hmset.getCall(0).args[1], { apiKey: 'apiKey', notificationUrl: 'http://example.com/url'});
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getCBSubscription"', function() {

        it('error getting subscription info', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subsId', function(err, subsInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(subsInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    done();
                });
            });
        });

        it('no subscription info available', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subsId', function(err, subsInfo) {
                    assert.equal(err, null);
                    assert.equal(subsInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    done();
                });
            });
        });

        it('error getting the unit', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, {
                        apiKey: 'apiKey',
                        notificationUrl: 'http://example.com/url'
                    });
                },
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subsId', function(err, subsInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(subsInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1], 'unit');
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hgetall: function(hash, callback) {
                    return callback(null, {
                        apiKey: 'apiKey',
                        notificationUrl: 'http://example.com/url'
                    });
                },
                hget: function(hash, key, callback) {
                    return callback(null, 'call');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subsId', function(err, subsInfo) {
                    assert.equal(err, null);
                    assert.deepEqual(subsInfo, {
                        apiKey: 'apiKey',
                        notificationUrl: 'http://example.com/url',
                        unit: 'call'
                    });
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1], 'unit');
                    done();
                });
            });
        });
    });

    describe('Function "deleteCBSubscription"', function() {

        it('error getting the api-key', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteCBSubscription('subsId', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.hget.getCall(0).args[1] , 'apiKey');
                    done();
                });
            });
        });

        it('error executing', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 'apiKey');
                },
                srem: function(key, value) {},
                del: function(hash) {},
                exec: function(callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteCBSubscription('subsId', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.hget.getCall(0).args[1] , 'apiKey');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0] , 'apiKeysubs');
                    assert.equal(spies.srem.getCall(0).args[1] , 'subsId');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                hget: function(hash, key, callback) {
                    return callback(null, 'apiKey');
                },
                srem: function(key, value) {},
                del: function(hash) {},
                exec: function(callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteCBSubscription('subsId', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.hget.getCall(0).args[1] , 'apiKey');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0] , 'apiKeysubs');
                    assert.equal(spies.srem.getCall(0).args[1] , 'subsId');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });
});