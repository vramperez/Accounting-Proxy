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

    var sqlite_stub = {
        verbose: function () {
            return this;
        },
        Database: function (name, options) {}
    };
    var transaction_stub = {
        TransactionDatabase: function (batabase) {
            return implementations;
        }
    };

    var db =  proxyquire('../../db', {
        sqlite3: sqlite_stub,
        'sqlite3-transactions': transaction_stub
    });

    return db;
};

describe('Testing SQLITE database', function () {

    describe('Function "init"', function () {
        var sentences = [
            'PRAGMA encoding = "UTF-8";',
            'PRAGMA foreign_keys = 1;',
            'CREATE TABLE IF NOT EXISTS token ( \
                    token               TEXT, \
                    PRIMARY KEY (token)             )',
            'CREATE TABLE IF NOT EXISTS units ( \
                    unit                TEXT, \
                    href                TEXT, \
                    PRIMARY KEY (unit)             )',
            'CREATE TABLE IF NOT EXISTS services ( \
                    publicPath          TEXT, \
                    url                 TEXT, \
                    appId               TEXT, \
                    PRIMARY KEY (publicPath)             )',
            'CREATE TABLE IF NOT EXISTS accounting ( \
                    apiKey              TEXT, \
                    publicPath          TEXT, \
                    orderId             TEXT, \
                    productId           TEXT, \
                    customer            TEXT, \
                    unit                TEXT, \
                    value               INT, \
                    recordType          TEXT, \
                    correlationNumber   TEXT, \
                    PRIMARY KEY (apiKey), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE            )',
            'CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) ON DELETE CASCADE            )',
            'CREATE TABLE IF NOT EXISTS admins ( \
                    idAdmin             TEXT, \
                    PRIMARY KEY (idAdmin)            )',
            'CREATE TABLE IF NOT EXISTS administer ( \
                    idAdmin             TEXT, \
                    publicPath          TEXT, \
                    PRIMARY KEY (idAdmin, publicPath), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE, \
                    FOREIGN KEY (idAdmin) REFERENCES admins (idAdmin) ON DELETE CASCADE            )'
        ];

        it('correct initialization', function (done) {

            var implementations = {
                run: function (sentence, callback) {
                    return callback(null);
                }
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.init(function (err) {

                assert.equal(err, null);
                assert.equal(runSpy.callCount, 9);

                async.forEachOf(runSpy.args, function (call, i, task_callback) {
                    assert.equal(call[0], sentences[i]);
                    task_callback();
                }, done);
            });
        });
    });

    describe('Function "addToken"', function () {

        var sentences = ['DELETE FROM token', 'INSERT INTO token                 VALUES ($token)'];
        var params = {'$token': data.DEFAULT_TOKEN};

        var testAddToken = function (params, runRes1, runRes2, errMsg, done) {

            var run = function (sentence, params, callback) {
                if (sentence === sentences[0]) {
                    return params(runRes1);
                } else {
                    return callback(runRes2);
                }
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.addToken(data.DEFAULT_TOKEN, function (err) {

                assert.equal(err, errMsg);

                if (params) {
                    assert.equal(runSpy.getCall(0).args[0], sentences[0]);
                    assert.equal(runSpy.getCall(1).args[0], sentences[1]);
                    assert.deepEqual(runSpy.getCall(1).args[1], params);
                } else {
                    assert(runSpy.calledWith(sentences[0]));
                }

                done();
            });
        };

        it('should call the callback with error when db fails deleting the previous token', function (done) {
            testAddToken(null, 'Error', null, 'Error adding the acces token "' + data.DEFAULT_TOKEN + '" .', done);
        });

        it('should call the callback with error when db fails inserting the new token', function (done) {
            testAddToken(params, null, 'Error', 'Error adding the acces token "' + data.DEFAULT_TOKEN + '" .', done);
        });

        it('should call the callback without error when db add the token', function (done) {
            testAddToken(params, null, null, null, done);
        });
    });

    describe('Function "getToken"', function () {

        var sentence = 'SELECT *             FROM token';

        var testGetToken = function (error, token, done) {

            var get = function (sentence, callback) {
                return callback(error, token);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.stub(implementations, 'get', get);

            var db = getDb(implementations);

            db.getToken(function (err, resToken) {

                assert(getSpy.calledOnce);

                if (error) {
                    assert.equal(err, 'Error getting the access token.');
                    assert.equal(resToken, null);
                } else {

                    assert.equal(err, error);

                    if (!token) {
                        assert.equal(resToken, token);
                    } else {
                        assert.equal(resToken, token.token);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the token', function (done) {
            testGetToken('Error', null, done);
        });

        it('should call the callback without error when there is not available token', function (done) {
            testGetToken(null, undefined, done);
        });

        it('should call the callback without error when db returns the token', function (done) {
            testGetToken(null, {token: data.DEFAULT_TOKEN}, done);
        });
    });

    describe('Function "addSpecificationRef"', function() {

        var sentence = 'INSERT OR REPLACE INTO units             VALUES ($unit, $href)';
        var params = { '$unit': data.DEFAULT_UNIT, '$href': data.DEFAULT_HREF};

        var testAddSpecificationRef = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.stub(implementations, 'run', run);

            var db = getDb(implementations);

            db.addSpecificationRef(data.DEFAULT_UNIT, data.DEFAULT_HREF, function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error adding the href specification: "' + data.DEFAULT_HREF + '" to unit "' + data.DEFAULT_UNIT + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the specification reference', function (done) {
            testAddSpecificationRef('Error', done);
        });

        it('should call the callback without error when db adds the specification', function (done) {
            testAddSpecificationRef(null, done);
        });
    });

    describe('Function "getHref"', function () {

        var sentence = 'SELECT href             FROM units             WHERE $unit=unit';
        var params = {'$unit': data.DEFAULT_UNIT};

        var testGetHref = function (error, href, done) {

            var get = function (sentence, params, callback) {
                return callback(error, href);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.stub(implementations, 'get', get);

            var db = getDb(implementations);

            db.getHref(data.DEFAULT_UNIT, function (err, hrefRes) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error getting the href for unit "' + data.DEFAULT_UNIT + '" .');
                    assert.equal(hrefRes, null);
                } else {

                    assert.equal(err, null);

                    if (href === undefined) {
                        assert.equal(hrefRes, null);
                    } else {
                        assert.equal(hrefRes, href.href);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the href', function (done) {
            testGetHref('Error', null, done);
        });

        it('should call the callback without error when there is not an href', function (done) {
           testGetHref(null, undefined, done); 
        });

        it('should call the callback without error when db returns the href', function (done) {
            testGetHref(null, data.DEFAULT_HREF, done);
        });
    });

    describe('Function "newService"', function () {

        var sentence = 'INSERT OR REPLACE INTO services             VALUES ($path, $url, $appId)';
        var params = {
            '$path': data.DEFAULT_PUBLIC_PATHS[0],
            '$url': data.DEFAULT_URLS[0],
            '$appId': data.DEFAULT_APP_IDS[0]
        }

        var testNewService = function (error, done) {

            var run = function (snetence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.newService(data.DEFAULT_PUBLIC_PATHS[0], data.DEFAULT_URLS[0], data.DEFAULT_APP_IDS[0], function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database adding the new service.');
                } else {
                    assert.equal(err, null);
                }
                
                done();
            });
        };

        it('should call the callback with error when db fails adding the new service', function (done) {
            testNewService('Error', done);
        });

        it('should call the callback without error when db adds the new service', function (done) {
            testNewService(null, done);
        });
    });

    describe('Function "deleteService"', function () {

        var sentence = 'DELETE FROM services             WHERE publicPath=$path';
        var params = {
            '$path': data.DEFAULT_PUBLIC_PATHS[0]
        };

        var testDeleteService = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.deleteService(data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database deleting the service.');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails deleting the service', function (done) {
            testDeleteService('Error', done);
        });

        it('should call the callback without error when db fails', function (done) {
            testDeleteService(null, done);
        });
    });

    describe('Function "getService"', function () {

        var sentence = 'SELECT url, appId \
            FROM services \
            WHERE publicPath=$path';
        var params = {'$path': data.DEFAULT_PUBLIC_PATHS[0]};

        var testGetServie = function (error, service, done) {

            var get = function (sentence, params, callback) {
                return callback(error, service)
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.getService(data.DEFAULT_PUBLIC_PATHS[0], function (err, resService) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {

                    assert.equal(err, 'Error in database getting the service.');
                    assert.equal(service, null);

                } else {

                    assert.equal(err, null);

                    if (!service) {
                        assert.equal(resService, null);
                    } else {
                        assert.deepEqual(resService, service);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the service', function (done) {
            testGetServie('Error', null, done);
        });

        it('should call the callback with error when there is not service', function (done) {
            testGetServie(null, undefined, done);
        });

        it('should call the callback without error when db returns the service', function (done) {
            testGetServie(null, {url: data.DEFAULT_URLS[0], appId: data.DEFAULT_APP_IDS[0]}, done);
        });
    });

    describe('Function "getAllServices"', function () {

        var sentence = 'SELECT *             FROM services';

        var testGetAllService = function (error, services, done) {

            var all = function (sentence, callback) {
                return callback(error, services);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getAllServices(function (err, resServices) {

                assert(allSpy.calledWith(sentence));

                if (error) {
                    assert.equal(err, 'Error in database getting the services.');
                    assert.equal(resServices, null);
                } else {
                    assert.equal(err, null);
                    assert.equal(resServices, data.DEFAULT_SERVICES);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting all services', function (done) {
            testGetAllService('Error', null, done);
        });

        it('should call the callback without error when db returns all services', function (done) {
            testGetAllService(null, data.DEFAULT_SERVICES, done);
        });
    });

    describe('Function "getAppId"', function () {

        var sentence = 'SELECT appId             FROM services             WHERE $publicPath=publicPath';
        var params = { '$publicPath': data.DEFAULT_PUBLIC_PATHS[0]};

        var testGetAppId = function (error, appId, done) {

            var get = function (sentence, params, callback) {
                return callback(error, appId);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.getAppId(data.DEFAULT_PUBLIC_PATHS[0], function (err, resAppId) {

                assert(getSpy.calledWith(sentence, params));

                if (err) {

                    assert.equal(err, 'Error in database getting the appId.');
                    assert.equal(resAppId, null);

                } else {

                    assert.equal(err, null);

                    if (!appId) {
                        assert.equal(resAppId, null);
                    } else {
                        assert.equal(resAppId, appId.appId);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the appId', function (done) {
            testGetAppId('Error', null, done);
        });

        it('should call the callback withou error when the is not an appId', function (done) {
            testGetAppId(null, undefined, done);
        });

        it('should call the callback without error when db returns the appId', function (done) {
            testGetAppId(null, {appId: data.DEFAULT_APP_IDS[0]}, done);
        });
    });

    describe('Function "addAdmin"', function () {

        var sentence = 'INSERT OR REPLACE INTO admins             VALUES ($idAdmin)';
        var params = {'$idAdmin': data.DEFAULT_ID_ADMIN};

        var testGetAppId = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.addAdmin(data.DEFAULT_ID_ADMIN, function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database adding admin: "' + data.DEFAULT_ID_ADMIN + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the new administrator', function (done) {
            testGetAppId('Error', done);
        });

        it('should call the callback without error when db adds the new admin', function (done) {
            testGetAppId(null, done);
        });
    });

    describe('Function "deleteAdmin"', function () {

        var sentence = 'DELETE FROM admins             WHERE $idAdmin=idAdmin';
        var params = {'$idAdmin': data.DEFAULT_ID_ADMIN};

        var testDeleteAdmin = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.deleteAdmin(data.DEFAULT_ID_ADMIN, function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database removing admin: "' + data.DEFAULT_ID_ADMIN + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails deleting the administrator', function (done) {
            testDeleteAdmin('Error', done);
        });

        it('should call the callback with error when db deletes the admin', function (done) {
            testDeleteAdmin(null, done);
        });
    });

    describe('Function "bindAdmin"', function () {

        var sentence = 'INSERT OR REPLACE INTO administer             VALUES ($idAdmin, $publicPath)';
        var params = {
            '$idAdmin': data.DEFAULT_ID_ADMIN,
            '$publicPath': data.DEFAULT_PUBLIC_PATHS[0]
        };

        var testBindAdmin = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.bindAdmin(data.DEFAULT_ID_ADMIN, data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (err) {
                    assert.equal(err, 'Error in database binding the admin to the service.');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails binding the admin with the service', function (done) {
            testBindAdmin('Error', done);
        });

        it('should call the callback without error when db bind the admin with the service', function (done) {
            testBindAdmin(null, done);
        });
    });

    describe('Function "unbindAdmin"', function () {

        var sentence = 'DELETE FROM administer             WHERE idAdmin=$idAdmin AND publicPath=$publicPath';
        var params = {
            '$idAdmin': data.DEFAULT_ID_ADMIN,
            '$publicPath': data.DEFAULT_PUBLIC_PATHS[0]
        };

        var testUnbindAdmin = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.unbindAdmin(data.DEFAULT_ID_ADMIN, data.DEFAULT_PUBLIC_PATHS[0], function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database unbinding the administrator "' + data.DEFAULT_ID_ADMIN + '".');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        }

        it('should call the callback with error when db fails unbinding the admin', function (done) {
            testUnbindAdmin('Error', done);
        });

        it('should call the callback without error when db unbinds the admin', function (done) {
            testUnbindAdmin(null, done);
        });
    });

    describe('Function "getAdmins"', function () {

        var sentence = 'SELECT idAdmin             FROM administer             WHERE $publicPath=publicPath';
        var params = {'$publicPath': data.DEFAULT_PUBLIC_PATHS[0]};
        var admins = [
            {
                idAdmin: 'idAdmin1'
            },
            {
                idAdmin: 'idAdmin2'
            }
        ];

        var testGetAdmins = function (error, admins, resExpected, done) {

            var all = function (sentence, params, callback) {
                return callback(error, admins);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getAdmins(data.DEFAULT_PUBLIC_PATHS[0], function (err, resAdmins) {

                assert(allSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database getting the administrators.');
                    assert.equal(admins, null);
                } else {
                    assert.equal(err, null);
                    assert.deepEqual(resAdmins, resExpected);
                }

                done();
            });
        };


        it('should call the callback with error when db fails getting admins', function (done) {
            testGetAdmins('Error', null, null, done);
        });

        it('should call the callback without error when db returns all the admins', function (done) {
            var resExpected = [admins[0].idAdmin, admins[1].idAdmin];

            testGetAdmins(null, admins, resExpected, done);
        });
    });

    describe('Function "getAdminURL"', function () {

        var sentence = 'SELECT services.url \
            FROM administer, services \
            WHERE administer.publicPath=services.publicPath AND \
                administer.idAdmin=$idAdmin AND services.publicPath=$publicPath';
        var params = {
            '$idAdmin': data.DEFAULT_ID_ADMIN,
            '$publicPath': data.DEFAULT_PUBLIC_PATHS[0]
        };

        var testGetAdminUrl = function (error, result, done) {

            var get = function (sentence, params, callback) {
                return callback(error, result);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.getAdminURL(data.DEFAULT_ID_ADMIN, data.DEFAULT_PUBLIC_PATHS[0], function (err, res) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error getting the admin url.');
                    assert.equal(res, null);
                } else {

                    assert.equal(err, null);

                    if (!result) {
                        assert.equal(res, null);
                    } else {
                        assert.equal(res, result.url);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the admin url', function (done) {
            testGetAdminUrl('Error', null, done);
        });

        it('should call the callback without error when there are not admins for the service specified', function (done) {
            testGetAdminUrl(null, undefined, done);
        });

        it('should call the callback without error when db returns the URL', function (done) {
           testGetAdminUrl(null, {url: data.DEFAULT_URLS[0]}, done); 
        });
    });

    describe('Function "checkPath"', function () {

        var sentence = 'SELECT * \
            FROM services \
            WHERE publicPath=$publicPath';
        var params = {'$publicPath': data.DEFAULT_PUBLIC_PATHS[0]};

        var testCheckPath = function (error, service, done) {

            var get = function (sentence, params, callback) {
                return callback(error, service);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.checkPath(data.DEFAULT_PUBLIC_PATHS[0], function (err, result) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error checking the path.');
                    assert.equal(result, false);
                } else {

                    assert.equal(err, null);

                    if (!service) {
                        assert.equal(result, false);
                    } else {
                        assert.equal(result, true);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails checking the url', function (done) {
            testCheckPath('Error', null, done);;
        });

        it('should call the callback without error when there are not services', function (done) {
            testCheckPath(null, undefined, done);
        });

        it('should call the callback without error when there is no error checking the path', function (done) {
           testCheckPath(null, {}, done); 
        });
    });

    describe('Function "newBuy"', function () {

        var buyInfo = data.DEFAULT_BUY_INFORMATION[0];
        var sentence = 'INSERT OR REPLACE INTO accounting \
                VALUES ($apiKey, $publicPath, $orderId, $productId, $customer, $unit, $value, $recordType, $correlationNumber)';
        var params = {
            "$apiKey": buyInfo.apiKey,
            "$correlationNumber": 0,
            "$customer": buyInfo.customer,
            "$orderId": buyInfo.orderId,
            "$productId": buyInfo.productId,
            "$publicPath": buyInfo.publicPath,
            "$recordType": buyInfo.recordType,
            "$unit": buyInfo.unit,
            "$value": 0
        };

        var testNewBuy = function (error, done) {

            var serialize = function (callback) {
                return callback();
            };

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                serialize: serialize,
                run: run
            };

            var serializeSpy = sinon.spy(implementations, 'serialize');
            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.newBuy(data.DEFAULT_BUY_INFORMATION[0], function (err) {

                assert(serializeSpy.calledOnce);
                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database adding the new buy.');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the new buy information', function (done) {
            testNewBuy('Error', done);
        });

        it('should call the callback without error when db adds new buy information', function (done) {
            testNewBuy(null, done);
        });
    });

    describe('Function "getApiKeys"', function () {

        var sentence = 'SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user';
        var params = {'$user': data.DEFAULT_USER_ID_ID};

        var testGetApiKeys = function (error, apiKeys, done) {

            var all = function (sentence, params, callback) {
                return callback(error, apiKeys);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getApiKeys(data.DEFAULT_USER_ID_ID, function (err, res) {

                assert(allSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in databse getting api-keys.');
                    assert.equal(res, null);
                } else {

                    assert.equal(err, null);
                    assert.equal(res, apiKeys);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the api-keys', function (done) {
            testGetApiKeys('Error', null, done);
        });

        it('should call the callback without error when there are not api-keys', function (done) {
           testGetApiKeys(null, [], done); 
        });

        it('should call the callback without error when db returns all the API keys', function (done) {
            testGetApiKeys(null, [{}], done);
        });
    });

    describe('Function "checkRequest"', function () {

        var sentence = 'SELECT customer \
            FROM accounting \
            WHERE apiKey=$apiKey AND publicPath=$publicPath';
        var params = {'$apiKey': data.DEFAULT_API_KEYS[0], '$publicPath': data.DEFAULT_PUBLIC_PATHS[0]};

        var testCheckRequest = function (error, user, done) {

            var get = function (sentence, params, callback) {
                return callback(error, user);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.checkRequest(data.DEFAULT_USER_ID, data.DEFAULT_API_KEYS[0], data.DEFAULT_PUBLIC_PATHS[0], function (err, res) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database checking the request.');
                } else {

                    assert.equal(err, null);

                    if (!user || user.customer !== data.DEFAULT_USER_ID) {
                        assert.equal(res, false);
                    } else {
                        assert.equal(res, true);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails checking the request', function (done) {
            testCheckRequest('Error', null, done);
        });

        it('should call the callback with error when there is not information available', function (done) {
            testCheckRequest(null, undefined, done);
        });

        it('should call the callback without error when there is not customer associated with api-key', function (done) {
           testCheckRequest(null, {customer: 'other'}, done); 
        });

        it('should call the callback without error when there is not an error checking the request ', function (done) {
           testCheckRequest(null, {customer: data.DEFAULT_USER_ID}, done);  
        });
    });

    describe('Function "getAccountingInfo"', function () {

        var sentence = 'SELECT accounting.unit, services.url \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey';
        var params = { '$apiKey': data.DEFAULT_API_KEYS[0]};

        var testGetAccountingInfo = function (error, accInfo, done) {

            var get = function (sentence, params, callback)  {
                return callback(error, accInfo);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.getAccountingInfo(data.DEFAULT_API_KEYS[0], function (err, res) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database getting the accounting info.');
                } else {

                    assert.equal(err, null);

                    if (!accInfo) {
                        assert.equal(accInfo, null);
                    } else {
                        assert.equal(accInfo, accInfo);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the accounting info', function (done) {
            testGetAccountingInfo('Error', null, done);
        });

        it('should call the callback without error when there is not accounting information', function (done) {
            testGetAccountingInfo(null, undefined, done);
        });

        it('should call the callback with error when db failsgetting the accounting information', function (done) {
            testGetAccountingInfo(null, {}, done);
        });
    });

    describe('Function "getNotificationInfo"', function () {

        var sentence = 'SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0';

        var testGetNotificationInfo = function (error, notificationInfo, done) {

            var all = function (sentence, callback) {
                return callback(error, notificationInfo);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getNotificationInfo(function (err, res) {

                assert(allSpy.calledWith(sentence));

                if (error) {
                    assert.equal(err, 'Error in database getting the notification information.');
                    assert.equal(notificationInfo, null);
                } else {

                    assert.equal(err, null);

                    if (notificationInfo.length === 0) {
                        assert.equal(res, null);
                    } else {
                        assert.equal(res, notificationInfo);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting notification info', function (done) {
            testGetNotificationInfo('Error', null, done);
        });

        it('should call the callback without error when there is not information to notify', function (done) {
            testGetNotificationInfo(null, [], done);
        });

        it('should call the callback without error when db return the information to notify', function (done) {
            var notificationInfo = {
                apiKey: data.DEFAULT_API_KEYS[0],
                orderId: data.DEFAULT_ORDER_IDS[0],
                productId: data.DEFAULT_PRODUCT_IDS[0],
                customer: data.DEFAULT_USER_ID,
                value: 0,
                correlationNumber: 0,
                recordType: data.DEFAULT_RECORD_TYPE,
                unit: data.DEFAULT_UNIT
            }
            
            testGetNotificationInfo(null, notificationInfo, done);
        });
    });

    describe('Function "makeAccounting"', function () {

        var amount = 1.3;
        var sentence = 'UPDATE accounting \
                    SET value=value+$amount \
                    WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': data.DEFAULT_API_KEYS[0],
            '$amount': amount
        };

        var testMakeAccounting = function (amount, errorBegin, errorRun, errorCommit, done) {

            var errMsg = 'Error making the accounting.';

            var run = function (sentence, params, callback) {
                return callback(errorRun);
            };

            var commit = function (callback) {
                return callback(errorCommit);
            };

            var rollback = sinon.stub();

            var transaction = {
                run: run,
                rollback: rollback,
                commit: commit
            };

            var beginTransaction = function (callback) {
                return callback(errorBegin, transaction);
            };

            var implementations= {
                beginTransaction: beginTransaction
            };

            var beginTransactionSpy = sinon.spy(implementations, 'beginTransaction');
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');

            var db = getDb(implementations);

            db.makeAccounting(data.DEFAULT_API_KEYS[0], amount, function (err) {

                if (amount < 0) {
                    assert.equal(err, 'The aomunt must be greater than 0.');
                } else {

                    assert(beginTransactionSpy.calledOnce);

                    if(errorBegin) {
                        assert.equal(err, errMsg);
                    } else {
                        assert(runSpy.calledWith(sentence, params));

                        if (errorRun) {
                            assert(rollback.calledOnce);
                            assert.equal(err, errMsg);
                        } else {
                            assert(commitSpy.calledOnce);

                            if (errorCommit) {
                                assert.equal(err, errMsg);
                            } else {
                                assert.equal(err, null);
                            }
                        }
                    }
                }

                done();
            });
        };

        it('should call the callback with error when the amount is less than 0', function (done) {
            testMakeAccounting(-1.3, null, null, null, done);
        });

        it('should call the callback with error when db fails beginning transaction', function (done) {
            testMakeAccounting(amount, 'Error', null, null, done); 
        });

        it('should call the callback with error when db fails making the accounting', function (done) {
            testMakeAccounting(amount, null, 'Error', null, done);  
        });

        it('should call the callback with error when db fails committing', function (done) {
            testMakeAccounting(amount, null, null, 'Error', done);
        });

        it('should call the callback without error when db makes the accounting', function (done) {
            testMakeAccounting(amount, null, null, null, done); 
        });
    });

    describe('Function "resetAccounting"', function () {

        var sentence = 'UPDATE accounting \
                SET value=0, correlationNumber=correlationNumber+1 \
                WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': data.DEFAULT_API_KEYS[0]
        };

        var testResetAccounting = function (errorBegin, errorRun, errorCommit, done) {

            var errMsg = 'Error reseting the accounting.';

            var run = function (sentence, params, callback) {
                return callback(errorRun);
            };

            var commit = function (callback) {
                return callback(errorCommit );
            };

            var rollback = sinon.stub();

            var transaction = {
                run: run,
                rollback: rollback,
                commit: commit
            };

            var beginTransaction = function (callback) {
                return callback(errorBegin, transaction);
            };

            var implementations = {
                beginTransaction: beginTransaction
            };

            var beginTransactionSpy = sinon.spy(implementations, 'beginTransaction');
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');

            var db = getDb(implementations);

            db.resetAccounting(data.DEFAULT_API_KEYS[0], function (err) {

                assert(beginTransactionSpy.calledOnce);

                if (errorBegin) {
                    assert.equal(err, errMsg);
                } else {

                    assert(runSpy.calledWith(sentence, params));

                    if (errorRun) {
                        assert(rollback.calledOnce);
                        assert.equal(err, errMsg);
                    } else {

                        assert(commitSpy.calledOnce);

                        if (errorCommit) {
                            assert.equal(err, errMsg);
                        } else {
                            assert.equal(err, null);
                        }
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails beginning the transaction', function (done) {
            testResetAccounting('Error', null, null, done);
        });

        it('should call the callback with error when db fails reseting the accounting value', function (done) {
            testResetAccounting(null, 'Error', null, done);
        });

        it('should call the callback with error when db fails committing', function (done) {
           testResetAccounting(null, null, 'Error',  done); 
        });

        it('should call the callback without error when db resets the accounting value', function (done) {
            testResetAccounting(null, null, null,  done); 
        });
    });

    describe('Function "addCBSubscription"', function () {

        var sentence = 'INSERT OR REPLACE INTO subscriptions \
                VALUES ($subscriptionId, $apiKey, $notificationUrl)';
        var params = {
            '$subscriptionId': data.DEFAULT_SUBSCRIPTION_ID,
            '$apiKey': data.DEFAULT_API_KEYS[0],
            '$notificationUrl': data.DEFAULT_NOTIFICATION_URL
        };

        var testAddCBSubscription = function (error, done) {

            var serialize = function (callback) {
                return callback();
            };

            var run = function(sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                serialize: serialize,
                run: run
            };

            var serializeSpy = sinon.spy(implementations, 'serialize');
            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.addCBSubscription(data.DEFAULT_API_KEYS[0], data.DEFAULT_SUBSCRIPTION_ID, data.DEFAULT_NOTIFICATION_URL, function (err) {

                assert(serializeSpy.calledOnce);
                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error in database adding the subscription "' + data.DEFAULT_SUBSCRIPTION_ID + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails adding the new CB subscription', function (done) {
            testAddCBSubscription('Error', done);
        });

        it('should call the callback without error when db adds the new CB subscription', function (done) {
            testAddCBSubscription(null, done);
        });
    });

    describe('Function "getCBSubscription"', function () {

        var sentence = 'SELECT subscriptions.apiKey, subscriptions.notificationUrl, accounting.unit \
            FROM subscriptions , accounting\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': data.DEFAULT_SUBSCRIPTION_ID
        };

        var testGetCBSubscription = function (error, subscriptionInfo, done) {

            var get = function (sentence, params, callback) {
                return callback(error, subscriptionInfo);
            };

            var implementations = {
                get: get
            };

            var getSpy = sinon.spy(implementations, 'get');

            var db = getDb(implementations);

            db.getCBSubscription(data.DEFAULT_SUBSCRIPTION_ID, function (err, res) {

                assert(getSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error getting the subscription.');
                    assert.equal(res, null);
                } else {

                    assert.equal(err, null);

                    if (!subscriptionInfo) {
                        assert.equal(res, null);
                    } else {
                        assert.equal(res, subscriptionInfo);
                    }
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting the CB subscription', function (done) {
            testGetCBSubscription('Error', null, done);
        });

        it('should call the callback without error when there are not subscriptions', function (done) {
            testGetCBSubscription(null, undefined, done);
        });

        it('should call the callback without error when db gets the CB subscription', function (done) {
            testGetCBSubscription(null, {}, done);
        });
    });

    describe('Function "deleteCBSubscription"', function () {

        var sentence = 'DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': data.DEFAULT_SUBSCRIPTION_ID
        };

        var testDeleteCBSubscription = function (error, done) {

            var run = function (sentence, params, callback) {
                return callback(error);
            };

            var implementations = {
                run: run
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.deleteCBSubscription(data.DEFAULT_SUBSCRIPTION_ID, function (err) {

                assert(runSpy.calledWith(sentence, params));

                if (error) {
                    assert.equal(err, 'Error deleting the subscription "' + data.DEFAULT_SUBSCRIPTION_ID + '" .');
                } else {
                    assert.equal(err, null);
                }

                done();
            });
        };

        it('should call the callback with error when db fails deleting the CB subscription', function (done) {
            testDeleteCBSubscription('Error', done);
        });

        it('should call the callback with error when db deletes the CB subscription', function (done) {
            testDeleteCBSubscription(null, done);
        });
    });
});