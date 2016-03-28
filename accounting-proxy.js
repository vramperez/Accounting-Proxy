var mkdirp = require('mkdirp'),
    server = require('./server'),
    async = require('async'),
    logger = require('winston');

"use strict";

// Create directory ./log if not exists
mkdirp('./log', function(err) {
    if (err) {
        logger.error('Error creating "./log" path');
    }
});

// Start the accounting proxy
server.init(function(err){
    if (err) {
        logger.error(err);
        process.exit(1);
    }
});