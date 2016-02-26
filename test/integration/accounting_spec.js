var request = require('supertest'),
	assert = require('assert'),
	proxyquire = require('proxyquire').noCallThru(),
	redis_mock = require('fakeredis'),
	test_endpoint = require('./test_endpoint'),
	config_tests = require('../config_tests'),
	async = require('async'),
	test_config = require('../config_tests').integration,
	fs = require('fs'),
	prepare_test = require('./prepareDatabase'),
	redis = require('redis');

var server, db_mock;

var mock_config = {
	accounting_proxy: {
		port: 9000
	},
	resources: {
		contextBroker: false
	},
	database: {}
};

var api_mock = {
	run: function(){}
}

var notifier_mock = {
	notify: function(info, callback) {}
}

var log_mock = {
	log: function(level, msg) {},
	info: function(msg) {},
	warn: function(msg) {},
	error: function(msg) {}
}

var mocker = function(database) {
	switch (database) {
		case 'sql':
			mock_config.database.type = './db';
			mock_config.database.name = 'testDB_accounting.sqlite';
			db_mock = proxyquire('../../db', {
				'./config': mock_config
			});
			break;
		case 'redis':
			mock_config.database.type = './db_Redis';
            mock_config.database.name = test_config.database_redis;
			db_mock = proxyquire('../../db_Redis', {
				'./config': mock_config
			});
			break;
	}
	server = proxyquire('../../server', {
		'./config': mock_config,
		'./db': db_mock,
		'./APIServer': api_mock,
		'./notifier': notifier_mock,
		'winston': {
			Logger: function(transports) {
                return log_mock;
            },
            transports: {
                File: function(params) {},
                Console: function(params) {}
            }
		}, // Not display logger messages while testing
		'./orion_context_broker/db_handler': {}
	});
	db_mock.init(function(err) {
		if (err) {
			console.log('Error initializing the database');
            process.exit(1);
		}
	});
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run(config_tests.integration.accounting_port);

async.each(test_config.databases, function(database, task_callback) {

	describe('Testing the accounting API. Generic REST use', function() {
		

		before(function() {
			mocker(database);
		});

		/**
		 * Remove the database used for testing.
		 */
		after(function(task_callback) {
		 	if (database === 'sql') {
		 		fs.access('./testDB_accounting.sqlite', fs.F_OK, function(err) {
		 			if (!err) {
		 				fs.unlinkSync('./testDB_accounting.sqlite');
		 			}
		 		});
		 		task_callback();
		 	} else {
		 		var client = redis.createClient();
		 		client.select(test_config.database_redis, function(err) {
		 			if (err) {
		 				console.log('Error deleting redis database');
		 				task_callback();
		 			} else {
		 				client.flushdb();
		 				task_callback();
		 			}
		 		});
		 	} 
		});

		describe('with database ' + database, function() {

			it('undefined header "X-Actor-ID" (401)', function(done) {
				request(server.app)
				.get('/private')
				.expect(401, { error: 'Undefined "X-Actor-ID" header'}, done);
			});

			it('undefined header "X-API-KEY" (401)', function(done) {
				request(server.app)
				.get('/private')
				.set('X-Actor-ID', '0001')
				.expect(401, { error: 'Undefined "X-API-KEY" header'}, done);
			});

			it('invalid apiKey (401)', function(done) {
				var services = [{ publicPath: '/public1', url: 'http://localhost:9000/private1'}];
				var buys = [{
					apiKey: 'apiKey1',
					publiPath: '/public1',
					orderId: 'orderId1',
					productId: 'productId1',
					customer: '0001',
					unit: 'call',
					recordType: 'callusage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get('/private')
						.set('X-Actor-ID', '0001')
						.set('X-API-KEY', 'wrong')
						.expect(401, { error: 'Invalid API_KEY or user'}, done);
					}
				});
			});

			it('invalid user (401)', function(done) {
				var services = [{ publicPath: '/public2', url: 'http://localhost:9000/private2'}]
				var buys = [{
					apiKey: 'apiKey2',
					publiPath: '/public2',
					orderId: 'orderId2',
					productId: 'productId2',
					customer: '0002',
					unit: 'call',
					recordType: 'callusage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get('/private')
						.set('X-Actor-ID', 'wrong')
						.set('X-API-KEY', 'apiKey1')
						.expect(401, { error: 'Invalid API_KEY or user'}, done);
					}
				});
			});

			it('invalid path (400)', function(done) {
				var services = [ { publicPath: '/public3', url: 'http://localhost:9000/private3' } ];
				var buys = [{
					apiKey: 'apiKey3',
					publicPath: '/public3',
					orderId: 'orderId3',
					productId: 'productId3',
					customer: '0003',
					unit: 'call',
					recordType: 'callusage'
				}];
				var path = '/wrong';
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get(path)
						.set('X-Actor-ID', '0003')
						.set('X-API-KEY', 'apiKey3')
						.expect(400, { error: 'Invalid public path ' + path}, done);
					}
				});
			});

			it('error sending request to the endpoint (504)', function(done) {
				var services = [{ publicPath: '/public4', url: 'wrong_url' } ];
				var buys = [{
					apiKey: 'apiKey4',
					publicPath: '/public4',
					orderId: 'orderId4',
					productId: 'productId4',
					customer: '0004',
					unit: 'call',
					recordType: 'callusage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get(services[0].publicPath)
						.set('X-Actor-ID', '0004')
						.set('X-API-KEY', 'apiKey4')
						.expect(504, done);
					}
				});
			});

			it('correct (200) response and accounting (call unit)', function(done) {
				var services = [{ publicPath: '/public5', url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/call' } ];
				var buys = [{
					apiKey: 'apiKey5',
					publicPath: '/public5',
					orderId: 'orderId5',
					productId: 'productId5',
					customer: '0005',
					unit: 'call',
					recordType: 'callusage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get(services[0].publicPath)
						.set('X-Actor-ID', '0005')
						.set('X-API-KEY', 'apiKey5')
						.expect(200, function() {
							db_mock.getNotificationInfo(function(err, accInfo) {
								assert.equal(err, null);
								assert.deepEqual(accInfo[0], {
									apiKey: 'apiKey5',
									correlationNumber: '0',
									customer: '0005',
									orderId: 'orderId5',
									productId: 'productId5',
									recordType: 'callusage',
									unit: 'call',
									value: '1'
								});
								done();
							});
						});
					}
				});
			});

			it('correct (200) response and accounting (megabyte unit)', function(done) {
				var services = [{ publicPath: '/public6', url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/megabyte' } ];
				var buys = [{
					apiKey: 'apiKey6',
					publicPath: '/public6',
					orderId: 'orderId6',
					productId: 'productId6',
					customer: '0006',
					unit: 'megabyte',
					recordType: 'datausage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get(services[0].publicPath)
						.set('X-Actor-ID', '0006')
						.set('X-API-KEY', 'apiKey6')
						.expect(200, function() {
							db_mock.getNotificationInfo(function(err, accInfo) {
								async.each(accInfo, function(acc, task_callback) {
									if (acc.apiKey === buys.apiKey) {
										assert.equal(err, null);
										assert.deepEqual(acc, {});
										task_callback();
									} else {
										task_callback();
									}
								}, function() {
									done();
								});
							});
						});
					}
				});
			});

			it('error (500) making the accounting (invalid unit)', function(done) {
				var services = [{ publicPath: '/public7', url: 'http://localhost:' + config_tests.integration.accounting_port + '/rest/call' } ];
				var buys = [{
					apiKey: 'apiKey7',
					publicPath: '/public7',
					orderId: 'orderId7',
					productId: 'productId7',
					customer: '0007',
					unit: 'wrong',
					recordType: 'datausage'
				}];
				prepare_test.addToDatabase(db_mock, services, buys, [], function(err) {
					if (err) {
						console.log('Error preparing the database');
						process.exit(1);
					} else {
						request(server.app)
						.get(services[0].publicPath)
						.set('X-Actor-ID', '0007')
						.set('X-API-KEY', 'apiKey7')
						.expect(500, done);
					}
				});
			});
		});
	});
});