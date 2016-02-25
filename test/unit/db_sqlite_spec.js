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
    var db_mock, spies = {};

    db_mock = {
        serialize: function(callback) {
            return callback();
        },
        run: implementations.run,
        all: implementations.all,
        get: implementations.get,
        beginTransaction: implementations.beginTransaction
    }

    var sqlite_stub = {
        verbose: function() {
            return this;
        },
        Database: function(name, options) {}
    }
    var transaction_stub = {
        TransactionDatabase: function(batabase) {
            return db_mock;
        }
    }

    // Create necessary spies
    async.forEachOf(implementations, function(implementation, method, task_callback) {
        spies[method.toString()] = sinon.spy(db_mock, method.toString());
        task_callback();
    }, function() {
        var db = proxyquire('../../db', {
            'sqlite3': sqlite_stub,
            'sqlite3-transactions': transaction_stub
        });
        return callback(db, spies);
    });
}

describe('Testing SQLITE database', function() {

    describe('Function "init"', function() {
        var sentences = [
            'PRAGMA encoding = "UTF-8";',
            'PRAGMA foreign_keys = 1;',
            'CREATE TABLE IF NOT EXISTS token ( \
                    token               TEXT         )',
            'CREATE TABLE IF NOT EXISTS services ( \
                    publicPath      TEXT, \
                    url             TEXT, \
                    PRIMARY KEY (publicPath)         )',
            'CREATE TABLE IF NOT EXISTS accounting ( \
                    apiKey              TEXT, \
                    publicPath          TEXT, \
                    orderId             TEXT, \
                    productId           TEXT, \
                    customer            TEXT, \
                    unit                TEXT, \
                    value               TEXT, \
                    recordType          TEXT, \
                    correlationNumber   TEXT, \
                    PRIMARY KEY (apiKey), \
                    FOREIGN KEY (publicPath) REFERENCES services (publicPath) ON DELETE CASCADE        )',
            'CREATE TABLE IF NOT EXISTS subscriptions ( \
                    subscriptionId      TEXT, \
                    apiKey              TEXT, \
                    notificationUrl     TEXT, \
                    PRIMARY KEY (subscriptionId), \
                    FOREIGN KEY (apiKey) REFERENCES accounting (apiKey) ON DELETE CASCADE        )'
            ];

        it('correct initialization', function(done) {
            var implementations = {
                run: function(create) {}
            }
            mocker(implementations, function(db, spies) {
                db.init(function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 6);
                    async.forEachOf(spies.run.args, function(call, i, task_callback) {
                        assert.equal(call[0], sentences[i]);
                        task_callback();
                    }, function() {
                        done();
                    });
                });
            });
        });
    });

    describe('Function "addToken"', function() {
        var sentences = ['DELETE FROM token', 'INSERT OR REPLACE INTO token                 VALUES ($token)'];
        var params = {'$token': 'token'};

        it('error deleting the previous token', function(done) {
            var implementations = {
                run: function(sentence, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.addToken('token', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentences[0]);
                    done();
                });
            });
        });

        it('error inserting the new token', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    if (sentence === sentences[0]) {
                        return params(null);
                    } else {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function(db, spies) {
                db.addToken('token', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 2);
                    assert.equal(spies.run.getCall(0).args[0], sentences[0]);
                    assert.deepEqual(spies.run.getCall(1).args[1], params);
                    assert.equal(spies.run.getCall(1).args[0], sentences[1]);
                    done();
                });
            });
        });

        it('token added', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    if (sentence === sentences[0]) {
                        return params(null);
                    } else {
                        return callback(null);
                    }
                }
            }
            mocker(implementations, function(db, spies) {
                db.addToken('token', function(err) {
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

    describe('Function "getToken"', function() {
        var sentence = 'SELECT *             FROM token';

        it('error getting the token', function(done) {
            var implementations = {
                get: function(sentence, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getToken(function(err, token) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    done();
                })
            });
        });

        it('correct', function(done) {
            var implementations = {
                get: function(sentence, callback) {
                    return callback(null, {token: 'token'});
                }
            }
            mocker(implementations, function(db, spies) {
                db.getToken(function(err, token) {
                    assert.equal(err, null);
                    assert.equal(token, 'token');
                    assert.equal(spies.get.callCount, 1);
                    assert.equal(spies.get.getCall(0).args[0], sentence);
                    done();
                });
            });
        });
    });

    describe('Function "newService"', function() {
        var sentence = 'INSERT OR REPLACE INTO services             VALUES ($path, $url)';
        var params = {
            '$path': '/public',
            '$url': 'http://example.com/private'
        }
        it('error adding the new service', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.newService('/public', 'http://example.com/private', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('service added', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.newService('/public', 'http://example.com/private', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "deleteService"', function() {
        var sentence = 'DELETE FROM services             WHERE publicPath=$path';
        var params = {
            '$path': '/public'
        }

        it('query error', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteService('/public', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getService"', function() {
        var sentence = 'SELECT url \
            FROM services \
            WHERE publicPath=$path';
        var params = {'$path': '/public'};

        it('error getting the service', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, 'Error');
                    assert.equal(service,  null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no service available', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, null);
                    assert.equal(service,  null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, [{url: 'http://example.com/private'}]);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getService('/public', function(err, service) {
                    assert.equal(err, null);
                    assert.equal(service,  'http://example.com/private');
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "checkUrl"', function() {
        var sentence = 'SELECT * \
            FROM services \
            WHERE url=$url';
        var params = {'$url': 'url'}

        it('error checking the url', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkUrl('url', function(err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check,  false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no services available', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkUrl('url', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check,  false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, [{url: 'url'}]);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkUrl('url', function(err, check) {
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

    describe('Function "newBuy"', function() {
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
        it('error adding the new buy information', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.newBuy(buyInformation, function(err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('new buy information added', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.newBuy(buyInformation, function(err, check) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getApiKeys"', function() {
        var sentence = 'SELECT apiKey, productId, orderId \
            FROM accounting \
            WHERE customer=$user';
        var params = {'$user': '0001'};

        it('error getting the api-keys', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, 'Error');
                    assert.equal(apiKeys, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no api-keys available', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
                    assert.equal(err, null);
                    assert.equal(apiKeys, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, ['apiKey1', 'apiKey2']);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getApiKeys('0001', function(err, apiKeys) {
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

    describe('Function "checkRequest"', function() {
        var sentence = 'SELECT customer \
            FROM accounting \
            WHERE apiKey=$apiKey';
        var params = {'$apiKey': 'apiKey1'}

        it('query error', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, 'Error');
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no information available', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('customer not associated with api-key', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, [{cutomer: '0007'}]);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
                    assert.equal(err, null);
                    assert.equal(check, false);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct (customer associated with api-key', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, [{customer: '0001'}]);
                }
            }
            mocker(implementations, function(db, spies) {
                db.checkRequest('0001', 'apiKey1', function(err, check) {
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

    describe('Function "getAccountingInfo"', function() {
        var sentence = 'SELECT accounting.unit, services.url, accounting.publicPath \
            FROM accounting , services \
            WHERE accounting.publicPath=services.publicPath AND apiKey=$apiKey';
        var params = { '$apiKey': 'apiKey'};

        it('query error', function(done) {
            var implementations = {
                all: function(sentences, params, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(accInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no accounting info available', function(done) {
            var implementations = {
                all: function(sentences, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
                    assert.equal(err, null);
                    assert.equal(accInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var accInfo = {
                unit: 'call', 
                url: 'url', 
                publicPath: '/public'
            }
            var implementations = {
                all: function(sentences, params, callback) {
                    return callback(null, accInfo);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getAccountingInfo('apiKey', function(err, accInfo) {
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

    describe('Function "getNotificationInfo"', function() {
        var sentence = 'SELECT apiKey, orderId, productId, customer, value, correlationNumber, recordType, unit \
            FROM accounting \
            WHERE value!=0';

        it('query error', function(done) {
            var implementations = {
                all: function(sentence, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('no info available', function(done) {
            var implementations = {
                all: function(sentence, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, null);
                    assert.equal(notificationInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });

        it('correct', function(done) {
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
                all: function(sentence, callback) {
                    return callback(null, notifInfo);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getNotificationInfo(function(err, notificationInfo) {
                    assert.equal(err, null);
                    assert.equal(notificationInfo, notifInfo);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    done();
                });
            });
        });
    });

    describe('Function "makeAccounting"', function() {
        var sentence = 'UPDATE accounting \
                    SET value=value+$amount \
                    WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': 'apiKey',
            '$amount': '1.5'
        }

        it('amount less than 0', function(done) {
            mocker({}, function(db, spies) {
                db.makeAccounting('apiKey', - 1.3, function(err) {
                    assert.equal(err, '[ERROR] The aomunt must be greater than 0');
                    done();
                });
            });
        });

        it('error in begin transaction', function(done) {
            var implementations = {
                beginTransaction: function(callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.3, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    done(); 
                });
            });
        });

        it('query error', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                },
                rollback: function() {}
            }
            var runSpy = sinon.spy(transaction, 'run');
            var rollbackSpy = sinon.spy(transaction, 'rollback');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.5, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(rollbackSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('commit error', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback(null);
                },
                commit: function(callback) {
                    return callback('Error');
                }
            }
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.5, function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('correct', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback(null);
                },
                commit: function(callback) {
                    return callback(null);
                }
            }
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.makeAccounting('apiKey', 1.5, function(err) {
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

    describe('Function "resetAccounting"', function() {
        var sentence = 'UPDATE accounting \
                SET value=0, correlationNumber=correlationNumber+1 \
                WHERE apiKey=$apiKey';
        var params = {
            '$apiKey': 'apiKey'
        }

        it('error begin transaction', function(done) {
            var implementations = {
                beginTransaction: function(callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    done(); 
                });
            });
        });

        it('query error', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                },
                rollback: function() {}
            }
            var runSpy = sinon.spy(transaction, 'run');
            var rollbackSpy = sinon.spy(transaction, 'rollback');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(rollbackSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('commit error', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback(null);
                },
                commit: function(callback) {
                    return callback('Error');
                }
            }
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.beginTransaction.callCount, 1);
                    assert.equal(runSpy.callCount, 1);
                    assert.deepEqual(runSpy.getCall(0).args[0], sentence);
                    assert.deepEqual(runSpy.getCall(0).args[1], params);
                    assert.equal(commitSpy.callCount, 1);
                    done(); 
                });
            });
        });

        it('correct', function(done) {
            var transaction = {
                run: function(sentence, params, callback) {
                    return callback(null);
                },
                commit: function(callback) {
                    return callback(null);
                }
            }
            var runSpy = sinon.spy(transaction, 'run');
            var commitSpy = sinon.spy(transaction, 'commit');
            var implementations = {
                beginTransaction: function(callback) {
                    return callback(null, transaction);
                }
            }
            mocker(implementations, function(db, spies) {
                db.resetAccounting('apiKey', function(err) {
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

    describe('Function "addCBSubscription"', function() {
        var sentence = 'INSERT OR REPLACE INTO subscriptions \
                VALUES ($subscriptionId, $apiKey, $notificationUrl)';
        var params = {
            '$subscriptionId': 'subscriptionId',
            '$apiKey': 'apiKey',
            '$notificationUrl': 'http://notification/url'
        }

        it('query error', function(done) {
            var implementations = {
                run: function(sentences, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.addCBSubscription('apiKey', 'subscriptionId', 'http://notification/url', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                run: function(sentences, params, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.addCBSubscription('apiKey', 'subscriptionId', 'http://notification/url', function(err) {
                    assert.equal(err, null);
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });
    });

    describe('Function "getCBSubscription"', function() {
        var sentence = 'SELECT subscriptions.apiKey, subscriptions.notificationUrl, accounting.unit \
            FROM subscriptions , accounting\
            WHERE subscriptions.apiKey=accounting.apiKey AND subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': 'subscriptionId'
        }

        it('query error', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback('Error', null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subscriptionId', function(err, subscriptionInfo) {
                    assert.equal(err, 'Error');
                    assert.equal(subscriptionInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('no subscription available', function(done) {
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, []);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subscriptionId', function(err, subscriptionInfo) {
                    assert.equal(err, null);
                    assert.equal(subscriptionInfo, null);
                    assert.equal(spies.all.callCount, 1);
                    assert.equal(spies.all.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.all.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var subsInfo = {
                apiKey: 'apiKey',
                notificationUrl: 'http://notification/url',
                unit: 'call'
            }
            var implementations = {
                all: function(sentence, params, callback) {
                    return callback(null, [subsInfo]);
                }
            }
            mocker(implementations, function(db, spies) {
                db.getCBSubscription('subscriptionId', function(err, subscriptionInfo) {
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

    describe('Function "deleteCBSubscription"', function() {
        var sentence = 'DELETE FROM subscriptions \
            WHERE subscriptionId=$subscriptionId';
        var params = {
            '$subscriptionId': 'subscriptionId'
        }

        it('query error', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback('Error');
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteCBSubscription('subscriptionId', function(err) {
                    assert.equal(err, 'Error');
                    assert.equal(spies.run.callCount, 1);
                    assert.equal(spies.run.getCall(0).args[0], sentence);
                    assert.deepEqual(spies.run.getCall(0).args[1], params);
                    done();
                });
            });
        });

        it('correct', function(done) {
            var implementations = {
                run: function(sentence, params, callback) {
                    return callback(null);
                }
            }
            mocker(implementations, function(db, spies) {
                db.deleteCBSubscription('subscriptionId', function(err) {
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
