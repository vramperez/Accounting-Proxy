var winston = require('winston'),
    mkdirp = require('mkdirp');

var logger = new winston.Logger( {
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

mkdirp('./log', function(err) {
    if (err) {
        logger.info('Error creating "./log" path');
    }
});

module.exports.logger = logger;

require('./server').init(function(err) {
    if (err) {
        logger.error(err);
        process.exit();
    }
});