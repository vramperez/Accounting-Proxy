var config_tests = {};

/*
* Integration tests configuration
*/
config_tests.integration = {
	
	// Databases used by integration tests. Possible values: 'sqlite3', 'redis'
	databases: ['sql', 'redis'],

    // Database used by redis to test.
    database_redis: 15,

    accounting_CB_port: 9020,
	accounting_port: 9030,
}

module.exports = config_tests;