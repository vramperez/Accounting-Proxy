var notifier = require('./notifier'),
    config = require('./config');

var db = require(config.database.type);
var acc_modules = notifier.acc_modules;

/**
 * Makes the accounting for the specified unit and accounting function.
 *
 * @param  {string}   apiKey        Purchase identifier.
 * @param  {string}   unit          Accounting unit.
 * @param  {Object}   countInfo     Information for calculate the accounting value.
 * @param  {string}   countFunction Name of the count function in the accounting module.
 */
var count = function (apiKey, unit, countInfo, countFunction, callback) {
    if (acc_modules[unit] === undefined) {
        return callback('Invalid accounting unit "' + unit + '"');
    } else {
        acc_modules[unit][countFunction](countInfo, function (err, amount) {
            if (err) {
                return callback (err);
            } else {
                db.makeAccounting(apiKey, amount, function (err) {
                    if (err) {
                        return callback(err);
                    } else {
                        return callback(null);
                    }
                });
            }
        });
    }
}

exports.count = count;