var mkdirp = require('mkdirp'),
    server = require('./server');

mkdirp('./log', function(err) {
    if (err) {
        logger.info('Error creating "./log" path');
    }
});

server.init(function(err) {
    if (err) {
        logger.error(err);
        process.exit();
    }
});

module.exports.logger = logger;