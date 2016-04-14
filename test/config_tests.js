var config_tests = {};

/*
* Integration tests configuration
*/
config_tests.integration = {
	
	// Databases used by integration tests. Possible values: 'sqlite', 'redis'
	databases: ['redis', 'sql'],

    // Database used by redis to test.
    redis_database: 15,

    redis_host: 'localhost',
    redis_port: 6379,

    accounting_CB_port: 9020,
	accounting_port: 9030,
    usageAPI_port: 9040
};

module.exports = config_tests;