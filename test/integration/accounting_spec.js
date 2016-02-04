var request = require('supertest'),
	assert = require('assert'),
	proxyquire = require('proxyquire'),
	redis_mock = require('fakeredis'),
	test_endpoint = require('./test_endpoint'),
	config_tests = require('../config_tests');

var server;
var mock_config = {
	database: './db_Redis'
}

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
test_endpoint.run();


describe('Testing the accounting API', function() {

	describe('generic REST use', function() {

		beforeEach(function() {
			var mock_config = {
				database: './db',
				database_name: 'testDB_accounting.sqlite'
			}
			db_mock = proxyquire('../../db', {
				'./config': mock_config
			});
			server = proxyquire('../../server', {
				'./config': mock_config,
				'./db': db_mock,
				'winston': logger_mock
			});
			db_mock.init();
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

		it('error (400) bad request (response from the service)', function(done) {
			// Refactor in a preparation function for tests
			db_mock.newService('/public', 'http://localhost/rest/example1', 9020, function(err) {
				if (err) {
					console.log('Error adding service');
					process.exit(1);
				} else {
					db_mock.addResource({
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/public',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}, function(err) {
						if (err) {
							console.log('Error');
							process.exit(1);
						} else {
							db_mock.addInfo('api_key1', {
								offering: {
									organization: 'test_org',
									name: 'test_name',
									version: '1.0'
								},
								reference: "000000000000002",
								customer: '0001',
								customer_name: 'user1',
								resources: [
									{
										provider: "provider1",
										name: "resource2",
										version: "1.0",
										content_type:"application/json",
										url: "http://localhost/public"
									}
								]
							}, function(err) {
								if (err) {
									console.log('Error adding new information');
									process.exit(1);
								} else {
									request(server.app)
										.post('/public1')
										.set('X-Actor-ID', 'wrong_actorID')
										.set('X-API-KEY', 'wrong_api_key')
										.expect(400, { error: 'bad request'}, done);
								}
							});
						}
					});
				}
			});
		});

		it('correct (200) correct response from the service');
	});

	describe('orion Context-Broker requests', function() {

	});
});
