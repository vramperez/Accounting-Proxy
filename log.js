var logger = require('winston'),
    config = require('./config');

// Add file transport for log.
logger.add(logger.transports.File, {
    level: 'debug',
    filename: config.log.file,
    colorize: false
});

module.exports = logger.cli();