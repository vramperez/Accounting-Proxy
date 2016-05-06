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
    var db_mock, spies = {};

    db_mock = {
        serialize: function (callback) {
            return callback();
        },
        run: implementations.run,
        all: implementations.all,
        get: implementations.get,
        beginTransaction: implementations.beginTransaction
    };

    var sqlite_stub = {
        verbose: function () {
            return this;
        },
        Database: function (name, options) {}
    };
    var transaction_stub = {
        TransactionDatabase: function (batabase) {
            return db_mock;
        }
    };

    // Create necessary spies
    async.forEachOf(implementations, function (implementation, method, task_callback) {
        spies[method.toString()] = sinon.spy(db_mock, method.toString());
        task_callback();
    }, function () {
        var db = proxyquire('../../db', {
            sqlite3: sqlite_stub,
            'sqlite3-transactions': transaction_stub
        });
        return callback(db, spies);
    });
};

describe('Testing SQLITE database', function () {

    describe('Function "init"', function () {
        var sentences = [
            'PRAGMA encoding = "UTF-8";',
            'PRAGMA foreign_keys = 1;',
            'CREATE TABLE IF NOT EXISTS token ( \
                    token               TEXT, \
                    PRIMARY KEY (token)         )',
            'CREATE TABLE IF NOT EXISTS units ( \
                    unit                TEXT, \
                    href                TEXT, \
                    PRIMARY KEY (unit)         )',
            'CREATE TABLE IF NOT EXISTS services ( \
                    publicPath          TEXT, \
                    url                 TEXT, \
                    appId               TEXT, \
                    PRIMARY KEY (publicPath)         )',
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
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE        )',
            'CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) ON DELETE CASCADE        )',
            'CREATE TABLE IF NOT EXISTS admins ( \
                    idAdmin             TEXT, \
                    PRIMARY KEY (idAdmin)        )',
            'CREATE TABLE IF NOT EXISTS administer ( \
                    idAdmin             TEXT, \
                    publicPath          TEXT, \
                    PRIMARY KEY (idAdmin, publicPath), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE, \
                    FOREIGN KEY (idAdmin) REFERENCES admins (idAdmin) ON DELETE CASCADE        )'
        ];

        it('correct initialization', function (done) {
            var implementations = {
                run: function (create) {}
            };
            mocker(implementations, function (db, spies) {
                db.init(function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 9);
                    async.forEachOf(spies.run.args, function (call, i, task_callback) {
                        assert.equal(call[0], sentences[i]);
                        task_callback();
                    }, function () {
                        done();
                    });
                });
            });
        });
    });

    describe('Function "addToken"', function () {
        var sentences = ['DELETE FROM token', 'INSERT OR REPLACE INTO token                 VALUES ($token)'];
        var token = 'token';
        var params = {'$token': 'token'};

        it('should call the callback with error when db fails deleting the previous token', function (done) {
            var implementations = {
                run: function (sentence, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addToken(token, function (err) {
                    assert.equal(err, 'Error adding the acces token "' + token + '" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentences[0]);
                    done();
                });
            });
        });

        it('should call the callback with error when db fails inserting the new token', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    if (sentence === sentences[0]) {
                        return params(null);
                    } else {
                        return callback('Error');
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.addToken(token, function (err) {
                    assert.equal(err, 'Error adding the acces token "' + token + '" .');
                    assert.equal(spies.run.callCount, 2);
                    assert.equal(spies.run.getCall(0).args[0], sentences[0]);
                    assert.deepEqual(spies.run.getCall(1).args[1], params);
                    assert.equal(spies.run.getCall(1).args[0], sentences[1]);
                    done();
                });
            });
        });

        it('should call the callback without error when db add the token', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    if (sentence === sentences[0]) {
                        return params(null);
                    } else {
                        return callback(null);
                    }
                }
            };
            mocker(implementations, function (db, spies) {
                db.addToken(token, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 2);
                    assert.equal(spies.run.getCall(0).args[0], sentences[0]);
                    assert.deepEqual(spies.run.getCall(1).args[1], params);
                    assert.equal(spies.run.getCall(1).args[0], sentences[1]);
                    done();
                });
            });
        });
    });

    describe('Function "getToken"', function () {
        var sentence = 'SELECT *             FROM token';
        var token = 'token';

        it('should call the callback with error when db fails getting the token', function (done) {
            var implementations = {
                get: function (sentence, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, 'Error getting the access token.');
                    assert.equal(token, null);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    done();
                })
            });
        });

        it('should call the callback without error when there is not available token', function (done) {
            var implementations = {
                get: function (sentence, callback) {
                    return callback(null, undefined);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, null);
                    assert.equal(token, undefined);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns the token', function (done) {
            var implementations = {
                get: function (sentence, callback) {
                    return callback(null, {token: token});
                }
            };
            mocker(implementations, function (db, spies) {
                db.getToken(function (err, token) {
                    assert.equal(err, null);
                    assert.equal(token, token);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    done();
                });
            });
        });
    });

    describe('Function "addSpecificationRef"', function() {
        var sentence = 'INSERT OR REPLACE INTO units             VALUES ($unit, $href)';
        var unit = 'megabyte';
        var href = 'http://example:999/api';
        var params = { '$unit': unit, '$href': href};

        it('should call the callback with error when db fails adding the specification reference', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addSpecificationRef(unit, href, function (err) {
                    assert.equal(err, 'Error adding the href specification: "' + href + '" to unit "' + unit + '" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db adds the specification', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addSpecificationRef(unit, href, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getHref"', function () {
        var sentence = 'SELECT href             FROM units             WHERE $unit=unit';
        var unit = 'megabyte';
        var href = {href: 'http://example:999/api'};
        var params = {'$unit': unit};

        it('should call the callback with error when db fails getting the href', function (done) {
            var implementations = {
                get: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getHref(unit, function (err, res) {
                    assert.equal(err, 'Error getting the href for unit "' + unit + '" .');
                    assert.equal(res, null);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.get.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not an href', function (done) {
            var implementations = {
                get: function (sentence, params, callback) {
                    return callback(null, undefined);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getHref(unit, function (err, res) {
                    assert.equal(err, null);
                    assert.equal(res, null);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.get.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns the href', function (done) {
            var implementations = {
                get: function (sentence, params, callback) {
                    return callback(null, href);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getHref(unit, function (err, res) {
                    assert.equal(err, null);
                    assert.equal(res, href.href);
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.get.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "newService"', function () {
        var sentence = 'INSERT OR REPLACE INTO services             VALUES ($path, $url, $appId)';
        var publicPath = '/public';
        var url = 'http://example.com/private';
        var appId = 'appId';
        var params = {
            '$path': publicPath,
            '$url': url,
            '$appId': appId
        }
        it('should call the callback with error when db fails adding the new service', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.newService(publicPath, url, appId, function (err) {
                    assert.equal(err, 'Error in database adding the new service.');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db adds the new service', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.newService(publicPath, url, appId, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "deleteService"', function () {
        var sentence = 'DELETE FROM services             WHERE publicPath=$path';
        var publicPath = '/public';
        var params = {
            '$path': publicPath
        }

        it('should call the callback with error when db fails deleting the service', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteService(publicPath, function (err) {
                    assert.equal(err, 'Error in database deleting the service.');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db fails', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteService(publicPath, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getService"', function () {
        var sentence = 'SELECT url, appId \
            FROM services \
            WHERE publicPath=$path';
        var publicPath = '/public';
        var url = 'http://example.com/private';
        var appId = 'appId';
        var params = {'$path': publicPath};

        it('should call the callback with error when db fails getting the service', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getService(publicPath, function (err, service) {
                    assert.equal(err, 'Error in database getting the service.');
                    assert.equal(service,  null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback with error when there is not service', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getService(publicPath, function (err, service) {
                    assert.equal(err, null);
                    assert.equal(service,  null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns the service', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [{url: url, appId: appId}]);
                }
            }
            mocker(implementations, function (db, spies) {
                db.getService(publicPath, function (err, service) {
                    assert.equal(err, null);
                    assert.deepEqual(service, {url: url, appId: appId});
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getAllServices"', function () {
        var sentence = 'SELECT *             FROM services';
        var services = [
            {
                publicPath: '/public1',
                url: 'http://example.com/path',
                appId: 'appId1',
            },
            {
                publicPath: '/public2',
                url: 'http://example.com/path',
                appId: 'appId2',
            }
        ]

        it('should call the callback with error when db fails getting all services', function (done) {
            var implementations = {
                all: function (sentence, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAllServices(function (err, services) {
                    assert.equal(err, 'Error in database getting the services.');
                    assert.equal(services, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns all services', function (done) {
            var implementations = {
                all: function (sentence, callback) {
                    return callback(null, services);
                }
            }
            mocker(implementations, function (db, spies) {
                db.getAllServices(function (err, result) {
                    assert.equal(err, null);
                    assert.deepEqual(result, services);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });
    });

    describe('Function "getAppId"', function () {
        var sentence = 'SELECT appId             FROM services             WHERE $publicPath=publicPath';
        var publicPath = '/public';
        var appId = 'appId';
        var params = { '$publicPath': publicPath};

        it('should call the callback with error when db fails getting the appId', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAppId(publicPath, function (err, appId) {
                    assert.equal(err, 'Error in database getting the appId.');
                    assert.equal(appId, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback withou error when the is not an appId', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAppId(publicPath, function (err, appId) {
                    assert.equal(err, null);
                    assert.equal(appId, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns the appId', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, appId);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAppId(publicPath, function (err, appId) {
                    assert.equal(err, null);
                    assert.equal(appId, appId);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "addAdmin"', function () {
        var sentence = 'INSERT OR REPLACE INTO admins             VALUES ($idAdmin)';
        var idAdmin = 'admin';
        var params = {'$idAdmin': idAdmin};

        it('should call the callback with error when db fails adding the new administrator', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function (db, spies) {
                db.addAdmin(idAdmin, function (err) {
                    assert.equal(err, 'Error in database adding admin: "' + idAdmin + '" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db adds the new admin', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addAdmin(idAdmin, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "deleteAdmin"', function () {
        var sentence = 'DELETE FROM admins             WHERE $idAdmin=idAdmin';
        var idAdmin = 'idAdmin';
        var params = {'$idAdmin': idAdmin};

        it('should call the callback with error when db fails deleting the administrator', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, 'Error in database removing admin: "' + idAdmin + '" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback with error when db deletes the admin', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteAdmin(idAdmin, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "bindAdmin"', function () {
        var sentence = 'INSERT OR REPLACE INTO administer             VALUES ($idAdmin, $publicPath)';
        var idAdmin = 'idAdmin';
        var publicPath = 'publicPath';
        var params = {
            '$idAdmin': idAdmin,
            '$publicPath': publicPath
        };

        it('should call the callback with error when db fails binding the admin with the service', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, 'Error in database binding the admin to the service.');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db bind the admin with the service', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.bindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "unbindAdmin"', function () {
        var sentence = 'DELETE FROM administer             WHERE idAdmin=$idAdmin AND publicPath=$publicPath';
        var idAdmin = 'idAdmin';
        var publicPath = '/public';
        var params = {
            '$idAdmin': idAdmin,
            '$publicPath': publicPath
        };

        it('should call the callback with error when db fails unbinding the admin', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.unbindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, 'Error in database unbinding the administrator.');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db unbinds the admin', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.unbindAdmin(idAdmin, publicPath, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getAdmins"', function () {
        var sentence = 'SELECT idAdmin             FROM administer             WHERE $publicPath=publicPath';
        var publicPath = '/public';
        var params = {'$publicPath': publicPath};
        var admins = [
            {
                idAdmin: 'idAdmin1'
            },
            {
                idAdmin: 'idAdmin2'
            }
        ];

        it('should call the callback with error when db fails getting admins', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null)
                }
            };
            mocker(implementations, function (db, spies){
                db.getAdmins(publicPath, function (err, admins) {
                    assert.equal(err, 'Error in database getting the administrators.');
                    assert.equal(admins, admins);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not an admin', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, null)
                }
            };
            mocker(implementations, function (db, spies){
                db.getAdmins(publicPath, function (err, result) {
                    assert.equal(err, null);
                    assert.deepEqual(result, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns all the admins', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, admins)
                }
            };
            mocker(implementations, function (db, spies){
                db.getAdmins(publicPath, function (err, result) {
                    assert.equal(err, null);
                    assert.deepEqual(result, admins);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getAdminUrl"', function () {
        var sentence = 'SELECT services.url \
            FROM administer, services \
            WHERE administer.publicPath=services.publicPath AND \
                administer.idAdmin=$idAdmin AND services.publicPath=$publicPath';
        var idAdmin = 'idAdmin';
        var publicPath = '/public';
        var url = 'http://example.com/path';
        var params = {
            '$idAdmin': idAdmin,
            '$publicPath': publicPath
        };

        it('should call the callback with error when db fails getting the admin url', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, url) {
                    assert.equal(err, 'Error getting the admin url.');
                    assert.equal(url, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there are not admins for the service specified', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, url) {
                    assert.equal(err, null);
                    assert.equal(url, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns the URL', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [{url: url}]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAdminUrl(idAdmin, publicPath, function (err, result) {
                    assert.equal(err, null);
                    assert.equal(result, url);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "checkPath"', function () {
        var sentence = 'SELECT * \
            FROM services \
            WHERE publicPath=$publicPath';
        var params = {'$publicPath': '/path'}

        it('should call the callback with error when db fails checking the url', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath('/path', function (err, check) {
                    assert.equal(err, 'Error checking the path.');
                    assert.equal(check,  false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there are not services', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath('/path', function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check,  false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is no error checking the path', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [{url: 'url'}]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkPath('/path', function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check,  true);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "newBuy"', function () {
        var sentence = 'INSERT OR REPLACE INTO accounting \
                VALUES ($apiKey, $publicPath, $orderId, $productId, $customer, $unit, $value, $recordType, $correlationNumber)';
        var buyInformation = {
                apiKey: 'apiKey',
                publicPath: '/public',
                orderId: 'orderId',
                productId: 'productId',
                customer: '0001',
                unit: 'call',
                recordType: 'callusage'
        }
        var params = {
            "$apiKey": "apiKey",
            "$correlationNumber": 0,
            "$customer": "0001",
            "$orderId": "orderId",
            "$productId": "productId",
            "$publicPath": "/public",
            "$recordType": "callusage",
            "$unit": "call",
            "$value": 0
        }
        it('should call the callback with error when db fails adding the new buy information', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.newBuy(buyInformation, function (err, check) {
                    assert.equal(err, 'Error in database adding the new buy.');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db adds new buy information', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.newBuy(buyInformation, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getApiKeys"', function () {
        var sentence = 'SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user';
        var params = {'$user': '0001'};

        it('should call the callback with error when db fails getting the api-keys', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
                    assert.equal(err, 'Error in databse getting api-keys.');
                    assert.equal(apiKeys, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there are not api-keys', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
                    assert.equal(err, null);
                    assert.equal(apiKeys, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db returns all the API keys', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, ['apiKey1', 'apiKey2']);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getApiKeys('0001', function (err, apiKeys) {
                    assert.equal(err, null);
                    assert.deepEqual(apiKeys, ['apiKey1', 'apiKey2']);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "checkRequest"', function () {
        var sentence = 'SELECT customer \
            FROM accounting \
            WHERE apiKey=$apiKey AND publicPath=$publicPath';
        var publicPath = 'http://localhost/path';
        var apiKey = 'apiKey1';
        var params = {'$apiKey': apiKey, '$publicPath': publicPath}

        it('should call the callback with error when db fails checking the request', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', apiKey, publicPath, function (err, check) {
                    assert.equal(err, 'Error in database checking the request.');
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback with error when there is not information available', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', apiKey, publicPath, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not customer associated with api-key', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [{cutomer: '0007'}]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', apiKey, publicPath, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not an error checking the request ', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [{customer: '0001'}]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.checkRequest('0001', apiKey, publicPath, function (err, check) {
                    assert.equal(err, null);
                    assert.equal(check, true);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getAccountingInfo"', function () {
        var sentence = 'SELECT accounting.unit, services.url \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey';
        var params = { '$apiKey': 'apiKey'};

        it('should call the callback with error when db fails getting the accounting info', function (done) {
            var implementations = {
                all: function (sentences, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo('apiKey', function (err, accInfo) {
                    assert.equal(err, 'Error in database getting the accounting info.');
                    assert.equal(accInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not accounting information', function (done) {
            var implementations = {
                all: function (sentences, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo('apiKey', function (err, accInfo) {
                    assert.equal(err, null);
                    assert.equal(accInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback with error when db failsgetting the accounting information', function (done) {
            var accInfo = {
                unit: 'call', 
                url: 'url', 
                publicPath: '/public'
            }
            var implementations = {
                all: function (sentences, params, callback) {
                    return callback(null, accInfo);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getAccountingInfo('apiKey', function (err, accInfo) {
                    assert.equal(err, null);
                    assert.equal(accInfo, accInfo);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getNotificationInfo"', function () {
        var sentence = 'SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0';

        it('should call the callback with error when db fails getting notification info', function (done) {
            var implementations = {
                all: function (sentence, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
                    assert.equal(err, 'Error in database getting the notification information.');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('should call the callback without error when there is not information to notify', function (done) {
            var implementations = {
                all: function (sentence, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
                    assert.equal(err, null);
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('should call the callback without error when db return the information to notify', function (done) {
            var notifInfo = {
                apiKey: 'apiKey',
                orderId: 'orderId',
                productId: 'productId',
                customer: 'customer',
                value: 0,
                correlationNumber: 0,
                recordType: 'callusage',
                unit: 'call'
            }
            var implementations = {
                all: function (sentence, callback) {
                    return callback(null, notifInfo);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getNotificationInfo(function (err, notificationInfo) {
                    assert.equal(err, null);
                    assert.equal(notificationInfo, notifInfo);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });
    });

    describe('Function "makeAccounting"', function () {
        var sentence = 'UPDATE accounting \
                    SET value=value+$amount \
                    WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': 'apiKey',
            '$amount': '1.5'
        };

        it('should call the callback with error when the amount is less than 0', function (done) {
            mocker({}, function (db, spies) {
                db.makeAccounting('apiKey', - 1.3, function (err) {
                    assert.equal(err, 'The aomunt must be greater than 0.');
                    done();
                });
            });
        });

        it('should call the callback with error when db fails beginning transaction', function (done) {
            var implementations = {
                beginTransaction: function (callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.3, function (err) {
                    assert.equal(err, 'Error making the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback with error when db fails making the accounting', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                },
                rollback: function () {}
            };
            var runSpy = sinon.spy(transaction, 'run');
            var rollbackSpy = sinon.spy(transaction, 'rollback');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.5, function (err) {
                    assert.equal(err, 'Error making the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(rollbackSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback with error when db fails committing', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback(null);
                },
                commit: function (callback) {
                    return callback('Error');
                }
            };
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.5, function (err) {
                    assert.equal(err, 'Error making the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback without error when db makes the accounting', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback(null);
                },
                commit: function (callback) {
                    return callback(null);
                }
            };
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.makeAccounting('apiKey', 1.5, function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });
    });

    describe('Function "resetAccounting"', function () {
        var sentence = 'UPDATE accounting \
                SET value=0, correlationNumber=correlationNumber+1 \
                WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': 'apiKey'
        };

        it('should call the callback with error when db fails beginning the transaction', function (done) {
            var implementations = {
                beginTransaction: function (callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
                    assert.equal(err, 'Error reseting the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback with error when db fails reseting the accounting value', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                },
                rollback: function () {}
            };
            var runSpy = sinon.spy(transaction, 'run');
            var rollbackSpy = sinon.spy(transaction, 'rollback');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
                    assert.equal(err, 'Error reseting the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(rollbackSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback with error when db fails committing', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback(null);
                },
                commit: function (callback) {
                    return callback('Error');
                }
            };
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
                    assert.equal(err, 'Error reseting the accounting.');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('should call the callback without error when db resets the accounting value', function (done) {
            var transaction = {
                run: function (sentence, params, callback) {
                    return callback(null);
                },
                commit: function (callback) {
                    return callback(null);
                }
            };
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function (callback) {
                    return callback(null, transaction);
                }
            };
            mocker(implementations, function (db, spies) {
                db.resetAccounting('apiKey', function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });
    });

    describe('Function "addCBSubscription"', function () {
        var sentence = 'INSERT OR REPLACE INTO subscriptions \
                VALUES ($subscriptionId, $apiKey, $notificationUrl)';
        var params = {
            '$subscriptionId': 'subscriptionId',
            '$apiKey': 'apiKey',
            '$notificationUrl': 'http://notification/url'
        };

        it('should call the callback with error when db fails adding the new CB subscription', function (done) {
            var implementations = {
                run: function (sentences, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.addCBSubscription('apiKey', 'subscriptionId', 'http://notification/url', function (err) {
                    assert.equal(err, 'Error in database adding the subscription "subscriptionId" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db adds the new CB subscription', function (done) {
            var implementations = {
                run: function (sentences, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.addCBSubscription('apiKey', 'subscriptionId', 'http://notification/url', function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getCBSubscription"', function () {
        var sentence = 'SELECT subscriptions.apiKey, subscriptions.notificationUrl, accounting.unit \
            FROM subscriptions , accounting\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': 'subscriptionId'
        }

        it('should call the callback with error when db fails getting the CB subscription', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback('Error', null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subscriptionId', function (err, subscriptionInfo) {
                    assert.equal(err, 'Error getting the subscription.');
                    assert.equal(subscriptionInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when there are not subscriptions', function (done) {
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, []);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subscriptionId', function (err, subscriptionInfo) {
                    assert.equal(err, null);
                    assert.equal(subscriptionInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback without error when db gets the CB subscription', function (done) {
            var subsInfo = {
                apiKey: 'apiKey',
                notificationUrl: 'http://notification/url',
                unit: 'call'
            };
            var implementations = {
                all: function (sentence, params, callback) {
                    return callback(null, [subsInfo]);
                }
            };
            mocker(implementations, function (db, spies) {
                db.getCBSubscription('subscriptionId', function (err, subscriptionInfo) {
                    assert.equal(err, null);
                    assert.deepEqual(subscriptionInfo, subsInfo);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "deleteCBSubscription"', function () {
        var sentence = 'DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': 'subscriptionId'
        };

        it('should call the callback with error when db fails deleting the CB subscription', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback('Error');
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteCBSubscription('subscriptionId', function (err) {
                    assert.equal(err, 'Error deleting the subscription "subscriptionId" .');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('should call the callback with error when db deletes the CB subscription', function (done) {
            var implementations = {
                run: function (sentence, params, callback) {
                    return callback(null);
                }
            };
            mocker(implementations, function (db, spies) {
                db.deleteCBSubscription('subscriptionId', function (err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });
});
