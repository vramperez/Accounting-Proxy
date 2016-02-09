var config_tests = {};

/*
* Integration tests configuration
*/
config_tests.integration = {
	
	// Databases used by integration tests. Possible values: 'sqlite3', 'redis'
	databases: ['sql', 'redis'],

	endpoint: {
		port: 9020
	}
}

module.exports = config_tests;