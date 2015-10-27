
exports.count = function(response, callback) {

    callback(undefined, Buffer.byteLength(response, 'utf8') / Math.pow(1024, 2));


};
