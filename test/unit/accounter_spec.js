var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon');

describe('Testing "Accounter"', function () {

    describe('Function "count"', function () {

        it('Invalid accounting unit, should return an error', function (done) {
            var unit = 'wrongUnit';
            var notifierStub = {
                acc_modules: {
                    unit1: {}
                }
            };
            var accounter = proxyquire('../../accounter', {
                './notifier': notifierStub
            });
            accounter.count('apiKey', unit, {}, 'count', function(err) {
                assert.equal(err, 'Invalid accounting unit "' + unit + '"');
                done();
            });
        });

        it('Accounting module should return an error', function (done) {
            var unit = 'unit1';
            var countFunction = 'count';
            var notifierStub = {
                acc_modules: {
                    unit1: {
                        count: function (countInfo, callback) {
                            return callback('Error', null);
                        }
                    }
                }
            };
            var countSpy = sinon.spy(notifierStub.acc_modules[unit], countFunction);
            var accounter = proxyquire('../../accounter', {
                './notifier': notifierStub
            });
            accounter.count('apiKey', unit, {}, countFunction, function (err) {
                assert.equal(err, 'Error');
                assert.equal(countSpy.callCount, 1);
                assert.deepEqual(countSpy.getCall(0).args[0], {});
                done();
            });
        });

        it('Database should return an error when making the accounting', function (done) {
            var apiKey = 'apiKey';
            var unit = 'unit1';
            var countFunction = 'count';
            var amount = 3.26;
            var configMock = { 
                database: { 
                    type: './db'
                } 
            };
            var dbMock = {
                makeAccounting: function (apiKey, amount, callback) {
                    return callback('Error', null);
                }
            };
            var notifierMock = {
                acc_modules: {
                    unit1: {
                        count: function (countInfo, callback) {
                            return callback(null, amount);
                        }
                    }
                }
            };
            var countSpy = sinon.spy(notifierMock.acc_modules[unit], countFunction);
            var makeAccountingSpy = sinon.spy(dbMock, 'makeAccounting');
            var accounter = proxyquire('../../accounter', {
                './db': dbMock,
                './notifier': notifierMock,
                './config': configMock
            });
            accounter.count(apiKey, unit, {}, countFunction, function (err) {
                assert.equal(err, 'Error');
                assert.equal(countSpy.callCount, 1);
                assert.deepEqual(countSpy.getCall(0).args[0], {});
                assert.equal(makeAccountingSpy.callCount, 1);
                assert.equal(makeAccountingSpy.getCall(0).args[0], apiKey, amount);
                done();
            });
        });

        it('Should not return an error, correct accounting', function (done) {
            var apiKey = 'apiKey';
            var unit = 'unit1';
            var countFunction = 'count';
            var amount = 3.26;
            var configMock = { 
                database: { 
                    type: './db'
                } 
            };
            var dbMock = {
                makeAccounting: function (apiKey, amount, callback) {
                    return callback(null, amount);
                }
            };
            var notifierMock = {
                acc_modules: {
                    unit1: {
                        count: function (countInfo, callback) {
                            return callback(null, amount);
                        }
                    }
                }
            };
            var countSpy = sinon.spy(notifierMock.acc_modules[unit], countFunction);
            var makeAccountingSpy = sinon.spy(dbMock, 'makeAccounting');
            var accounter = proxyquire('../../accounter', {
                './db': dbMock,
                './notifier': notifierMock,
                './config': configMock
            });
            accounter.count(apiKey, unit, {}, countFunction, function (err) {
                assert.equal(err, null);
                assert.equal(countSpy.callCount, 1);
                assert.deepEqual(countSpy.getCall(0).args[0], {});
                assert.equal(makeAccountingSpy.callCount, 1);
                assert.equal(makeAccountingSpy.getCall(0).args[0], apiKey, amount);
                done();
            });
        });
    });
});