
exports.count = function(request, response, headers, callback) {

    callback(undefined, Buffer.byteLength(response, 'utf8') / Math.pow(1024, 2));


};
