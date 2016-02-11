var config_tests = {};

/*
* Integration tests configuration
*/
config_tests.integration = {
	
	// Databases used by integration tests. Possible values: 'sqlite3', 'redis'
	databases: ['sql', 'redis'],

    accounting_CB_port: 9020,
	accounting_port: 9030
}

module.exports = config_tests;