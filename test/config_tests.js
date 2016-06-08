var config_tests = {};

/*
* Integration tests configuration
*/
config_tests.integration = {
	
	// Databases used by integration tests. Possible values: 'sqlite', 'redis'
	databases: ['sql', 'redis'],

    // Database used by redis to test.
    redis_database: 15,

    redis_host: 'localhost',
    redis_port: 6379,

    accounting_proxy_port: 9010,

    test_endpoint_port: 9020,

    subscriptionId: '51c0ac9ed714fb3b37d7d5a8'
};

module.exports = config_tests;