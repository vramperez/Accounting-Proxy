var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon'),
    data = require('../data');

var getAccounter = function (implementations) {
    return proxyquire('../../accounter', {
        './server': implementations.server,
        './config': implementations.config,
        './db': implementations.db
    });
}

describe('Testing "Accounter"', function () {

    describe('Function "count"', function () {

        var testCount = function (accUnit, countErr, makeAccountingErr, done) {

            var unit = accUnit ? accUnit : data.DEFAULT_UNIT;
            var apiKey = data.DEFAULT_API_KEYS[0];
            var countFunction = 'count';
            var amount = 2.369;
            var countInfo = {};

            var count = function (countInfo, callback) {
                return callback(countErr, amount);
            };

            var db = {
                makeAccounting: function (apiKey, amount, callback) {
                    return callback(makeAccountingErr);
                }
            };

            var accountingModules = {};
            accountingModules[data.DEFAULT_UNIT] = {};
            accountingModules[data.DEFAULT_UNIT][countFunction] = count;

            var config = {
                database: {
                    type: './db'
                }
            };

            var server = {
                accountingModules: accountingModules
            };

            if (!accUnit) {
                var countStub = sinon.spy(accountingModules[data.DEFAULT_UNIT], countFunction);
            }

            var makeAccountingStub = sinon.spy(db, 'makeAccounting');

            var implementations = {
                db: db,
                server: server,
                config: config
            };

            var accounter = getAccounter(implementations);

            accounter.count(apiKey, unit, countInfo, countFunction, function (err) {

                if (accUnit) {

                    assert.equal(err, 'Invalid accounting unit "' + unit + '"');
                } else {

                    assert(countStub.calledWith(countInfo));

                    if (countErr) {
                        assert.equal(err, countErr);
                    } else {

                        assert(makeAccountingStub.calledWith(apiKey, amount));

                        var errorExpected = makeAccountingErr ? makeAccountingErr : null ;

                        assert.equal(err, errorExpected);
                    }
                }

                done();
            });
        };

        it('should return an error when the accounting unit is not valid', function (done) {
            testCount('wrong', 'Error', null, done);
        });

        it('should call the callback with error when the accounting module fails', function (done) {
            testCount(null, 'Error', null, done);
        });

        it('should call the callback with error when db fails making the accounting', function (done) {
           testCount(null, null, 'Error', done); 
        });

        it('should call the callback without error when the db makes the accounting', function (done) {
            testCount(null, null, null, done);
        });
    });
});