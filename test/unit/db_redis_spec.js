var proxyquire = require('proxyquire'),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async');

/**
 * Return an object database with the mocked dependencies and object with the neecessary spies specified in implementations.
 *
 * @param  {Object}   implementations Dependencies to mock and spy.
 */
var mocker = function (implementations, callback) {

    var config_mock = {
        database: {
            name: 15
        }
    };
    var db_mock = {
        multi: function () {
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
    };
    var redis_stub = {
        createClient: function () {
            return db_mock;
        }
    };
    var async_stub = {
        each: async.each,
        waterfall: async.waterfall,
        apply: async.apply,
        forEachOf: async.forEachOf
    };
    // Create necessary spies
    var spies = {
        each: sinon.spy(async_stub, 'each'),
        apply: sinon.spy(async_stub, 'apply'),
        waterfall: sinon.spy(async_stub, 'waterfall'),
        forEachOf: sinon.spy(async_stub, 'forEachOf')
    };
    async.forEachOf(implementations, function (implementation, method, task_callback) {
        spies[method.toString()] = sinon.spy(db_mock, method.toString());
        task_callback();
    }, function () {
        var db = proxyquire('../../db_Redis', {
            redis: redis_stub,
            './config': config_mock,
            async: async_stub
        });
        return callback(db, spies);
    });
};

describe('Testing REDIS database', function () {

    describe('Function "init"', function () {

        it('initialization', function (done) {
            var implementations = {
                select: function (db, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.init(function (err) {
                    assert.equal(err, 'Error selecting datbase 15: Error. Database name must be a number between 0 and 14.');
                    assert.equal(spies.select.callCount, 1);
                    assert.equal(spies.select.getCall(0).args[0], 15);
                    done();
                });
            });
        });

        it('correct intialization', function (done) {
            var implementations = {
                select: function (db, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.init(function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.select.callCount, 1);
                    assert.equal(spies.select.getCall(0).args[0], 15);
                    done();
                });
            });
        });
    });

    describe('Function "addToken"', function () {
        var token = 'token';

        it('error executing', function (done) {
            var implementations = {
                del: function () {},
                sadd: function () {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addToken(token, function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0], token);
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['token', token]);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('token added', function (done) {
            var implementations = {
                del: function () {},
                sadd: function () {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addToken(token, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.del.callCount, 1);
                    assert.equal(spies.del.getCall(0).args[0], token);
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['token', token]);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getToken"', function () {
        var token = 'token';

        it('error getting token', function (done) {
            var implementations = {
                smembers: function (key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, 'Error');
                    assert.equal(token, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'token');
                    done();
                });
            });
        });

        it('no available token', function (done) {
            var implementations = {
                smembers: function (key, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, null);
                    assert.equal(token, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'token');
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                smembers: function (key, callback) {
                    return callback(null, [token]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, null);
                    assert.equal(token, token);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'token');
                    done();
                });
            });
        });
    });

    describe('Function "newService"', function () {
        var publicPath = '/public';
        var appId = 'appId';
        var url = 'http://example.com/path';
        var saddParams = ['services', publicPath];
        var hmsetParams = { url: url, appId: appId};

        it('error executing', function (done) {
            var implementations = {
                hmset: function (hash, key, value){},
                sadd: function (list) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.newService(publicPath, url, appId, function (err) {
                    assert.equal(err, '[ERROR] Error in database adding the new service.');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], saddParams);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], publicPath);
                    assert.deepEqual(spies.hmset.getCall(0).args[1], hmsetParams);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                hmset: function (hash, key, value){},
                sadd: function (list) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.newService(publicPath, url, appId, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], saddParams);
                    assert.equal(spies.hmset.callCount, 1);
                    assert.equal(spies.hmset.getCall(0).args[0], publicPath);
                    assert.deepEqual(spies.hmset.getCall(0).args[1], hmsetParams);
                    assert.equal(spies.exec.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "deleteService"', function () {
        var publicPath = '/public';

        it('Error getting the api-keys', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error', null);
                },
                srem: function (hash, key) {},
                del: function (hash) {}
            };
            mocker(implementations, function (db, spies) {
                db.deleteService('/public', function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], 'services');
                    assert.equal(spies.del.callCount, 3);
                    assert.equal(spies.del.getCall(0).args[0] , publicPath);
                    assert.equal(spies.del.getCall(1).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.del.getCall(2).args[0] , publicPath + 'admins');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , publicPath + 'apiKeys');
                    done();
                });
            });
        });

        it('error getting subscriptions', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    if (hash === publicPath + 'apiKeys') {
                        return callback(null, ['apiKey1']);
                    } else {
                        return callback('Error');
                    }
                },
                srem: function (hash, key) {},
                del: function (hash) {}
            };
            mocker(implementations, function (db, spies) {
                db.deleteService('/public', function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], 'services');
                    assert.equal(spies.del.callCount, 3);
                    assert.equal(spies.del.getCall(0).args[0] , publicPath);
                    assert.equal(spies.del.getCall(1).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.del.getCall(2).args[0] , publicPath + 'admins');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 1);
                    assert.deepEqual(spies.each.getCall(0).args[0] , ['apiKey1']);
                    assert.equal(spies.smembers.callCount, 2);
                    assert.equal(spies.smembers.getCall(0).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    done();
                });
            });
        });

        it('error getting the customer', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    if (hash === publicPath + 'apiKeys') {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                srem: function (hash, key) {},
                hdel: function (hash, value) {},
                del: function (hash) {},
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteService('/public', function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], 'services');
                    assert.equal(spies.del.callCount, 3);
                    assert.equal(spies.del.getCall(0).args[0] , publicPath);
                    assert.equal(spies.del.getCall(1).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.del.getCall(2).args[0] , publicPath + 'admins');
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['apiKey1', 'apiKey2', 'subs1']);
                    assert.equal(spies.smembers.callCount, 3);
                    assert.equal(spies.smembers.getCall(0).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    assert.equal(spies.smembers.getCall(2).args[0] , 'apiKey2subs');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey1');
                    done();
                });
            });
        });

        it('error executing the query', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    if (hash === publicPath + 'apiKeys' ) {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                del: function (hash) {},
                hget: function (hash, key, callback) {
                    return callback(null, '0001');
                },
                srem: function (hash, key) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            var del_args = [publicPath, publicPath + 'apiKeys', publicPath + 'admins', 'apiKey1', 'apiKey1subs', 'apiKey2', 'apiKey2subs', 'subs1', 'subs1subs'];
            var hget_args = ['apiKey1', 'apiKey2', 'subs1'];
            var srem_args = ['services', '0001', 'apiKeys', '0001', 'apiKeys', '0001', 'apiKeys'];
            mocker(implementations, function (db, spies) {
                db.deleteService('/public', function (err) {
                    assert.equal(err, '[ERROR] Error in datbase deleting the service.');
                    assert.equal(spies.del.callCount, 9);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    async.forEachOf(del_args, function (arg, i, task_callback) {
                        assert.equal(spies.del.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['apiKey1', 'apiKey2', 'subs1']);
                    assert.equal(spies.smembers.callCount, 3);
                    assert.equal(spies.smembers.getCall(0).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'apiKey1subs');
                    assert.equal(spies.smembers.getCall(2).args[0] , 'apiKey2subs');
                    assert.equal(spies.hget.callCount, 3);
                    async.forEachOf(hget_args, function (arg, i, task_callback) {
                        assert.equal(spies.hget.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.srem.callCount, 7);
                    async.forEachOf(srem_args, function (arg, i, task_callback) {
                        assert.equal(spies.srem.getCall(i).args[0] , arg);
                    });
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    if (hash === '/public') {
                        return callback(null, ['apiKey1', 'apiKey2']);
                    } else if (hash === 'apiKey1subs'){
                        return callback(null, null);
                    } else {
                        return callback(null, ['subs1']);
                    }
                },
                del: function (hash) {},
                hget: function (hash, key, callback) {
                    return callback(null, '0001');
                },
                srem: function (hash, key) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            var del_args = [publicPath, publicPath + 'apiKeys', publicPath + 'admins',  'subs1', 'subs1subs', 'subs1', 'subs1subs'];
            var hget_args = ['subs1', 'subs1'];
            var srem_args = ['services', '0001', 'apiKeys', '0001', 'apiKeys'];
            mocker(implementations, function (db, spies) {
                db.deleteService('/public', function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.del.callCount, 7);
                    assert.equal(spies.del.getCall(0).args[0] , '/public');
                    async.forEachOf(del_args, function (arg, i, task_callback) {
                        assert.equal(spies.del.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.waterfall.callCount, 1);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(1).args[0] , ['subs1', 'subs1']);
                    assert.equal(spies.smembers.callCount, 2);
                    assert.equal(spies.smembers.getCall(0).args[0] , publicPath + 'apiKeys');
                    assert.equal(spies.smembers.getCall(1).args[0] , 'subs1subs');
                    assert.equal(spies.hget.callCount, 2);
                    async.forEachOf(hget_args, function (arg, i, task_callback) {
                        assert.equal(spies.hget.getCall(i).args[0] , arg);
                    });
                    assert.equal(spies.srem.callCount, 5);
                    async.forEachOf(srem_args, function (arg, i, task_callback) {
                        assert.equal(spies.srem.getCall(i).args[0] , arg);
                    });
                    done();
                });
            });
        });
    });

    describe('Function "getService"', function () {
        var hgetallArgs = ['/public'];
        var service = {
            url: 'http://example.com/url',
            appId: 'appId'
        };

        it('error executing', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getService('/public', function (err, service) {
                    assert.equal(err, '[ERROR] Error in database getting the service.');
                    assert.equal(service, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], hgetallArgs[0]);
                    done();
                });
            });
        });

        it('no service available', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, null);
                }
            }
            mocker(implementations, function (db, spies) {
                db.getService('/public', function (err, service) {
                    assert.equal(err, null);
                    assert.equal(service, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], hgetallArgs[0]);
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, service);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getService('/public', function (err, result) {
                    assert.equal(err, null);
                    assert.equal(result, service);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], hgetallArgs[0]);
                    done();
                });
            });
        });
    });

    describe('Function "getAllServices"', function () {
        var services = [
            {
                publicPath: '/public1',
                url: 'http://example.com/path',
                appId: 'appId1'
            },
            {
                publicPath: '/public2',
                url: 'http://example.com/path',
                appId: 'appId2'
            }
        ];
        var publicPaths = ['/public1', '/public2'];

        it('error in smsmeber', function (done) {
            var implementations = {
                smembers: function (has, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAllServices(function (err, services) {
                    assert.equal(err, '[ERROR] Error in database getting the services.');
                    assert.equal(services, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    done();
                });
            });
        });

        it('error in hgetall', function (done) {
            var implementations = {
                smembers: function (has, callback) {
                    return callback(null, publicPaths);
                },
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAllServices(function (err, services) {
                    assert.equal(err, '[ERROR] Error in database getting the services.');
                    assert.deepEqual(services, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    assert.equal(spies.each.callCount, 1);
                    assert.equal(spies.each.getCall(0).args[0], publicPaths);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPaths[0]);
                    done();
                });
            });
        });

        it('correct, return two services', function (done) {
            var implementations = {
                smembers: function (has, callback) {
                    return callback(null, publicPaths);
                },
                hgetall: function (hash, callback) {
                    if (hash === publicPaths[0]) {
                        return callback(null, { url: services[0].url, appId: services[0].appId});
                    } else {
                        return callback(null, { url: services[1].url, appId: services[1].appId});
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAllServices(function (err, result) {
                    assert.equal(err, null);
                    assert.deepEqual(result, services);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    assert.equal(spies.each.callCount, 1);
                    assert.equal(spies.each.getCall(0).args[0], publicPaths);
                    assert.equal(spies.hgetall.callCount, 2);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPaths[0]);
                    assert.equal(spies.hgetall.getCall(1).args[0], publicPaths[1]);
                    done();
                });
            });
        });
    });

    describe('Function "getAppId"', function () {
        var publicPath = '/public';
        var appId = 'appId';

        it('error getting the appId', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAppId(publicPath, function (err, appId) {
                    assert.equal(err, 'Error');
                    assert.equal(appId, null);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], publicPath);
                    assert.equal(spies.hget.getCall(0).args[1], 'appId');
                    done();
                });
            });
        });

        it('correct, return the appId', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, appId);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAppId(publicPath, function (err, appId) {
                    assert.equal(err, null);
                    assert.equal(appId, appId);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], publicPath);
                    assert.equal(spies.hget.getCall(0).args[1], 'appId');
                    done();
                });
            });
        });
    });

    describe('Function "addAdmin"', function () {
        var idAdmin = 'idAdmin';

        it('error adding the admin', function (done) {
            var implementations = {
                sadd: function (list, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addAdmin(idAdmin, function (err) {
                    assert.equal(err, '[ERROR] Error in database adding admin: ' + idAdmin + '.');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['admins', idAdmin]);
                    done();
                });
            });
        });

        it('correct, added admin', function (done) {
            var implementations = {
                sadd: function (list, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addAdmin(idAdmin, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.sadd.callCount, 1);
                    assert.deepEqual(spies.sadd.getCall(0).args[0], ['admins', idAdmin]);
                    done();
                });
            });
        });
    });

    describe('Function "deleteAdmin"', function () {
        var idAdmin = 'idAdmin';
        var publicPaths = ['/public'];
        var service = {publicPath: '/public1'};

        it('error getting all services', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, '[ERROR] Error in database removing admin ' + idAdmin);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    done();
                });
            });
        });

        it('error in the first remove', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, publicPaths);
                },
                hgetall: function (hash, callback) {
                    return callback(null, service);
                },
                srem: function (hash, key, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, '[ERROR] Error in database removing admin ' + idAdmin);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPaths[0]);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(0).args[0], publicPaths);
                    assert.deepEqual(spies.each.getCall(1).args[0], [service]);
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], service.publicPath + 'admins');
                    done();
                });
            });
        });

        it('error in the second remove', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, publicPaths);
                },
                hgetall: function (hash, callback) {
                    return callback(null, service);
                },
                srem: function (hash, key, callback) {
                    if (hash === 'admins') {
                        return callback('Error');
                    } else {
                        return callback(null);
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, '[ERROR] Error in database removing admin: ' + idAdmin + '.');
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPaths[0]);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(0).args[0], publicPaths);
                    assert.deepEqual(spies.each.getCall(1).args[0], [service]);
                    assert.equal(spies.srem.callCount, 2);
                    assert.equal(spies.srem.getCall(0).args[0], service.publicPath + 'admins');
                    assert.equal(spies.srem.getCall(0).args[1], idAdmin);
                    assert.equal(spies.srem.getCall(1).args[0], 'admins');
                    assert.equal(spies.srem.getCall(1).args[1], idAdmin);
                    done();
                });
            });
        });

        it('correct, removed admin', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, publicPaths);
                },
                hgetall: function (hash, callback) {
                    return callback(null, service);
                },
                srem: function (hash, key, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPaths[0]);
                    assert.equal(spies.each.callCount, 2);
                    assert.deepEqual(spies.each.getCall(0).args[0], publicPaths);
                    assert.deepEqual(spies.each.getCall(1).args[0], [service]);
                    assert.equal(spies.srem.callCount, 2);
                    assert.equal(spies.srem.getCall(0).args[0], service.publicPath + 'admins');
                    assert.equal(spies.srem.getCall(0).args[1], idAdmin);
                    assert.equal(spies.srem.getCall(1).args[0], 'admins');
                    assert.equal(spies.srem.getCall(1).args[1], idAdmin);
                    done();
                });
            });
        });
    });

    describe('Function "bindAdmin"', function () {
        var idAdmin = 'idAdmin';
        var publicPath = 'publicPath';

        it('error, invalid public path', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, '[ERROR] Invalid public path.');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPath);
                    done();
                });
            });
        });

        it('error, invalid admin', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, {url: 'http://example.com/path', publicPath: '/public', appId: 'appId'});
                },
                smembers: function (hash, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, '[ERROR] Invalid admin.');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPath);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'admins');
                    done();
                });
            });
        });

        it('error adding the administrator', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, {url: 'http://example.com/path', publicPath: '/public', appId: 'appId'});
                },
                smembers: function (hash, callback) {
                    return callback(null, [idAdmin]);
                },
                sadd: function (hash, key, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, '[ERROR] Error adding the administrator.');
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPath);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'admins');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.equal(spies.sadd.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.sadd.getCall(0).args[1], idAdmin);
                    done();
                });
            });
        });

        it('new administrator added', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, {url: 'http://example.com/path', publicPath: '/public', appId: 'appId'});
                },
                smembers: function (hash, callback) {
                    return callback(null, [idAdmin]);
                },
                sadd: function (hash, key, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], publicPath);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'admins');
                    assert.equal(spies.sadd.callCount, 1);
                    assert.equal(spies.sadd.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.sadd.getCall(0).args[1], idAdmin);
                    done();
                });
            });
        });
    });

    describe('Function "unbindAdmin"', function () {
        var idAdmin = 'idAdmin';
        var publicPath = '/public';

        it('error unbinding the admin', function (done) {
            var implementations = {
                srem: function (hash, key, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.unbindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, '[ERROR] Error in database deleting the administrator.');
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.srem.getCall(0).args[1], idAdmin);
                    done();
                });
            });
        });

        it('correct unbinding', function (done) {
            var implementations = {
                srem: function (hash, key, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.unbindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.srem.callCount, 1);
                    assert.equal(spies.srem.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.srem.getCall(0).args[1], idAdmin);
                    done();
                });
            });
        });
    });

    describe('Function "getAdmins"', function () {
        var publicPath = '/public';
        var admins = ['admin1', 'admin2'];

        it('error getting the admins', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdmins(publicPath, function (err, admins) {
                    assert.equal(err, '[ERROR] Error in database getting the administrators.');
                    assert.equal(admins, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    done();
                });
            });
        });

        it('correct, return two admins', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, admins);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdmins(publicPath, function (err, result) {
                    assert.equal(err, null);
                    assert.deepEqual(result,[{idAdmin: admins[0]}, {idAdmin: admins[1]}]);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.each.callCount, 1);
                    assert.equal(spies.each.getCall(0).args[0], admins);
                    done();
                });
            });
        });
    });

    describe('FUnction "getAdminUrl"', function () {
        var idAdmin = 'idAdmin';
        var publicPath = '/public';
        var url = 'http://example.com/path';

        it('error getting the administrators', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, adminUrl) {
                    assert.equal(err, 'Error');
                    assert.equal(adminUrl, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    done();
                });
            });
        });

        it('error, not an admin', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, ['no_admin']);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, adminUrl) {
                    assert.equal(err, null);
                    assert.equal(adminUrl, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    done();
                });
            });
        });

        it('error, getting the url', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, [idAdmin, 'otherAdmin']);
                },
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, adminUrl) {
                    assert.equal(err, 'Error');
                    assert.equal(adminUrl, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], publicPath);
                    assert.equal(spies.hget.getCall(0).args[1], 'url');
                    done();
                });
            });
        });

        it('correct, should return the admin url', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, [idAdmin, 'otherAdmin']);
                },
                hget: function (hash, key, callback) {
                    return callback(null, url);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, adminUrl) {
                    assert.equal(err, null);
                    assert.equal(adminUrl, url);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], publicPath + 'admins');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0], publicPath);
                    assert.equal(spies.hget.getCall(0).args[1], 'url');
                    done();
                });
            });
        });
    });

    describe('Function "checkPath"', function (done) {
        var publicPath = '/public';
        var services = ['/public','/public2'];

        it('error getting the service', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath(publicPath, function (err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check, false);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    done();
                });
            });
        });

        it('invalid url', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, ['other_path']);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath(publicPath, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    done();
                });
            });
        });

        it('correct url', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, services);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath(publicPath, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, true);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], 'services');
                    done();
                });
            });
        });
    });

    describe('Function "newBuy"', function () {
        var buyInfo = {
            apiKey: 'apiKey',
            publicPath: '/public',
            orderId: 'orderId',
            productId: 'productId',
            customer: '0001',
            unit: 'call',
            recordType: 'callUsage'
        };
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
        };

        it('executing error', function (done) {
            var implementations = {
                sadd: function (list) {},
                hmset: function (hash, object) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.newBuy(buyInfo, function (err) {
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

        it('correct buy', function (done) {
            var implementations = {
                sadd: function (list) {},
                hmset: function (hash, object) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.newBuy(buyInfo, function (err) {
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

    describe('Function "getApiKeys"', function (done) {
        var keys = ['apiKey1', 'apiKey2'];

        it('error getting user api-keys', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
                    assert.equal(err, 'Error');
                    assert.equal(apiKeys, null);
                    assert.equal(spies.smembers.callCount, 1);
                    done();
                });
            });
        });

        it('no api-keys available', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
                    assert.equal(err, null);
                    assert.equal(apiKeys, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0], '0001');
                    done();
                });
            });
        });

        it('error getting accounting info', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, ['apiKey1']);
                },
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
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

        it('correct', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, keys);
                },
                hgetall: function (hash, callback) {
                    if(hash === keys[0]) {
                        return callback(null, {
                            apiKey: hash,
                            productId: 'productId1',
                            orderId: 'orderId1'
                        });
                    } else {
                        return callback(null, {
                            apiKey: hash,
                            productId: 'productId2',
                            orderId: 'orderId2',
                        });
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
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

    describe('Function "checkRequest"', function (done) {

        it('error getting accounting information', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', 'apiKey1', function (err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check, false);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });

        it('no info available', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, '0002');
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', 'apiKey1', function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, '0001');
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', 'apiKey1', function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, true);
                    assert.equal(spies.hget.callCount, 1);
                    done();
                });
            });
        });
    });

    describe('Function "getAccountingInfo"', function (done) {
        var apiKey = 'apiKey';
        var accountingInfo = {
            url: 'http://example.com/path',
            publicPath: '/public',
            unit: 'megabyte'
        }

        it('error getting the accounting info', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo(apiKey, function (err, accInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , apiKey);
                    done();
                });
            });
        });

        it('no accounting info available', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo(apiKey, function (err, accInfo) {
                    assert.equal(err, null);
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , apiKey);
                    done();
                });
            });
        });

        it('error getting the url', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, accountingInfo);
                },
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo(apiKey, function (err, accInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(accInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , apiKey);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , accountingInfo.publicPath);
                    assert.equal(spies.hget.getCall(0).args[1] , 'url');
                    done();
                });
            });
        });

        it('correct', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, accountingInfo);
                },
                hget: function (hash, key, callback) {
                    return callback(null, accountingInfo.url);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo(apiKey, function (err, accInfo) {
                    assert.equal(err, null);
                    assert.deepEqual(accInfo, {
                        unit: accountingInfo.unit,
                        url: accountingInfo.url
                    });
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0] , apiKey);
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , accountingInfo.publicPath);
                    assert.equal(spies.hget.getCall(0).args[1] , 'url');
                    done();
                });
            });
        });
    });

    describe('Function "getNotificationInfo"', function () {

        it('error getting apiKeys', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    done();
                });
            });
        });

        it('error getting accounting information', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, ['apiKey']);
                },
                hgetall: function (hash, callback) {
                    return callback('Error', null);25
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.smembers.callCount, 1);
                    assert.equal(spies.smembers.getCall(0).args[0] , 'apiKeys');
                    done();
                });
            });
        });

        it('no notification info available', function (done) {
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
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

        it('correct', function (done) {
            var notificationInfo1 = {
                apiKey: 'apiKey1',
                orderId: 'orderId',
                productId: 'productId',
                customer: '0001',
                value: 1.5,
                correlationNumber: 2,
                recordType: 'callUsage',
                unit: 'call'
            };
            var notificationInfo2 = {
                value: 0
            };
            var implementations = {
                smembers: function (hash, callback) {
                    return callback(null, ['apiKey1', 'apiKey2']);
                },
                hgetall: function (hash, callback) {
                    if (hash === 'apiKey1') {
                        return callback(null, notificationInfo1);
                    } else {
                        return callback(null, notificationInfo2);
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
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

    describe('Function "makeAccounting"', function () {

        it('amount less than 0', function (done) {
            mocker({}, function (db, spies) {
                db.makeAccounting('apikey', -1.3, function (err) {
                    assert.equal(err, '[ERROR] The aomunt must be greater than 0');
                    done();
                });
            });
        });

        it('error getting previous value', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.3, function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'value');
                    done();
                });
            });
        });

        it('error executing', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 1);
                },
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.3, function (err) {
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

        it('correct', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 1);
                },
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.3, function (err) {
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

    describe('Function "resetAccounting"', function () {

        it('error getting correlation number', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'apiKey');
                    assert.equal(spies.hget.getCall(0).args[1] , 'correlationNumber');
                    done();
                });
            });
        });

        it('error executing', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 0);
                },
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
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

        it('correct', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 0);
                },
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
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

    describe('Function "addCBSubscription"', function () {

        it('error executing', function (done) {
            var implementations = {
                sadd: function (list) {},
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addCBSubscription('apiKey', 'subsId', 'http://example.com/url', function (err) {
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

        it('correct', function (done) {
            var implementations = {
                sadd: function (list) {},
                hmset: function (hash, value) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addCBSubscription('apiKey', 'subsId', 'http://example.com/url', function (err) {
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

    describe('Function "getCBSubscription"', function () {

        it('error getting subscription info', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subsId', function (err, subsInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(subsInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    done();
                });
            });
        });

        it('no subscription info available', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subsId', function (err, subsInfo) {
                    assert.equal(err, null);
                    assert.equal(subsInfo, null);
                    assert.equal(spies.hgetall.callCount, 1);
                    assert.equal(spies.hgetall.getCall(0).args[0], 'subsId');
                    done();
                });
            });
        });

        it('error getting the unit', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, {
                        apiKey: 'apiKey',
                        notificationUrl: 'http://example.com/url'
                    });
                },
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subsId', function (err, subsInfo) {
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

        it('correct', function (done) {
            var implementations = {
                hgetall: function (hash, callback) {
                    return callback(null, {
                        apiKey: 'apiKey',
                        notificationUrl: 'http://example.com/url'
                    });
                },
                hget: function (hash, key, callback) {
                    return callback(null, 'call');
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subsId', function (err, subsInfo) {
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

    describe('Function "deleteCBSubscription"', function () {

        it('error getting the api-key', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteCBSubscription('subsId', function (err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.hget.callCount, 1);
                    assert.equal(spies.hget.getCall(0).args[0] , 'subsId');
                    assert.equal(spies.hget.getCall(0).args[1] , 'apiKey');
                    done();
                });
            });
        });

        it('error executing', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 'apiKey');
                },
                srem: function (key, value) {},
                del: function (hash) {},
                exec: function (callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteCBSubscription('subsId', function (err) {
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

        it('correct', function (done) {
            var implementations = {
                hget: function (hash, key, callback) {
                    return callback(null, 'apiKey');
                },
                srem: function (key, value) {},
                del: function (hash) {},
                exec: function (callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteCBSubscription('subsId', function (err) {
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