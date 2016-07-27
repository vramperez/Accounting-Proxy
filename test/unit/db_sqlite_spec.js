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

    var defaultRun = function (sentence) {};

    implementations.run = implementations.run ? implementations.run : defaultRun;

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

var runTest = function (sentence, params, method, args, error, done) {

    var run = function (sentence, params, callback) {
        if (!params) {
            return;
        } else {
            return callback(error);
        }
    };

    var implementations = {
        run: run
    };

    var runSpy = sinon.spy(implementations, 'run');

    var db = getDb(implementations);

    var assertions = function (err) {

        assert(runSpy.calledWith(sentence, params));

        if (error) {
            assert.equal(err, error);
        } else {
            assert.equal(err, null);
        }

        done();
    };

    var argsCopy = JSON.parse(JSON.stringify(args));
    argsCopy.push(assertions);

    db[method].apply(this, argsCopy);
};

var getTest = function (method, sentence, params, args, error, res, expectedRes, done) {

    var get = function (sentence, params, callback) {
        return callback(error, res);
    };

    var implementations = {
        get: get
    };

    var getSpy = sinon.spy(implementations, 'get');

    var db = getDb(implementations);

    var assertions = function (err, result) {

        assert(getSpy.calledWith(sentence, params));
        assert.equal(err, error);
        assert.deepEqual(result, expectedRes);

        done();
    };

    var argsCopy = JSON.parse(JSON.stringify(args));
    argsCopy.push(assertions);

    db[method].apply(this, argsCopy);
};

describe('Testing SQLITE database', function () {

    describe('Function "init"', function () {

        var sentences = [
            'PRAGMA foreign_keys = 1;',
            'PRAGMA encoding = "UTF-8";',
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
                    isCBService         INT, \
                    methods             TEXT, \
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
                    version             TEXT, \
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
                    if (!callback) {
                        return;
                    } else {
                        return callback(null);
                    }
                }
            };

            var runSpy = sinon.spy(implementations, 'run');

            var db = getDb(implementations);

            db.init(function (err) {

                assert.equal(err, null);
                assert.equal(runSpy.callCount, 9);

                async.forEachOf(runSpy.args, function (call, i, taskCallback) {
                    assert.equal(call[0], sentences[i]);
                    taskCallback();
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
                } else if (sentence === sentences[1]) {
                    return callback(runRes2);
                } else {
                    return;
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
                    assert(runSpy.calledWith(sentences[0]));
                    assert(runSpy.calledWith(sentences[1], params));

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

        var unit = data.DEFAULT_UNIT;
        var href = data.DEFAULT_HREFS[0];

        var sentence = 'INSERT OR REPLACE INTO units             VALUES ($unit, $href)';
        var params = { '$unit': unit, '$href': href};

        var method = 'addSpecificationRef';
        var args = [unit, href];

        it('should call the callback with error when db fails adding the specification reference', function (done) {
            var errorMsg = 'Error adding the href specification: "' + href + '" to unit "' + unit + '" .';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db adds the specification', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "getHref"', function () {

        var sentence = 'SELECT href             FROM units             WHERE $unit=unit';
        var unit = data.DEFAULT_UNIT;
        var params = {'$unit': unit};
        var href = data.DEFAULT_HREFS[0];

        var method = 'getHref';
        var args = [unit];

        it('should call the callback with error when db fails getting the href', function (done) {
            var errorMsg = 'Error getting the href for unit "' + unit + '" .';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when there is not an href', function (done) {
           getTest(method, sentence, params, args, null, null, null, done); 
        });

        it('should call the callback without error when db returns the href', function (done) {
            getTest(method, sentence, params, args, null, {href: href}, href, done);
        });
    });

    describe('Function "newService"', function () {

        var path = data.DEFAULT_PUBLIC_PATHS[0];
        var url = data.DEFAULT_URLS[0];
        var appId = data.DEFAULT_APP_IDS[0];
        var isCBService = true;
        var httpMethods = data.DEFAULT_HTTP_METHODS_LIST;

        var sentence = 'INSERT OR REPLACE INTO services             VALUES ($path, $url, $appId, $isCBService, $methods)';
        var params = {
            '$path': path,
            '$url': url,
            '$appId': appId,
            '$isCBService': isCBService ? 1 : 0,
            '$methods': httpMethods.join(',').toUpperCase()
        };

        var method = 'newService';
        var args = [path, url, appId, isCBService, httpMethods];

        it('should call the callback with error when db fails adding the new service', function (done) {
            var errorMsg = 'Error in database adding the new service.';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db adds the new service', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "deleteService"', function () {

        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];

        var sentence = 'DELETE FROM services             WHERE publicPath=$path';
        var params = {
            '$path': publicPath
        };

        var method = 'deleteService';
        var args = [publicPath];

        it('should call the callback with error when db fails deleting the service', function (done) {
            var errorMsg = 'Error in database deleting the service.';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db fails', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "getService"', function () {

        var sentence = 'SELECT *\
            FROM services \
            WHERE publicPath=$path';
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var params = {'$path': publicPath};

        var args = [publicPath];
        var method = 'getService';

        it('should call the callback with error when db fails getting the service', function (done) {
            var errorMsg = 'Error in database getting the service.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback with error when there is not service', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback without error when db returns the service', function (done) {
            var result = {url: data.DEFAULT_URLS[0], appId: data.DEFAULT_APP_IDS[0], methods: data.DEFAULT_HTTP_METHODS_STRING};
            var expectedResult = {url: data.DEFAULT_URLS[0], appId: data.DEFAULT_APP_IDS[0], methods: data.DEFAULT_HTTP_METHODS_LIST};

            getTest(method, sentence, params, args, null, result, expectedResult, done);
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
                    assert.deepEqual(resServices, data.DEFAULT_SERVICES_LIST);
                }

                done();
            });
        };

        it('should call the callback with error when db fails getting all services', function (done) {
            testGetAllService('Error', null, done);
        });

        it('should call the callback without error when db returns all services', function (done) {
            var services = data.DEFAULT_SERVICES_STRING;

            testGetAllService(null, services, done);
        });
    });

    describe('Function "isCBService"', function () {

        var sentence = 'SELECT isCBService             FROM services             WHERE $publicPath=publicPath';
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var params = {'$publicPath': publicPath};

        var args = [publicPath];
        var method = 'isCBService';

        it('should call the callback with error when db fails getting the service type', function (done) {
            var errorMsg = 'Error in database gettings the service type.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when there is no service for the public path passed', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback without error and true when the service is a Context Broker service', function (done) {
            getTest(method, sentence, params, args, null, 1, true, done);
        });

        it('should call the callback without error and false when the service is not a Context Broker service', function (done) {
            getTest(method, sentence, params, args, null, 0, false, done);
        });
    });

    describe('Function "getAppId"', function () {

        var sentence = 'SELECT appId             FROM services             WHERE $publicPath=publicPath';
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var params = { '$publicPath': publicPath};
        var appId = data.DEFAULT_APP_IDS[0];

        var args = [publicPath];
        var method = 'getAppId';

        it('should call the callback with error when db fails getting the appId', function (done) {
            var errorMsg = 'Error in database getting the appId.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when the is not an appId', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback without error when db returns the appId', function (done) {
            getTest(method, sentence, params, args, null, {appId: appId}, appId, done);
        });
    });

    describe('Function "addAdmin"', function () {

        var adminId = data.DEFAULT_ID_ADMIN;

        var sentence = 'INSERT OR REPLACE INTO admins             VALUES ($idAdmin)';
        var params = {'$idAdmin': adminId};

        var method = 'addAdmin';
        var args = [adminId];

        it('should call the callback with error when db fails adding the new administrator', function (done) {
            var errorMsg = 'Error in database adding admin: "' + adminId + '" .';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db adds the new admin', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "deleteAdmin"', function () {

        var adminId = data.DEFAULT_ID_ADMIN;

        var sentence = 'DELETE FROM admins             WHERE $idAdmin=idAdmin';
        var params = {'$idAdmin': adminId};

        var method = 'deleteAdmin';
        var args = [adminId];

        it('should call the callback with error when db fails deleting the administrator', function (done) {
            var errorMsg = 'Error in database removing admin: "' + adminId + '" .';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback with error when db deletes the admin', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "bindAdmin"', function () {

        var adminId = data.DEFAULT_ID_ADMIN;
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];

        var sentence = 'INSERT OR REPLACE INTO administer             VALUES ($idAdmin, $publicPath)';
        var params = {
            '$idAdmin': adminId,
            '$publicPath': publicPath
        };

        var method = 'bindAdmin';
        var args = [adminId, publicPath];

        it('should call the callback with error when db fails binding the admin with the service', function (done) {
            var errorMsg = 'Error in database binding the admin to the service.';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db bind the admin with the service', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "unbindAdmin"', function () {

        var adminId = data.DEFAULT_ID_ADMIN;
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];

        var sentence = 'DELETE FROM administer             WHERE idAdmin=$idAdmin AND publicPath=$publicPath';
        var params = {
            '$idAdmin': adminId,
            '$publicPath': publicPath
        };

        var method = 'unbindAdmin';
        var args = [adminId, publicPath];

        it('should call the callback with error when db fails unbinding the admin', function (done) {
            var errorMsg = 'Error in database unbinding the administrator "' + adminId + '".';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db unbinds the admin', function (done) {
            runTest(sentence, params, method, args, null, done);
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

        var idAdmin = data.DEFAULT_ID_ADMIN;
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var httpMethods = data.DEFAULT_HTTP_METHODS_STRING;
        var url = data.DEFAULT_URLS[0];

        var sentence = 'SELECT services.url, services.methods \
            FROM administer, services \
            WHERE administer.publicPath=services.publicPath AND \
                administer.idAdmin=$idAdmin AND services.publicPath=$publicPath';
        var params = {
            '$idAdmin': idAdmin,
            '$publicPath': publicPath
        };

        var args = [idAdmin, publicPath, httpMethods.split(',')[0]];
        var method = 'getAdminURL';

        it('should call the callback with error when db fails getting the admin url', function (done) {
            var errorMsg = 'Error getting the admin url.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when there are not admins for the service specified', function (done) {
            var expectedResult = {isAdmin: false, errorCode: 'admin', url: null};

            getTest(method, sentence, params, args, null, null, expectedResult, done);
        });

        it('should call the callback with error when the method is not a valid http method', function (done) {
            var result = {url: url, methods: httpMethods};
            var expectedResult = {isAdmin: true, errorCode: 'method', url: null, errorMsg: 'Valid methods are: ' + httpMethods};
            var wrongArgs = JSON.parse(JSON.stringify(args));
            wrongArgs[2] = 'WRONG';

            getTest(method, sentence, params, wrongArgs, null, result, expectedResult, done);
        });

        it('should call the callback without error when db returns the URL', function (done) {
            var result = {url: url, methods: httpMethods};
            var expectedResult = {isAdmin: true, errorCode: 'ok', url: url};

            getTest(method, sentence, params, args, null, result, expectedResult, done); 
        });
    });

    describe('Function "checkPath"', function () {

        var sentence = 'SELECT * \
            FROM services \
            WHERE publicPath=$publicPath';
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var params = {'$publicPath': publicPath};

        var method = 'checkPath';
        var args = [publicPath];

        it('should call the callback with error when db fails checking the url', function (done) {
            var errorMsg = 'Error checking the path.';

            getTest(method, sentence, params, args, errorMsg, false, false, done);;
        });

        it('should call the callback without error when there are not services', function (done) {
            getTest(method, sentence, params, args, null, false, false, done);
        });

        it('should call the callback without error when there is no error checking the path', function (done) {
           getTest(method, sentence, params, args, null, true, true, done); 
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

        var method = 'newBuy';
        var args = [buyInfo];

        it('should call the callback with error when db fails adding the new buy information', function (done) {
            var errorMsg = 'Error in database adding the new buy.';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db adds new buy information', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "deleteBuy"', function () {

        var apiKey = data.DEFAULT_API_KEYS[0];

        var sentence = 'DELETE FROM accounting             WHERE apiKey=$apiKey';
        var params = {'$apiKey': apiKey};

        var method = 'deleteBuy';
        var args = [apiKey];

        it('should call the callback with error when there is an error deleting the API key', function (done) {
            var errorMsg = 'Error deleting the API key.';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when there is no error deleting the API key', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "getApiKeys"', function () {

        var sentence = 'SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user';
        var params = {'$user': data.DEFAULT_USER_ID};

        var testGetApiKeys = function (error, apiKeys, done) {

            var all = function (sentence, params, callback) {
                return callback(error, apiKeys);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getApiKeys(data.DEFAULT_USER_ID, function (err, res) {

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

        var apiKey = data.DEFAULT_API_KEYS[0];
        var publicPath = data.DEFAULT_PUBLIC_PATHS[0];
        var customer = data.DEFAULT_USER_ID;
        var httpMethods = data.DEFAULT_HTTP_METHODS_STRING;

        var sentence = 'SELECT accounting.customer, services.methods \
            FROM accounting, services \
            WHERE services.publicPath=accounting.publicPath \
                AND services.publicPath=$publicPath \
                AND accounting.apiKey=$apiKey ';
        var params = {'$apiKey': apiKey, '$publicPath': publicPath};

        var method = 'checkRequest';
        var args = [customer, apiKey, publicPath, httpMethods.split(',')[0]];

        it('should call the callback with error when db fails checking the request', function (done) {
            var errorMsg = 'Error in database checking the request.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback with error when there is not information available', function (done) {
            var expectedResult = {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Invalid API key'};

            getTest(method, sentence, params, args, null, null, expectedResult, done);
        });

        it('should call the callback with error when the customer associated with the API key is other customer', function (done) {
            var expectedResult = {isCorrect: false, errorCode: 'apiKey', errorMsg: 'Invalid API key'};

            getTest(method, sentence, params, args, null, {customer: 'other'}, expectedResult, done);
        });

        it('should call the callback with error when the method is not a valid http method', function (done) {
            var result = {customer: data.DEFAULT_USER_ID, methods: httpMethods};
            var expectedResult = {isCorrect: false, errorCode: 'method', errorMsg: 'Valid methods are: ' + httpMethods};
            var wrongArgs = JSON.parse(JSON.stringify(args));
            wrongArgs[3] = 'WRONG';

            getTest(method, sentence, params, wrongArgs, null, result, expectedResult, done);
        });

        it('should call the callback without error when there is not an error checking the request ', function (done) {
            var result = {customer: data.DEFAULT_USER_ID, methods: httpMethods};
            var expectedResult = {isCorrect: true};

            getTest(method, sentence, params, args, null, result, expectedResult, done);  
        });
    });

    describe('Function "getAccountingInfo"', function () {

        var apiKey = data.DEFAULT_API_KEYS[0];

        var sentence = 'SELECT accounting.unit, services.url \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey';
        var params = { '$apiKey': apiKey};

        var method = 'getAccountingInfo';
        var args = [apiKey];

        it('should call the callback with error when db fails getting the accounting info', function (done) {
            var errorMsg = 'Error in database getting the accounting info.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when there is not accounting information', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback with error when db failsgetting the accounting information', function (done) {
            getTest(method, sentence, params, args, null, {}, {}, done);
        });
    });

    describe('Function "getAllNotificationInfo"', function () {

        var sentence = 'SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0';

        var testGetAllNotificationInfo = function (error, notificationInfo, done) {

            var all = function (sentence, callback) {
                return callback(error, notificationInfo);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getAllNotificationInfo(function (err, res) {

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
            testGetAllNotificationInfo('Error', null, done);
        });

        it('should call the callback without error when there is not information to notify', function (done) {
            testGetAllNotificationInfo(null, [], done);
        });

        it('should call the callback without error when db return the information to notify', function (done) {
            var notificationInfo = data.DEFAULT_NOTIFICATION_INFO;
            
            testGetAllNotificationInfo(null, notificationInfo, done);
        });
    });

    describe('Function "getNotificationInfo"', function (done) {

        var apiKey = data.DEFAULT_API_KEYS[0];

        var sentence = 'SELECT orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE apiKey=$apiKey AND value!=0';
        var params = {'$apiKey': apiKey};

        var method = 'getNotificationInfo';
        var args = [apiKey];

        it('should call the callback with error when there is an error getting the notification information', function (done) {
            var errorMsg = 'Error in database getting the notification information.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback withput error when there is no notification information available', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback without error and return the notification information when there is notification information', function (done) {
            var notificationInfo = data.DEFAULT_NOTIFICATION_INFO;
            var result = notificationInfo;

            getTest(method, sentence, params, args, null, notificationInfo, result, done);
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

        var apiKey = data.DEFAULT_API_KEYS[0];
        var subsId = data.DEFAULT_SUBSCRIPTION_ID;
        var notificationUrl = data.DEFAULT_NOTIFICATION_URL;
        var version = 'v1';

        var sentence = 'INSERT OR REPLACE INTO subscriptions \
        VALUES ($subscriptionId, $apiKey, $notificationUrl, $version)';
        var params = {
            '$subscriptionId': subsId,
            '$apiKey': apiKey,
            '$notificationUrl': notificationUrl,
            '$version': version
        };

        var method = 'addCBSubscription';
        var args = [apiKey, subsId, notificationUrl, version];

        it('should call the callback with error when db fails adding the new CB subscription', function (done) {
            var errorMsg = 'Error in database adding the subscription "' + subsId + '" .';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when db adds the new CB subscription', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "getCBSubscription"', function () {

        var subsId = data.DEFAULT_SUBSCRIPTION_ID;

        var sentence = 'SELECT subscriptions.apiKey, subscriptions.notificationUrl, \
                subscriptions.subscriptionId, subscriptions.version, accounting.unit, services.url\
            FROM subscriptions , accounting, services\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId \
                AND services.publicPath=accounting.publicPath';
        var params = {
            '$subscriptionId': subsId
        };

        var method = 'getCBSubscription';
        var args = [subsId];

        it('should call the callback with error when db fails getting the CB subscription', function (done) {
            var errorMsg = 'Error getting the subscription.';

            getTest(method, sentence, params, args, errorMsg, null, null, done);
        });

        it('should call the callback without error when there are not subscriptions', function (done) {
            getTest(method, sentence, params, args, null, null, null, done);
        });

        it('should call the callback without error when db gets the CB subscription', function (done) {
            getTest(method, sentence, params, args, null, {}, {}, done);
        });
    });

    describe('Function "getCBsubscriptions"', function () {

        var apiKey = data.DEFAULT_API_KEYS[0];

        var sentence = 'SELECT *            FROM subscriptions             WHERE apiKey=$apiKey';
        var params = {'$apiKey': apiKey};

        var testGetCBSubscriptions = function (sentence, params, error, subscriptions, result, done) {

            var all = function (sentence, params, callback) {
                return callback(error, subscriptions);
            };

            var implementations = {
                all: all
            };

            var allSpy = sinon.spy(implementations, 'all');

            var db = getDb(implementations);

            db.getCBSubscriptions(apiKey, function (err, res) {

                assert(allSpy.calledWith(sentence, params));

                assert.equal(err, error);
                assert.deepEqual(result, result);

                done();
            });
        };

        it('should call the callback with error when there is an error getting all the subscriptions', function (done) {
            var errorMsg = 'Error in database getting the subscriptions.';

            testGetCBSubscriptions(sentence, params, errorMsg, null, null, done);
        });

        it('should call the callback without error when there is no subscription', function (done) {
            testGetCBSubscriptions(sentence, params, null, [], null, done);
        });

        it('should call the callback without error and return the subscriptions information when there are subscriptions', function (done) {
            testGetCBSubscriptions(sentence, params, null, [{}], [{}], done);
        });
    });

    describe('Function "updateNotificationUrl"', function () {

        var subsId = data.DEFAULT_SUBSCRIPTION_ID;
        var notificationUrl = data.DEFAULT_NOTIFICATION_URL;

        var sentence = 'UPDATE subscriptions \
            SET notificationUrl=$notificationUrl \
            WHERE subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': subsId,
            '$notificationUrl': notificationUrl
        };

        var method = 'updateNotificationUrl';
        var args = [subsId, notificationUrl];

        it('should call the callback with error when db fails updating the notification URL', function (done) {
            var errorMsg = 'Error in database updating the notificationURL';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback without error when there is no error updating the notification URL', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });

    describe('Function "deleteCBSubscription"', function () {

        var subsId = data.DEFAULT_SUBSCRIPTION_ID;

        var sentence = 'DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': data.DEFAULT_SUBSCRIPTION_ID
        };

        var method = 'deleteCBSubscription';
        var args = [subsId];

        it('should call the callback with error when db fails deleting the CB subscription', function (done) {
            var errorMsg = 'Error deleting the subscription "' + subsId + '" .';

            runTest(sentence, params, method, args, errorMsg, done);
        });

        it('should call the callback with error when db deletes the CB subscription', function (done) {
            runTest(sentence, params, method, args, null, done);
        });
    });
});