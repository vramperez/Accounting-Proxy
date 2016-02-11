var http = require('http'),
    info = require('./HTTP_Client/info.json'),
    config = require('./config'),
    winston = require('winston')

var db = require(config.database);
var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'debug',
            filename: './log/all-log',
            colorize: false
        }),
        new winston.transports.Console({
            level: 'info',
            colorize: true
        })
    ],
    exitOnError: false
});

// Send notifications to the WStore
exports.notify = function(accounting_info) {
    if (accounting_info.num === 0){
        logger.log('debug', 'No request needed.');
    } else {
        logger.log('debug', 'Request needed.');
        db.getAccountingInfo(accounting_info.publicPath, {
            organization: accounting_info.organization,
            name: accounting_info.name,
            version: accounting_info.version
        }, function(err, acc) {

            if (err || acc === null) {
                logger.warn('Error while notifying')
            } else {
                info.offering = {
                    organization: accounting_info.organization,
                    name: accounting_info.name,
                    version: accounting_info.version
                };
                info.customer = accounting_info.actorID;
                info.time_stamp = (new Date()).toISOString();
                info.value = accounting_info.num.toString();
                info.correlation_number = accounting_info.correlation_number;
                info.record_type = acc.record_type;
                info.unit = acc.unit;
                info.component_label = acc.component_label;

                var body = JSON.stringify(info);

                var options = {
                    host: config.WStore.accounting_host,
                    port: config.WStore.accounting_port,
                    path: config.WStore.accounting_path + accounting_info.reference + '/accounting',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': body.length
                    }
                };

                var request = http.request(options, function(res) {
                    if (200 <= res.statusCode && res.statusCode <= 299) {
                        logger.log('Resquest worked!');
                        db.resetCount(accounting_info.actorID, accounting_info.API_KEY, accounting_info.publicPath, function(err) {
                            if (err) {
                                logger.warn('Error while reseting the account')
                            }
                        });
                    } else {
                        logger.warn('Resquest failed!');
                    }
                });
                request.write(body);
                request.end();
            }
        });
    }
};