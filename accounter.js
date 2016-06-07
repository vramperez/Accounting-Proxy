var config = require('./config');

var db = require(config.database.type);

/**
 * Makes the accounting for the specified unit and accounting function.
 *
 * @param  {string}   apiKey        Purchase identifier.
 * @param  {string}   unit          Accounting unit.
 * @param  {Object}   countInfo     Information for calculate the accounting value.
 * @param  {string}   countFunction Name of the count function in the accounting module.
 */
var count = function (apiKey, unit, countInfo, countFunction, callback) {
    var accountingModules = require('./server').getAccountingModules();

    if (accountingModules[unit] === undefined) {
        return callback({
            code: 'invalidUnit',
            msg: 'Invalid accounting unit "' + unit + '"'
        });

    } else if (accountingModules[unit][countFunction] === undefined) {
        return callback({
            code: 'invalidFunction',
            msg: 'Invalid count function "' + countFunction + '" for unit "' + unit + '"'
        });

    } else {

        accountingModules[unit][countFunction](countInfo, function (err, amount) {

            if (err) {
                return callback ({
                    code: 'functionError',
                    msg: err
                });

            } else {
                db.makeAccounting(apiKey, amount, function (err) {

                    if (err) {
                        return callback({
                            code: 'dbError',
                            msg: err
                        });
                    } else {
                        return callback(null);
                    }
                });
            }
        });
    }
};

exports.count = count;