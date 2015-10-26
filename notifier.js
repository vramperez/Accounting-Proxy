var http = require('http');
var db = require('./db_Redis.js');
var info = require('./HTTP_Client/info.json');
var config = require('./config');

exports.notify = function(data, callback) {

    if (data.num === 0){
        console.log('[LOG] NO request needed.');
        callback(data.API_KEY, data.publicPath, 0);
    } else {
        console.log('[LOG] Request needed.');
        db.getAccountingInfo(data.publicPath, {
            organization: data.organization,
            name: data.name,
            version: data.version
        }, function(acc) {

            if (acc === undefined)
                callback(data.API_KEY, data.publicPath, data.num);

            info.offering = {
                organization: data.organization,
                name: data.name,
                version: data.version
            };
            info.customer = data.actorID;
            info.time_stamp = (new Date()).toISOString();
            info.value = data.num.toString();
            info.correlation_number = data.correlation_number;
            info.record_type = acc.record_type;
            info.unit = acc.unit;
            info.component_label = acc.component_label;

            var body = JSON.stringify(info);

            var options = {
                host: config.WStore.accounting_host,
                port: config.WStore.accounting_port,
                path: config.WStore.accounting_path + data.reference + '/accounting',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': body.length
                }
            };

            var request = http.request(options, function(res) {
                if (200 <= res.statusCode && res.statusCode <= 299) {
                    console.log('[LOG] Resquest worked!');
                    db.resetCount(data.actorID, data.API_KEY, data.publicPath);
                    callback(data.API_KEY, data.publicPath, 0);
                } else {
                    console.log('[LOG] Resquest failed!');
                    callback(data.API_KEY, data.publicPath, data.num);
                }
            });
            request.write(body);
            request.end();
        });
    }
};
