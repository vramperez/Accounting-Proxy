var request = require('supertest'),
	assert = require('assert'),
	proxyquire = require('proxyquire'),
	redis_mock = require('fakeredis'),
	test_endpoint = require('./test_endpoint'),
	config_tests = require('../config_tests'),
	async = require('async'),
	databases = require('../config_tests').integration.databases,
	fs = require('fs'),
	prepare_test = require('./prepareDatabase');

var server, db_mock;
var mock_config = {};

var logger_mock = { // Avoid display server information while running the tests
	Logger: function(transports) {
		return {
			log: function(level, msg) {},
			info: function(msg) {},
			warn: function(msg) {},
			error: function(msg) {}
		} 
	}
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(config_tests.integration.accounting_port);

var api_mock = {
	run: function(){}
}
var notifier_mock = {
	notify: function(info) {}
}

var mocker = function(database) {
	switch (database) {
		case 'sql':
			mock_config = {
				database: './db',
				database_name: 'testDB_accounting.sqlite'
			}
			db_mock = proxyquire('../../db', {
				'./config': mock_config
			});
			server = proxyquire('../../server', {
				'./config': mock_config,
				'./db': db_mock,
				'./APIServer': api_mock,
				'./notifier': notifier_mock,
				'winston': logger_mock
			});
			db_mock.init();
			break;
		case 'redis':
			mock_config = {
				database: './db_Redis'
			}
			db_mock = proxyquire('../../db_Redis', {
				'redis': require('fakeredis')
			});
			server = proxyquire('../../server', {
				'./config': mock_config,
				'./db_Redis': db_mock,
				'./APIServer': api_mock,
				'./notifier': notifier_mock,
				'winston': logger_mock
			});
			break;
	}
}


describe('Testing the accounting API', function() {

	describe('generic REST use', function() {

		async.each(databases, function(database, task_callback) {

			describe('with database ' + database, function() {

				beforeEach(function() {
					mocker(database);
				});

				after(function() {
					// Remove the database for testing
					fs.access('./testDB_accounting.sqlite', fs.F_OK, function(err) {
						if (!err) {
							fs.unlinkSync('./testDB_accounting.sqlite');
						}
					});
					task_callback();
				});

				it('error (400) undefined "X-Actor-ID" header', function(done) {
					request(server.app)
						.post('/public')
						.expect(400, { error: 'Undefined "X-Actor-ID" header' }, done);
				});

				it('error (400) undefined "X-API-KEY" header', function(done) {
					request(server.app)
						.post('/public')
						.set('X-Actor-ID', 'actor_id')
						.expect(400, { error: 'Undefined "X-API-KEY" header' }, done);
				});

				it('error (401) invalid API_KEY, user or path', function(done) {
					request(server.app)
						.post('/public')
						.set('X-Actor-ID', 'wrong_actorID')
						.set('X-API-KEY', 'wrong_api_key')
						.expect(401, { error: 'Invalid API_KEY, user or path' }, done);
				});

				it('correct (200) response from the service, call accounting', function(done) {
					var services = [{
						path: '/public',
						url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/example1'
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/public',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/public': {
									num: 0,
									correlation_number: '0002'
								}
							}
						}
					}];
					prepare_test.addToDatabase(db_mock, services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.get('/public')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.expect(200, function() {
									db_mock.getNotificationInfo('api_key1', '/public', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									})
								});
						}
					});
				});

				it('correct (200) response from the service, megabyte accounting', function(done) {
					var services = [{
						path: '/public',
						url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/example2'
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/public',
						record_type: 'rec_type',
						unit: 'megabyte',
						component_label: 'megabyteCounting'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/public': {
									num: 0,
									correlation_number: '0002'
								}
							}
						}
					}];
					prepare_test.addToDatabase(db_mock, services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.get('/public')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.expect(200, function() {
									db_mock.getNotificationInfo('api_key1', '/public', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 0.00000858306884765625);
											done();
										}
									})
								});
						}
					});
				});

				it('error (400) response from the service', function(done) {
					var services = [{
						path: '/public',
						url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/wrong'
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/public',
						record_type: 'rec_type',
						unit: 'megabyte',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/public': {
									num: 0,
									correlation_number: '0002'
								}
							}
						}
					}];
					prepare_test.addToDatabase(db_mock, services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.get('/public')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.expect(400, function() {
									db_mock.getNotificationInfo('api_key1', '/public', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 0.00000858306884765625);
											done();
										}
									});
								});
						}
					});
				});
			});
		});
	});
});
