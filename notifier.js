var http = require('http'),
    info = require('./HTTP_Client/info.json'),
    config = require('./config');

var db = require(config.database);


// Send notifications to the WStore
exports.notify = function(accounting_info) {
    if (accounting_info.num === 0){
        console.log('[LOG] NO request needed.');
    } else {
        console.log('[LOG] Request needed.');
        db.getAccountingInfo(accounting_info.publicPath, {
            organization: accounting_info.organization,
            name: accounting_info.name,
            version: accounting_info.version
        }, function(err, acc) {

            if (err || acc === null) {
                console.log('[ERROR] Error while notifying')
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
                        console.log('[LOG] Resquest worked!');
                        db.resetCount(accounting_info.actorID, accounting_info.API_KEY, accounting_info.publicPath, function(err) {
                            if (err) {
                                console.log('[ERROR] Error while reseting the account')
                            }
                        });
                    } else {
                        console.log('[LOG] Resquest failed!');
                    }
                });
                request.write(body);
                request.end();
            }
        });
    }
};