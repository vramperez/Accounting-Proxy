var proxyquire = require('proxyquire'),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async'),
    data = require('../data');

/**
 * Return an object database with the mocked dependencies and object with the neecessary spies specified in implementations.
 *
 * @param  {Object}   implementations Dependencies to mock and spy.
 */
var getDb = function (implementations) {

    implementations.select = function (db) {};

    var redis_stub = {
        createClient: function () {
            return implementations;
        }
    };

    var async_stub = {
        each: async.each,
        waterfall: async.waterfall,
        apply: async.apply,
        forEachOf: async.forEachOf
    };

    return proxyquire('../../db_Redis', {
        redis: redis_stub,
        async: async_stub
    });
};

describe('Testing REDIS database', function () {

    var testGet = function (method, hash, key, param, error, result, expectedRes, done) {

        var hget = function (hash, key, callback) {
            return callback(error, result);
        };

        var implementations = {
            hget: hget
        };

        var hgetSpy = sinon.spy(implementations, 'hget');

        var db = getDb(implementations);

        db[method](param, function (err, res) {

            assert(hgetSpy.calledWith(hash, key));
            assert.equal(err, error);
            assert.equal(res, expectedRes);

            done();
        });
    };

    describe('Function "init"', function () {

        it('should call the callback withour error when db initialization success', function (done) {
            
            var db = getDb({});

            db.init(function (err) {

                assert.equal(err, null);
                done();
            });
        });
    });

    describe('Function "addToken"', function () {

        var testAddToken = function (error, done) {

            var del = sinon.stub();
            var sadd = sinon.stub();
            var exec = function (callback) {
                return callback(error);
            };

            var implementations = {
                del: del,
                sadd: sadd,
                exec: exec
            };

            var multi = sinon.stub().returns(implementations);

            var execSpy = sinon.spy(implementations, 'exec');

            var db = getDb({multi: multi});

            db.addToken(data.DEFAULT_TOKEN, function (err) {

                assert(multi.calledOnce);
                assert(del.calledWith(data.DEFAULT_TOKEN));
                assert(sadd.calledWith(['token', data.DEFAULT_TOKEN]));
                assert(execSpy.calledOnce);

                if (error) {
                    assert.equal(err, 'Error adding the acces token "' + data.DEFAULT_TOKEN + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the token', function (done) {
            testAddToken(true, done);
        });

        it('should call the callback without error when db adds the new token', function (done) {
           testAddToken(false, done); 
        });
    });

    describe('Function "getToken"', function () {

        var testGetToken = function (error, tokens, done) {

            var smembers = function (hash, callback) {
                return callback(error, tokens);
            };

            var implementations = {
                smembers: smembers
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');

            var db = getDb(implementations);

            db.getToken(function (err, res) {

                assert(smembersSpy.calledWith('token'));

                if (error) {
                    assert.equal(err, 'Error getting the access token.');
                    assert.equal(res, null);
                } else {

                    assert.equal(err, null);

                    if (tokens.length === 0) {
                        assert.equal(res, null);
                    } else {
                        assert.equal(res, tokens[0]);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting token', function (done) {
            testGetToken(true, null, done);
        });

        it('should call the callback with error when there is not token', function (done) {
            testGetToken(false, [], done);
        });

        it('should call the callback without error when db gets the token', function (done) {
           testGetToken(false, [data.DEFAULT_TOKEN], done); 
        });
    });

    describe('Functoin "addSpecificationRef"', function () {
        
        var testAddSpecificationRef = function (error, done) {

            var hmset = function (hash, value, callback) {
                return callback(error);
            };

            var implementations = {
                hmset: hmset
            };

            var hmsetSpy = sinon.spy(implementations, 'hmset');

            var db = getDb(implementations);

            db.addSpecificationRef(data.DEFAULT_UNIT, data.DEFAULT_HREF, function (err) {

                var toAdd = {};
                toAdd[data.DEFAULT_UNIT.toString()] = data.DEFAULT_HREF;

                assert(hmsetSpy.calledWith('units', toAdd));

                if (error) {
                    assert.equal(err, 'Error adding the href specification: "' + data.DEFAULT_HREF + '" to unit "' + data.DEFAULT_UNIT + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the usage specification href', function (done) {
            testAddSpecificationRef(true, done);
        });

        it('should call the callback without error when db adds the usage specification href', function (done) {
            testAddSpecificationRef(false, done);
        });
    });

    describe('Function "getHref"', function () {

        var method = 'getHref';
        var hash = 'units';
        var key = data.DEFAULT_UNIT;

        it('should call the callback with error when db fails getting the href', function (done) {
            testGet(method, hash, key, key, 'Error getting the href for unit "' + key + '" .', null, null, done);
        });

        it('should call the callback without error when db gets the usage specification href', function (done) {
            testGet(method, hash, key, key, null, data.DEFAULT_HREF, data.DEFAULT_HREF, done); 
        });
    });

    describe('Function "newService"', function () {

        var testNewService = function (error, done) {

            var isCBService = true;
            var url = data.DEFAULT_URLS[0];
            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
            var appId = data.DEFAULT_APP_IDS[0];
            var httpMethods = data.DEFAULT_HTTP_METHODS_LIST;

            var sadd = sinon.stub();
            var hmset = sinon.stub();
            var exec = function (callback) {
                return callback(error);
            };

            var implementations = {
                sadd: sadd,
                hmset: hmset,
                exec: exec
            };

            var multi = sinon.stub().returns(implementations);
            var execSpy = sinon.spy(implementations, 'exec');

            var db = getDb({multi: multi});

            db.newService(publicPath, url, appId, isCBService, httpMethods, function (err) {

                assert(multi.calledOnce);
                assert(sadd.calledWith(['services', publicPath]));
                assert(hmset.calledWith(publicPath, {
                    url: url,
                    appId: appId,
                    isCBService: isCBService ? 1 : 0,
                    methods: data.DEFAULT_HTTP_METHODS_STRING
                }));
                assert(execSpy.calledOnce);

                if (error) {
                    assert.equal(err, 'Error in database adding the new service.');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails executing the statements', function (done) {
            testNewService(true, done);
        });

        it('should call the callback without error when db adds the new service', function (done) {
            testNewService(false, done);
        });
    });

    describe('Function "deleteService"', function () {

        var testDeleteService = function(getApiKeysErr, getSubscriptionsErr, hgetErr, subscriptions, execErr, done) {

            var errMsg = 'Error in database deleting the service.';

            var srem = sinon.stub();
            var del = sinon.stub();
            var exec = function (callback) {
                return callback(execErr);
            };

            var multiImplementations = {
                srem: srem,
                del: del,
                exec: exec
            };

            var smembers = function (hash, callback) {
                if (hash === data.DEFAULT_PUBLIC_PATHS[0] + 'apiKeys') {
                    return callback(getApiKeysErr, [data.DEFAULT_API_KEYS[0]]);
                } else {
                    return callback(getSubscriptionsErr, subscriptions);
                }
            };

            var hget = function (hash, key, callback) {
                return callback(hgetErr, data.DEFAULT_USER_ID);
            };

            var multi = sinon.stub().returns(multiImplementations);

            var implementations = {
                multi: multi,
                smembers: smembers,
                hget: hget
            };

            var execSpy = sinon.spy(multiImplementations, 'exec');
            var smembersSpy = sinon.spy(implementations, 'smembers');
            var hgetSpy = sinon.spy(implementations, 'hget');

            var db = getDb(implementations);

            db.deleteService(data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(multi.calledOnce);
                assert(srem.calledWith('services', data.DEFAULT_PUBLIC_PATHS[0]));
                assert(del.calledWith(data.DEFAULT_PUBLIC_PATHS[0]));
                assert(del.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'apiKeys'));
                assert(del.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'admins'));
                assert(smembersSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'apiKeys'));

                if (getApiKeysErr) {
                    assert.equal(err, errMsg);
                } else {

                    assert(smembersSpy.calledWith(data.DEFAULT_API_KEYS[0] + 'subs'));

                    if (getSubscriptionsErr) {

                        assert.equal(err, errMsg);

                    } else {

                        if (hgetErr) {

                            assert.equal(err, errMsg);

                        } else {

                            assert(hgetSpy.calledWith(subscriptions[0], 'customer'));
                            assert(srem.calledWith(data.DEFAULT_USER_ID, subscriptions[0]));
                            assert(del.calledWith(subscriptions[0]));
                            assert(del.calledWith(subscriptions[0] + 'subs'));
                            assert(srem.calledWith('apiKeys', subscriptions[0]));

                            execErr ? assert.equal(err, errMsg) : assert.equal(err, null);
                        }
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the API keys', function (done) {
            testDeleteService(true, false, false, null, false, done);
        });

        it('should call the callback with error when db fails getting subscriptions', function (done) {
            testDeleteService(false, true, false, null, false, done);
        });

        it('should call the callback with error when db fails getting the customer', function (done) {
           testDeleteService(false, false, true, null, false, done);
        });

        it('should call the callback with error when db fails executing the query', function (done) {
           testDeleteService(false, false, false, [data.DEFAULT_API_KEYS[0]], true, done);
        });

        it('should call the callback without error when db deletes the service', function (done) {
            testDeleteService(false, false, false, [data.DEFAULT_API_KEYS[0]], false, done);
        });
    });

    describe('Function "getService"', function () {

        var testGetService = function (error, service, result, done) {

            var hgetall = function (hash, callback) {
                return callback(error, service);
            };

            var implementations = {
                hgetall: hgetall
            };

            var hgetallSpy = sinon.spy(implementations, 'hgetall');

            var db = getDb(implementations);

            db.getService(data.DEFAULT_PUBLIC_PATHS[0], function (err, res) {

                assert(hgetallSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0]));
                assert.equal(err, error);
                assert.deepEqual(res, result);

                done();
            });
        };

        it('should call the callback with error when db fails executing the statements', function (done) {
            var errorMsg = 'Error in database getting the service.';

            testGetService(errorMsg, null, null, done);
        });

        it('should call the callback without error when there is no service', function (done) {
            testGetService(null, null, null, done);
        });

        it('should call the callback without error when db gets the service', function (done) {
            var service = {isCBService: '0', methods: data.DEFAULT_HTTP_METHODS_STRING};
            var result = JSON.parse(JSON.stringify(service));
            result.isCBService = parseInt(result.isCBService);
            result.methods = result.methods.split(',');

            testGetService(null, service, result, done);
        });
    });

    describe('Function "getAllServices"', function () {

        var testGetAllServices = function (smembersErr, hgetallErr, services, result, done) {

            var errMsg = 'Error in database getting the services.';
            var hgetallFirstCall = true;

            var smembers = function (hash, callback) {
                return callback(smembersErr, data.DEFAULT_PUBLIC_PATHS);
            };

            var hgetall = function (hash, callback) {

                if (hgetallFirstCall) {
                    hgetallFirstCall = false;
                    return callback(hgetallErr, services[0]);
                } else {
                    return callback(hgetallErr, services[1]);
                }
            };

            var implementations = {
                smembers: smembers,
                hgetall: hgetall
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');
            var hgetallSpy = sinon.spy(implementations, 'hgetall');

            var db = getDb(implementations);

            db.getAllServices(function (err, res) {

                assert(smembersSpy.calledWith('services'));

                if (smembersErr) {

                    assert.equal(err, errMsg);
                    assert.equal(res, result);

                } else if (hgetallErr) {

                    assert(hgetallSpy.calledOnce);
                    assert(hgetallSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0]));
                    assert.equal(err, errMsg);
                    assert.deepEqual(res, result);

                } else {

                    assert(hgetallSpy.calledTwice);
                    assert(hgetallSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0]));
                    assert(hgetallSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[1]));
                    assert.equal(err, null);
                    assert.deepEqual(res, result);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the all the services', function (done) {
            testGetAllServices(true, false, null, null, done);
        });

        it('should call the callback with error when db fails getting the information of each service', function (done) {
            var services = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING));

            testGetAllServices(false, true, services, null, done);
        });

        it('should call the callback without error when db returns all services', function (done) {
            var services = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING));
            var result = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_LIST));


            testGetAllServices(false, false, services, result, done);
        });
    });

    describe('Function "isCBService"', function () {

        var method = 'isCBService';
        var hash = data.DEFAULT_PUBLIC_PATHS[0];
        var key = 'isCBService';

        it('should call the callback with error when db fails getting the service type', function (done) {
            testGet(method, hash, key, hash, 'Error in database gettings the service type.', null, null, done);
        });

        it('should call the callback without error and return true if the service is a Context Broker service', function (done) {
            testGet(method, hash, key, hash, null, '1', true, done);
        });

        it('should call the callback without error and return false if the service is not a Context Broker service', function (done) {
            testGet(method, hash, key, hash, null, '0', false, done);
        });
    });

    describe('Function "getAppId"', function () {

        var method = 'getAppId';
        var hash = data.DEFAULT_PUBLIC_PATHS[0];
        var key = 'appId';

        it('should call the callback with error when db fails getting the appId', function (done) {
            testGet(method, hash, key, hash, 'Error in database getting the appId.', null, null, done);
        });

        it('should call the callback without error when db returns the appId', function (done) {
            testGet(method, hash, key, hash, null, null, null, done);
        });
    });

    describe('Function "addAdmin"', function () {

        var testAddAdmin = function (error, done) {

            var sadd = function (list, callback) {
                return callback(error);
            };

            var implementations = {
                sadd: sadd
            };

            var saddSpy = sinon.spy(implementations, 'sadd');

            var db = getDb(implementations);

            db.addAdmin(data.DEFAULT_ID_ADMIN, function (err) {

                assert(saddSpy.calledWith(['admins', data.DEFAULT_ID_ADMIN]));

                if (error) {
                    assert.equal(err, 'Error in database adding admin: "' + data.DEFAULT_ID_ADMIN + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the admin', function (done) {
            testAddAdmin(true, done);
        });

        it('should call the callback without error when db adds the new administrator', function (done) {
            testAddAdmin(false, done);
        });
    });

    describe('Function "deleteAdmin"', function () {

        var testDeleteAdmin = function (smembersErr, sremErr1, sremErr2, done) {

            var sremCall = 0;
            var hgetallCall = 0;
            var errMsg = 'Error in database removing admin: "' + data.DEFAULT_ID_ADMIN + '" .';
            var services = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING));

            var smembers = function (hash, callback) {
                return callback(smembersErr, data.DEFAULT_PUBLIC_PATHS);
            };

            var hgetall = function (hash, callback) {
                callback(null, services[hgetallCall]);
                hgetallCall = hgetallCall + 1; 
                return;
            };

            var srem = function (hash, key, callback) {

                var err;

                if (sremCall == 0 || sremCall == 1)  {
                    err = sremErr1;
                } else {
                    err = sremErr2;
                }

                sremCall = sremCall + 1;

                return callback(err);
            };

            var implementations = {
                hgetall: hgetall,
                smembers: smembers,
                srem: srem
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');
            var sremSpy = sinon.spy(implementations, 'srem');

            var db = getDb(implementations);

            db.deleteAdmin(data.DEFAULT_ID_ADMIN, function (err, res) {

                assert(smembersSpy.calledWith('services'));

                if (smembersErr) {
                    assert.equal(err, errMsg);
                } else {
                    assert(sremSpy.calledWith(services[0].publicPath + 'admins'));

                    if (sremErr1) { 
                        assert.equal(err, errMsg);
                    } else {
                        assert(sremSpy.calledWith('admins', data.DEFAULT_ID_ADMIN));

                        if (sremErr2) {
                            assert.equal(err, errMsg);
                        } else {
                            assert.equal(err, null);
                        }
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting all services', function (done) {
            testDeleteAdmin(true, false, false, done);
        });

        it('should call the callback with error when db fails removing services', function (done) {
            testDeleteAdmin(false, true, false, done); 
        });

        it('should call the callback with error when db fails removing administrators', function (done) {
            testDeleteAdmin(false, false, true, done);
        });

        it('should call the callback without error when db deletes the admin', function (done) {
            testDeleteAdmin(false, false, false, done);
        });
    });

    describe('Function "bindAdmin"', function () {

        var testBindAdmin = function (hgetallErr, service, smembersErr, admins, saddErr, done) {

            var hgetall = function (hash, callback) {
                return callback(hgetallErr, service);
            };

            var smembers = function (hash, callback) {
                return callback(smembersErr, admins);
            };

            var sadd = function (hash, value, callback) {
                return callback(saddErr);
            };

            var implementations = {
                hgetall: hgetall,
                smembers: smembers,
                sadd: sadd
            };

            var hgetallSpy = sinon.spy(implementations, 'hgetall');
            var smembersSpy = sinon.spy(implementations, 'smembers');
            var saddSpy = sinon.spy(implementations, 'sadd');

            var db = getDb(implementations);

            db.bindAdmin(data.DEFAULT_ID_ADMIN, data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(hgetallSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0]));

                if (hgetallErr) {
                    assert.equal(err, 'Error in database binding the admin to the service.');
                } else if (!service) {
                    assert.equal(err, 'Invalid public path.');
                } else {
                    assert(smembersSpy.calledWith('admins'));

                    if (smembersErr) {
                        assert.equal(err, 'Error in database binding the admin to the service.');
                    } else if (admins.indexOf(data.DEFAULT_ID_ADMIN) === -1) {
                        assert.equal(err, 'Admin: "' + data.DEFAULT_ID_ADMIN + '" not exists. Admin must be added before binding it.');
                    } else {
                        assert(saddSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'admins'));

                        if (saddErr) {
                            assert.equal(err, 'Error in database binding the admin to the service.');
                        } else {
                            assert.equal(null);
                        }
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the service', function (done) {
            testBindAdmin(true, null, false, null, false, done);
        });

        it('should call the callback with error when the public path is invalid', function (done) {
            testBindAdmin(false, null, false, null, false, done);
        });

        it('should call the callback with error when db fails getting admins', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));

            testBindAdmin(false, service, true, {}, false, done);
        });

        it('should call the callback with error when the admin does not exists', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));

            testBindAdmin(false, service, false, [], false, done);
        });

        it('should call the callback with error when db fails adding the administrator', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));

            testBindAdmin(false, service, false, [data.DEFAULT_ID_ADMIN], true, done);
        });

        it('should call the callback with error when db binds the administrator', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));

            testBindAdmin(false, service, false, [data.DEFAULT_ID_ADMIN], false, done);
        });
    });

    describe('Function "unbindAdmin"', function () {

        var testUnbindAdmin = function (error, done) {

            var srem = function (hash, key, callback) {
                return callback(error);
            };

            var implementations = {
                srem: srem
            };

            var sremSpy = sinon.spy(implementations, 'srem');

            var db = getDb(implementations);

            db.unbindAdmin(data.DEFAULT_ID_ADMIN, data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(sremSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'admins', data.DEFAULT_ID_ADMIN));

                if (error) {
                    assert.equal(err, 'Error in database unbinding the administrator "' + data.DEFAULT_ID_ADMIN + '".');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails unbinding the admin', function (done) {
            testUnbindAdmin(true, done);
        });

        it('should call the callback without error when db unbinds the admin', function (done) {
            testUnbindAdmin(false, done);
        });
    });

    describe('Function "getAdmins"', function () {

        var testGetAdmins = function (error, admins, done) {

            var smembers = function (hash, callback) {
                return callback(error, admins);
            };

            var implementations = {
                smembers: smembers
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');

            var db = getDb(implementations);

            db.getAdmins(data.DEFAULT_PUBLIC_PATHS[0], function (err, res) {

                assert(smembersSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0] + 'admins'));

                if (error) {
                    assert.equal(err, 'Error in database getting the administrators.');
                    assert.equal(res, null);
                } else {
                    assert.equal(err, null);
                    assert.deepEqual(res, admins);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the admins', function (done) {
            testGetAdmins(true, null, done);
        });

        it('should call the callback without error when db returns all admins', function (done) {
            testGetAdmins(false, ['admin1', 'admin2'], done);
        });
    });

    describe('FUnction "getAdminURL"', function () {

        var testGetAdminUrl = function (smembersErr, admins, hgetErr, method, service, result, done) {

            var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
            var adminId = data.DEFAULT_ID_ADMIN;
            var url = data.DEFAULT_URLS[0];

            var errMsg = smembersErr || hgetErr;

            var smembers = function (hash, callback) {
                return callback(smembersErr, admins);
            };

            var hgetall = function (hash, callback) {
                return callback(hgetErr, service);
            };

            var implementations = {
                smembers: smembers,
                hgetall: hgetall
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');
            var hgetSpy = sinon.spy(implementations, 'hgetall');

            var db = getDb(implementations);

            db.getAdminURL(adminId, publicPath, method, function (err, res) {

                assert(smembersSpy.calledWith(publicPath + 'admins'));

                assert.equal(err, errMsg);
                assert.deepEqual(res, result);

                done();
            });
        };

        it('should call the callback with error when db fails getting the administrators', function (done) {
            testGetAdminUrl('Error getting the admin url.', null, null, null, null, null, done);
        });

        it('should call the callback with error when admin id is not valid', function (done) {
            var result = {isAdmin: false, errorCode: 'admin', url: null};

            testGetAdminUrl(null, [], null, null, null, result, done);
        });

        it('should call the callback with error when db fails getting the service', function (done) {
            testGetAdminUrl(null, [data.DEFAULT_ID_ADMIN], 'Error getting the admin url.', null, null, null, done);
        });

        it('should call the callback with error when the method is not a valid method', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));
            var result = {isAdmin: true, errorCode: 'method', url: null, errorMsg: 'Valid methods are: ' + service.methods};
            var method = 'WRONG';

            testGetAdminUrl(null, [data.DEFAULT_ID_ADMIN], null, method, service, result, done);
        });

        it('should return the admin URL when the admin id is correct', function (done) {
            var service = JSON.parse(JSON.stringify(data.DEFAULT_SERVICES_STRING[0]));
            var result = {isAdmin: true, errorCode: 'ok', url: service.url};
            var method = data.DEFAULT_HTTP_METHODS_LIST[0];

            testGetAdminUrl(null, [data.DEFAULT_ID_ADMIN], null, method, service, result, done);
        });
    });

    describe('Function "checkPath"', function (done) {

        var testCheckPath = function (error, publicPaths, done) {

            var smembers = function (hash, callback) {
                return callback(error, publicPaths);
            };

            var implementations = {
                smembers: smembers
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');

            var db = getDb(implementations);

            db.checkPath(data.DEFAULT_PUBLIC_PATHS[0], function(err, res) {

                assert(smembersSpy.calledWith('services'));

                if (error) {

                    assert.equal(err, 'Error checking the path.');
                    assert.equal(res, false);

                } else if (publicPaths.indexOf(data.DEFAULT_PUBLIC_PATHS[0]) === -1) {

                    assert.equal(err, null);
                    assert.equal(res, false);

                } else {

                    assert.equal(err, null);
                    assert.equal(res, true);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the service', function (done) {
            testCheckPath(true, null, done);
        });

        it('should call the callback with error when the URL is invalid', function (done) {
            testCheckPath(false, [], done);
        });

        it('should call the callback without error when db checks the path', function (done) {
            testCheckPath(false, [data.DEFAULT_PUBLIC_PATHS[0]], done);
        });
    });

    describe('Function "newBuy"', function () {

        var hmsetArg = {
            publicPath: data.DEFAULT_BUY_INFORMATION.publicPath,
            orderId: data.DEFAULT_BUY_INFORMATION.orderId,
            productId: data.DEFAULT_BUY_INFORMATION.productId,
            customer: data.DEFAULT_BUY_INFORMATION.customer,
            unit: data.DEFAULT_BUY_INFORMATION.unit,
            value: 0,
            recordType: data.DEFAULT_BUY_INFORMATION.recordType,
            correlationNumber: 0
        };

        var testNewBuy = function (error, done) {

            var sadd = sinon.stub();
            var hmset = sinon.stub();

            var exec = function (callback) {
                return callback(error);
            };

            var implementations = {
                sadd: sadd,
                hmset: hmset,
                exec: exec
            };

            var execSpy = sinon.spy(implementations, 'exec');

            var multi = sinon.stub().returns(implementations);

            var db = getDb({multi: multi});

            db.newBuy(data.DEFAULT_BUY_INFORMATION, function (err) {

                assert(multi.calledOnce);
                assert(sadd.calledThrice);
                assert(sadd.calledWith(['apiKeys', data.DEFAULT_BUY_INFORMATION.apiKey]));
                assert(sadd.calledWith([data.DEFAULT_BUY_INFORMATION.publicPath, data.DEFAULT_BUY_INFORMATION.apiKey]));
                assert(sadd.calledWith([data.DEFAULT_BUY_INFORMATION.customer, data.DEFAULT_BUY_INFORMATION.apiKey]));
                assert(hmset.calledWith(data.DEFAULT_BUY_INFORMATION.apiKey, hmsetArg));
                assert(execSpy.calledOnce);

                if (error) {
                    assert.equal(err, 'Error in database adding the new buy.');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the new buy', function (done) {
            testNewBuy(true, done);
        });

        it('should call the callback without error when db adds the new service', function (done) {
            testNewBuy(false, done);
        });
    });

    describe('Function "getApiKeys"', function (done) {

        var apiKeysInfo = {};
        apiKeysInfo[data.DEFAULT_API_KEYS[0]] = {productId: data.DEFAULT_PRODUCT_IDS[0], orderId: data.DEFAULT_ORDER_IDS[0]};
        apiKeysInfo[data.DEFAULT_API_KEYS[1]] = {productId: data.DEFAULT_PRODUCT_IDS[1], orderId: data.DEFAULT_ORDER_IDS[1]};

        var testGetApiKeys = function (smembersErr, apiKeys, hgetallErr, resultExpected, done) {

            var smembers = function (hash, callback) {
                return callback(smembersErr, apiKeys);
            };

            var hgetall = function (hash, callback) {
                return callback(hgetallErr, apiKeysInfo[hash]);
            };

            var implementations = {
                smembers: smembers,
                hgetall: hgetall
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');
            var hgetallSpy = sinon.spy(implementations, 'hgetall');

            var db = getDb(implementations);

            db.getApiKeys(data.DEFAULT_USER_ID, function (err, res) {

                assert(smembersSpy.calledWith(data.DEFAULT_USER_ID));

                if (smembersErr) {

                    assert.equal(err, 'Error in databse getting api-keys.');
                    assert.equal(res, resultExpected);

                } else if (apiKeys.length === 0) {

                    assert.equal(err, null);
                    assert.deepEqual(res, resultExpected);

                } else {

                    assert(hgetallSpy.calledWith(apiKeys[0]));

                    if (hgetallErr) {

                        assert.equal(err, 'Error in databse getting api-keys.');
                        assert.equal(res, resultExpected);

                    } else {

                        assert(hgetallSpy.calledWith(apiKeys[1]));
                        assert.equal(err, null);
                        assert.deepEqual(res, resultExpected);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting user API keys', function (done) {
            testGetApiKeys(true, null, false, null, done);
        });

        it('should call the callback without error when there are not API keys', function (done) {
           testGetApiKeys(false, [], false, [], done); 
        });

        it('should call the callback with error when db fails getting accounting info', function (done) {
            testGetApiKeys(false, data.DEFAULT_API_KEYS, true, null, done);
        });

        it('should call the callback without error when db gets the API keys', function (done) {
            var resultExpected = [{
                apiKey : data.DEFAULT_API_KEYS[0],
                productId: data.DEFAULT_PRODUCT_IDS[0],
                orderId: data.DEFAULT_ORDER_IDS[0],
            }, {
                apiKey : data.DEFAULT_API_KEYS[1],
                productId: data.DEFAULT_PRODUCT_IDS[1],
                orderId: data.DEFAULT_ORDER_IDS[1],
            }];

           testGetApiKeys(false, data.DEFAULT_API_KEYS, false, resultExpected, done); 
        });
    });

    describe('Function "checkRequest"', function (done) {

        var userId = data.DEFAULT_USER_ID;
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];

        var testCheckRequest = function (hgetallErr, hgetErr, accountingInfo, method, result, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var errorMsg = hgetallErr || hgetErr ? 'Error in database checking the request.' : null;

            var hgetall = function (hash, callback) {
                return callback(hgetallErr, accountingInfo);
            };

            var hget = function (hash, key, callback) {
                var methods = hgetErr ? null : data.DEFAULT_HTTP_METHODS_STRING;
                return callback(hgetErr, methods);
            };

            var implementations = {
                hgetall: hgetall,
                hget: hget
            };

            var hgetallSpy = sinon.spy(implementations, 'hgetall');
            var hgetSpy = sinon.spy(implementations, 'hget');

            var db = getDb(implementations);

            db.checkRequest(userId, apiKey, publicPath, method, function (err, res) {

                assert(hgetallSpy.calledWith(apiKey));

                if (!hgetallErr && (accountingInfo && accountingInfo.customer === userId && accountingInfo.publicPath === publicPath)) {
                    assert(hgetSpy.calledWith(publicPath, 'methods'));
                }

                assert.equal(err, errorMsg);
                assert.deepEqual(res, result);

                done();
            });
        };

        it('should call the callback with error when db fails getting accounting information', function (done) {
            testCheckRequest(true, false, null, null, null, done);
        });

        it('should call the callback with error when there is not accounting information for the request', function (done) {
            var result = {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Invalid API key'};

            testCheckRequest(false, false, null, null, result, done);
        });

        it('should call the callback with error when the customer is not correct', function (done) {
            var accountingInfo = { customer: 'wrong', publicPath: publicPath};
            var result = {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Invalid API key'};

            testCheckRequest(false, false, null, null, result, done);
        });

        it('should call the callback with error when db fails getting the service http methods', function (done) {
            var accountingInfo = { customer: userId, publicPath: publicPath};

            testCheckRequest(false, true, accountingInfo, null, null, done);
        });

        it('should call the callback with error  when the method is not a valid method', function (done) {
            var accountingInfo = { customer: userId, publicPath: publicPath};
            var result = {isCorrect: false, errorCode: 'method', errorMsg: 'Valid methods are: ' + data.DEFAULT_HTTP_METHODS_STRING};

            testCheckRequest(false, false, accountingInfo, 'WRONG', result, done);
        });

        it('should call the callback withput error when the request is valid', function (done) {
            var accountingInfo = { customer: userId, publicPath: publicPath};
            var result = {isCorrect: true};
            var method = data.DEFAULT_HTTP_METHODS_LIST[0];

            testCheckRequest(false, false, accountingInfo, method, result, done);
        });
    });

    describe('Function "getAccountingInfo"', function (done) {

        var accountingInfo = {
            url: data.DEFAULT_URLS[0],
            publicPath: data.DEFAULT_PUBLIC_PATHS[0],
            unit: data.DEFAULT_UNIT
        };

        var testGetAccountingInfo = function (hgetallErr, accountingInfo, hgetErr, done) {

            var hgetall = function (hash, callback) {
                return callback(hgetallErr, accountingInfo);
            };

            var hget = function (hash, key, callback) {
                return callback(hgetErr, data.DEFAULT_URLS[0]);
            };

            var implementations = {
                hgetall: hgetall,
                hget: hget
            };

            var hgetallSpy = sinon.spy(implementations, 'hgetall');
            var hgetSpy = sinon.spy(implementations, 'hget');

            var db = getDb(implementations);

            db.getAccountingInfo(data.DEFAULT_API_KEYS[0], function (err, res) {

                assert(hgetallSpy.calledWith(data.DEFAULT_API_KEYS[0]));

                if (hgetallErr) {

                    assert.equal(err, 'Error in database getting the accounting info.');
                    assert.equal(res, null);

                } else if (!accountingInfo) {

                    assert.equal(err, null);
                    assert.equal(res, null);

                } else {

                    assert(hgetSpy.calledWith(data.DEFAULT_PUBLIC_PATHS[0], 'url'));

                    if (hgetErr) {

                        assert.equal(err, 'Error in database getting the accounting info.');
                        assert.equal(res, null);

                    } else {

                        assert.equal(err, null);
                        assert.deepEqual(res, {
                            unit: data.DEFAULT_UNIT,
                            url: data.DEFAULT_URLS[0]
                        });
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the accounting info', function (done) {
            testGetAccountingInfo(true, null, false, done);
        });

        it('should call the callback without error when there is not accounting information', function (done) {
            testGetAccountingInfo(false, null, false, done);
        });

        it('should call the callback with error when db fails getting the url', function (done) {
            testGetAccountingInfo(false, accountingInfo, true, done);
        });

        it('should call the callback without error when db returns the accounting information', function (done) {
            testGetAccountingInfo(false, accountingInfo, false, done);
        });
    });

    describe('Function "getNotificationInfo"', function () {

        var testGetNotificatoinInfo = function (smembersErr, hgetallErr, accountingInfo, notificationInfo, done) {

            var smembers = function (hash, callback) {
                return callback(smembersErr, data.DEFAULT_API_KEYS);
            };

            var hgetall = function (hash, callback) {
                if (!accountingInfo) {
                    return callback(hgetallErr, null);    
                } else {
                    return callback(hgetallErr, accountingInfo[hash]);
                }
            };

            var implementations = {
                smembers: smembers,
                hgetall: hgetall
            };

            var smembersSpy = sinon.spy(implementations, 'smembers');
            var hgetallSpy = sinon.spy(implementations, 'hgetall');

            var db = getDb(implementations);

            db.getNotificationInfo(function (err, res) {

                assert(smembersSpy.calledWith('apiKeys'));

                if (smembersErr) {

                    assert.equal(err, 'Error in database getting the notification information.');
                    assert.equal(res, null);

                } else {

                    assert(hgetallSpy.calledWith(data.DEFAULT_API_KEYS[0]));

                    if (hgetallErr) {

                        assert.equal(err, 'Error in database getting the notification information.');
                        assert.equal(res, null);

                    } else {

                        assert(hgetallSpy.calledWith(data.DEFAULT_API_KEYS[1]));
                        assert.equal(err, null);
                        assert.deepEqual(res, notificationInfo);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting apiKeys', function (done) {
            testGetNotificatoinInfo(true, false, null, null, done);
        });

        it('should call the callback with error when db fails getting accounting information', function (done) {
            testGetNotificatoinInfo(false, true, null, null, done);
        });

        it('should call the callback without error when there is no accounting information to notify', function (done) {
            var accountingInfo = {};
            accountingInfo[data.DEFAULT_API_KEYS[0]] = {value: 0};
            accountingInfo[data.DEFAULT_API_KEYS[1]] = {value: 0};

            testGetNotificatoinInfo(false, false, accountingInfo, null, done);
        });

        it('should call the callback without error when db returns the accounting information to notify', function (done) {
            var accountingInfo = {};
            accountingInfo[data.DEFAULT_API_KEYS[0]] = {
                apiKey: data.DEFAULT_API_KEYS[0],
                value: 1.3,
                orderId: data.DEFAULT_ORDER_IDS[0],
                productId: data.DEFAULT_PRODUCT_IDS[0],
                customer: data.DEFAULT_USER_ID,
                correlationNumber: 0,
                recordType: data.DEFAULT_RECORD_TYPE,
                unit: data.DEFAULT_UNIT
            };
            accountingInfo[data.DEFAULT_API_KEYS[1]] = {
                apiKey: data.DEFAULT_API_KEYS[1],
                value: 1.3,
                orderId: data.DEFAULT_ORDER_IDS[1],
                productId: data.DEFAULT_PRODUCT_IDS[1],
                customer: data.DEFAULT_USER_ID,
                correlationNumber: 0,
                recordType: data.DEFAULT_RECORD_TYPE,
                unit: data.DEFAULT_UNIT
            };

            testGetNotificatoinInfo(false, false, accountingInfo, [accountingInfo[data.DEFAULT_API_KEYS[0]], accountingInfo[data.DEFAULT_API_KEYS[1]]], done);
        });
    });

    var testAccounting = function (amount, hgetErr, num, execErr, done) {

        var errMakeAccounting = 'Error making the accounting.';
        var errResetAccounting = 'Error reseting the accounting.';

        var hget = function (hash, key, callback) {
            return callback(hgetErr, num);
        };

        var hmset = sinon.stub();

        var exec = function (callback) {
            return callback(execErr);
        };

        var multiImplementations = {
            hmset: hmset,
            exec: exec
        };

        var multi = sinon.stub().returns(multiImplementations);

        var implementations = {
            multi: multi,
            hget: hget
        };

        var hgetSpy = sinon.spy(implementations, 'hget');
        var execSpy = sinon.spy(multiImplementations, 'exec');

        var db = getDb(implementations);

        if (amount) {

            db.makeAccounting(data.DEFAULT_API_KEYS[0], amount, function (err) {

                assert(multi.calledOnce);

                if (amount < 0) {

                    assert.equal(err, 'The aomunt must be greater than 0.');

                } else {

                    assert(hgetSpy.calledWith(data.DEFAULT_API_KEYS[0], 'value'));

                    if (hgetErr) {

                        assert.equal(err, errMakeAccounting);

                    } else {

                        assert(hmset.calledWith(data.DEFAULT_API_KEYS[0], {value: amount + num}));
                        assert(execSpy.calledOnce);

                        execErr ? assert.equal(err, errMakeAccounting) : assert.equal(err, null);
                    }
                }
            });

        } else {

            db.resetAccounting(data.DEFAULT_API_KEYS[0], function (err) {

                assert(multi.calledOnce);
                assert(hgetSpy.calledWith(data.DEFAULT_API_KEYS[0], 'correlationNumber'));

                if (hgetErr) {
                    assert.equal(err, errResetAccounting);
                } else {

                    assert(hmset.calledWith(data.DEFAULT_API_KEYS[0], {correlationNumber: num + 1, value: '0'}));
                    assert(execSpy.calledOnce);

                    execErr ? assert.equal(err, errResetAccounting) : assert.equal(err, null);
                }
            });
        }

        done();
    };

    describe('Function "makeAccounting"', function () {

        it('should call the callback with error when the amount is less than 0', function (done) {
            testAccounting(-1.3, false, null, false, done);
        });

        it('should call the callback with error when db fails getting previous value', function (done) {
            testAccounting(1.3, true, null, false, done);
        });

        it('should call the callback with error when db fails making the accounting', function (done) {
            testAccounting(1.3, false, 2, true, done);
        });

        it('should call the callback without error when db makes the accounting', function (done) {
            testAccounting(1.3, false, 2, false, done);
        });
    });

    describe('Function "resetAccounting"', function () {

        it('should call the callback with error when db fails getting correlation number', function (done) {
            testAccounting(null, true, null, false, done);
        });

        it('should call the callback with error when db fails reseting the accounting value', function (done) {
            testAccounting(null, false, 0, true, done);
        });

        it('should call the callback without error when db rests the accounting value', function (done) {
            testAccounting(null, false, 0, false, done);
        });
    });

    describe('Function "addCBSubscription"', function () {

        var testAddCBSubscription = function (error, done) {

            var sadd = sinon.stub();
            var hmset = sinon.stub();
            var exec = function (callback) {
                return callback(error);
            };

            var implementations = {
                sadd: sadd,
                hmset: hmset,
                exec: exec
            };

            var execSpy = sinon.spy(implementations, 'exec');

            var multi = sinon.stub().returns(implementations);

            var db = getDb({multi: multi});

            db.addCBSubscription(data.DEFAULT_API_KEYS[0], data.DEFAULT_SUBSCRIPTION_ID, data.DEFAULT_NOTIFICATION_URL, data.DEFAULT_EXPIRES, function (err) {

                assert(multi.calledOnce);
                assert(sadd.calledWith([data.DEFAULT_API_KEYS[0] + 'subs', data.DEFAULT_SUBSCRIPTION_ID]));
                assert(hmset.calledWith(data.DEFAULT_SUBSCRIPTION_ID, {
                    apiKey: data.DEFAULT_API_KEYS[0],
                    notificationUrl: data.DEFAULT_NOTIFICATION_URL,
                    expires: data.DEFAULT_EXPIRES
                }));
                assert(execSpy.calledOnce);

                error ? (err, 'Error in database adding the subscription "' + data.DEFAULT_SUBSCRIPTION_ID + '" .') : assert.equal(err, null);

                done();
            });
        };

        it('should call the callback with error when db fails adding a new CB subscription', function (done) {
            testAddCBSubscription(true, done);
        });

        it('should call the callback without error when db adds the new CB subscription', function (done) {
           testAddCBSubscription(false, done); 
        });
    });

    describe('Function "getCBSubscription"', function () {

        var subscriptionInfo = {
            apiKey: data.DEFAULT_API_KEYS[0],
            notificationUrl: data.DEFAULT_NOTIFICATION_URL,
            expires: data.DEFAULT_EXPIRES
        };

        var testGetCBSubscription = function (hgetallErr, subscriptionInfo, hgetErr, done) {

            var errMsg = 'Error getting the subscription.';

            var hgetall = function (hash, callback) {
                return callback(hgetallErr, subscriptionInfo);
            };

            var hget = function (hash, key, callback) {
                return callback(hgetErr, data.DEFAULT_UNIT);
            };

            var implementations = {
                hgetall: hgetall,
                hget: hget
            };

            var hgetallSpy = sinon.spy(implementations, 'hgetall');
            var hgetSpy = sinon.spy(implementations, 'hget');

            var db = getDb(implementations);

            db.getCBSubscription(data.DEFAULT_SUBSCRIPTION_ID, function (err, res) {

                assert(hgetallSpy.calledWith(data.DEFAULT_SUBSCRIPTION_ID));

                if (hgetallErr) {

                    assert.equal(err, 'Error getting the subscription.');
                    assert.equal(res, null);

                } else if (!subscriptionInfo) {

                    assert.equal(err, null);
                    assert.equal(res, null);

                } else {

                    assert(hgetSpy.calledWith(data.DEFAULT_API_KEYS[0], 'unit'));

                    if (hgetErr) {

                        assert.equal(err, errMsg);
                        assert.equal(res, null);

                    } else {

                        assert.equal(err, null);
                        assert.deepEqual(res, {
                            apiKey: subscriptionInfo.apiKey,
                            notificationUrl: subscriptionInfo.notificationUrl,
                            expires: subscriptionInfo.expires,
                            unit: data.DEFAULT_UNIT
                        });

                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting subscription info', function (done) {
            testGetCBSubscription(true, null, false, done);
        });

        it('should call the callback without error when there are not CB subscriptions', function (done) {
            testGetCBSubscription(false, null, false, done);
        });

        it('should call the callback with error when db fails getting the unit', function (done) {
            testGetCBSubscription(false, subscriptionInfo, true, done);
        });

        it('should call the callback without error when db returns the CB subscriptions', function (done) {
            testGetCBSubscription(false, subscriptionInfo, false, done);
        });
    });

    var testUpdateSubscription = function (method, hash, args, value, error, done) {

        var hmset = function (hash, object, callback) {
            return callback(error);
        };

        var implementations = {
            hmset: hmset
        };

        var hmsetSpy = sinon.spy(implementations, 'hmset');

        var db = getDb(implementations);

        var assertions = function (err) {

            assert(hmsetSpy.calledWith(hash, value));
            assert.equal(err, error);

            done();
        };

        var argsCopy = JSON.parse(JSON.stringify(args));
        argsCopy.push(assertions);

        db[method].apply(this, argsCopy);
    };

    describe('Function "updateNotificationUrl"', function () {

        var subsId = data.DEFAULT_SUBSCRIPTION_ID;
        var notificationUrl = data.DEFAULT_NOTIFICATION_URL;

        var method = 'updateNotificationUrl';
        var args = [subsId, notificationUrl];
        var value = {notificationUrl: notificationUrl};

        it('should call the callback with error when db fails updating the notification URL', function (done) {
            var errorMsg = 'Error in database updating the notificationURL';
            testUpdateSubscription(method, subsId, args, value, errorMsg, done);
        });

        it('should call the callback withou error when there is no error updating the notification URL', function (done) {
            testUpdateSubscription(method, subsId, args, value, null, done);
        });
    });

    describe('Function "updateExpirationDate"', function () {

        var subsId = data.DEFAULT_SUBSCRIPTION_ID;
        var expires = data.DEFAULT_EXPIRES;

        var method = 'updateExpirationDate';
        var args = [subsId, expires];
        var value = {expires: expires};

        it('should call the callback with error when db fails updating the expiration date', function (done) {
            var errorMsg = 'Error in database updating the expiration date';

            testUpdateSubscription(method, subsId, args, value, errorMsg, done);
        });

        it('should call the callback without error when there is no error updating the expiration date', function (done) {
            testUpdateSubscription(method, subsId, args, value, null, done);
        });
    });

    describe('Function "deleteCBSubscription"', function () {

        var testDeleteCBSubscription = function (hgetErr, execErr, done) {

            var errMsg = 'Error deleting the subscription "' + data.DEFAULT_SUBSCRIPTION_ID + '" .';

            var hget = function (hash, key, callback) {
                return callback(hgetErr, data.DEFAULT_API_KEYS[0]);
            };

            var srem = sinon.stub();
            var del = sinon.stub();
            var exec = function (callback) {
                return callback(execErr);
            };

            var multiImplementations = {
                srem: srem,
                del: del,
                exec: exec
            };

            var multi = sinon.stub().returns(multiImplementations);

            var implementations = {
                multi: multi,
                hget: hget
            };

            var execSpy = sinon.spy(multiImplementations, 'exec');
            var hgetSpy = sinon.spy(implementations, 'hget');

            var db = getDb(implementations);

            db.deleteCBSubscription(data.DEFAULT_SUBSCRIPTION_ID, function (err) {

                assert(multi.calledOnce);
                assert(hgetSpy.calledWith(data.DEFAULT_SUBSCRIPTION_ID, 'apiKey'));

                if (hgetErr) {

                    assert.equal(err, errMsg);

                } else {

                    assert(srem.calledWith(data.DEFAULT_API_KEYS[0] + 'subs', data.DEFAULT_SUBSCRIPTION_ID));
                    assert(del.calledWith(data.DEFAULT_SUBSCRIPTION_ID));
                    assert(execSpy.calledOnce);

                    execErr ? assert.equal(err, errMsg) : assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the api-key', function (done) {
            testDeleteCBSubscription(true, false, done);
        });

        it('should call the callback with error when db fails deleting the CB subscription', function (done) {
            testDeleteCBSubscription(false, true, done);
        });

        it('should call the callback without error when db deletes the CB subscription', function (done) {
            testDeleteCBSubscription(false, false, done);
        });
    });
});