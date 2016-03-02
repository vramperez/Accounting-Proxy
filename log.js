var logger = require('winston');

// Add file transport for log.
logger.add(logger.transports.File, {
    level: 'debug',
    filename: './log/all-log',
    colorize: false
});

module.exports = logger;