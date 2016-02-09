var request = require('supertest'),
	assert = require('assert'),
	proxyquire = require('proxyquire'),
	databases = require('../config_tests').integration.databases,
	async = require('async'),
	api_server,
	db_mock,
	mock_config = {
		modules: {
			accounting: [ 'call', 'megabyte']
		}
	};

var argv = process.argv;

var resource = {
    offering: {
        organization: "aa",
        name: "bb",
        version: "1"
    },
    provider: "provider1",
    name: "resource2",
    version: "1.0",
    content_type:"application/json",
    url: "http://www.resource2.org/public",
    record_type: "event",
    unit: "call",
    component_label: "callusage"
}

var offer = {
	offering: {
		organization: "aa",
		name: "bb",
		version: "1"
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
			url: "http://www.resource2.org/public"
		}
	]
}

var prepare_tests = function(database) {
	switch (database) {
		case 'sql':
			mock_config.database = './db';
			mock_config.database_name = 'testDB_administration.sqlite1';
			db_mock = proxyquire('../../db', {
				'./config': mock_config
			});
			api_server = proxyquire('../../APIServer', {
				'./config': mock_config,
				'./db': db_mock
			});
			db_mock.init();
			break;
		case 'redis':
			mock_config.database = './db_Redis';
			db_mock = proxyquire('../../db_Redis', {
				'redis': require('fakeredis')
			});
			api_server = proxyquire('../../APIServer', {
				'./config': mock_config,
				'./db_Redis': db_mock
			});
			break;
	}
}

describe('Testing the administration API', function(done) {

	async.each(databases, function(database, task_callback) {

		describe('with database: ' + database, function() {

			describe('[POST: /api/resources] newResource request', function() {

				beforeEach(function() { // Mock the database
					prepare_tests(database);
				});

				after(function() {
					// Remove the database for testing
					fs.access('testDB_administration.sqlite1', fs.F_OK, function(err) {
						if (!err) {
							fs.unlinkSync('testDB_administration.sqlite1');
						}
					});
				})

				it('error (415) no json content-type', function(done) {
					request(api_server.app)
						.post('/api/resources')
						.set('content-type', 'text/html')
						.expect(415, { error: 'Content-Type must be "application/json"' }, done);
				});

				it('error (400) invalid body (undefined unit)', function(done) {
					this.resource = JSON.parse(JSON.stringify(resource));
					this.resource.unit = undefined;
					request(api_server.app)
						.post('/api/resources')
						.set('content-type', 'application/json')
						.send(this.resource)
						.expect(400, { error: 'Invalid json' }, done);
				});

				it('error (400) invalid body (wrong path)', function(done) {
					this.resource = JSON.parse(JSON.stringify(resource));
					this.resource.url = "http://www.resource2.org/no_exist"
					request(api_server.app)
						.post('/api/resources')
						.set('content-type', 'application/json')
						.send(this.resource)
						.expect(400, { error: 'Invalid path in the url specified in the body' }, done);
				});

				it('error (400) unsupported accounting unit', function(done) {
					var resource_copy = JSON.parse(JSON.stringify(resource));
					resource_copy.unit = 'no_exist';
					db_mock.newService('/public', 'http://localhost/private', 9010, function(err) {
						if (err) {
							console.log('Error creating new service');
							process.exit(1);
						} else {
							request(api_server.app)
								.post('/api/resources')
								.set('content-type', 'application/json')
								.send(resource_copy)
								.expect(400, { error: 'Unsupported accounting unit' }, done);
						}
					});
				});

				it('correct (201) successfully created', function(done) {
					var resource_copy = JSON.parse(JSON.stringify(resource));
					db_mock.newService('/public', 'http://localhost/private', 9010, function(err) {
						if (err) {
							console.log('Error creating new service');
							process.exit(1);
						} else {
							request(api_server.app)
								.post('/api/resources')
								.set('content-type', 'application/json')
								.send(resource_copy)
								.expect(201, done);
						}
					});
				});
			});

			describe('[POST: /api/users] newBuy request', function() {

				before(function() { // Mock the database
					prepare_tests(database);
				});

				it('error (415) no json content-type', function(done) {
					this.offer = JSON.parse(JSON.stringify(offer));
					request(api_server.app)
						.post('/api/users')
						.set('content-type', 'text/html')
						.send(JSON.stringify(this.offer))
						.expect(415, done);
				});

				it('error (400) invalid path in the offer', function(done) {
					this.offer = JSON.parse(JSON.stringify(offer));
					this.offer.customer = 'another_customer';
					this.offer.resources[0].url = 'http://localhost/no_exist'

					request(api_server.app)
						.post('/api/users')
						.set('content-type', 'application/json')
						.send(JSON.stringify(this.offer))
						.expect(400, { error: 'Invalid path in the resource' }, done);
				});

				it('error (400) invalid body', function(done) {
					request(api_server.app)
						.post('/api/users')
						.set('content-type', 'application/json')
						.send(JSON.stringify({}))
						.expect(400, { error: 'Invalid json' }, done);
				});

				it('correct (201) offer already bought', function(done) {
					var offer_copy = JSON.parse(JSON.stringify(offer));
					db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd051', {
						actorID: '0001',
						organization: offer_copy.offering.organization,
						name: offer_copy.offering.name,
						version: offer_copy.offering.version,
						accounting: {
							'/public' : {
								url: 'http://localhost/private',
								port: 9010,
								num: 0,
								correlation_number: 0,
								unit: 'megabyte'
							}
						},
						reference: 'ref'
					}, function(err) {
						if (err) {
							console.log('Error adding information');
							process.exit(1);
						} else {
							request(api_server.app)
								.post('/api/users')
								.set('content-type', 'application/json')
								.send(JSON.stringify(offer_copy))
								.expect(201, {}, done);
						}
					});
				});

				it('correct (201) new buy', function(done) {
					var offer_copy = JSON.parse(JSON.stringify(offer));
					db_mock.newService('/public', 'http://localhost/private', 9010, function(err) {
						if (err) {
							console.log('Error creating new service');
							process.exit(1);
						} else {
							db_mock.addResource( {
								offering: offer_copy.offering,
								publicPath: '/public',
								record_type: resource.record_type,
								unit: resource.unit,
								component_label: resource.component_label
							}, function(err) {
								if (err) {
									console.log('Error adding resource');
									process.exit(1);
								} else {
									request(api_server.app)
										.post('/api/users')
										.set('content-type', 'application/json')
										.send(JSON.stringify(offer_copy))
										.expect(201, {}, done);
								}
							});
						}
					});
				});

			});

			describe('[GET: /api/users/keys] get ApiKeys request', function() {

				beforeEach(function() { // Mock the database
					prepare_tests(database);
				});


				it('error (400) "X-Actor-ID" header missed', function(done) {
					request(api_server.app)
						.get('/api/users/keys')
						.expect(400, {error: 'Header "X-Actor-ID" missed'}, done);
				});

				it('error (400) wrong user', function(done) {
					request(api_server.app)
						.get('/api/users/keys')
						.set('X-Actor-ID', 'wrong')
						.expect(400, {error: 'No data available for that user'}, done);
				});

				it('correct (200) one api_key', function(done) {
					this.resource = JSON.parse(JSON.stringify(resource));

					db_mock.addResource( {
						offering: this.resource.offering,
						publicPath: '/public',
						unit: this.resource.unit,
						component_label: this.resource.component_label
					}, function(err) {
						if (err) {
							console.log('Error adding resource');
							process.exit(1);
						}
					});
					db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd051', {
						actorID: '0001',
						organization: this.resource.offering.organization,
						name: this.resource.offering.name,
						version: this.resource.offering.version,
						accounting: {
							'/public' : {
								url: 'http://localhost/private',
								port: 9010,
								num: 0,
								correlation_number: 0,
								unit: 'megabyte'
							}
						},
						reference: 'ref'
					}, function(err) {
						if (err) {
							console.log('Error adding the accounting information');
							process.exit(1);
						}
					});
					request(api_server.app)
					.get('/api/users/keys')
					.set('X-Actor-ID', '0001')
					.expect(200, 
						[ { offering: { organization: 'aa', name: 'bb', version: '1' },
						API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd051' } ],
						done);
				});

				it('correct (200) two api_keys', function(done) {
					this.resource = JSON.parse(JSON.stringify(resource));

					db_mock.addResource( {
						offering: this.resource.offering,
						publicPath: '/public',
						unit: this.resource.unit,
						component_label: this.resource.component_label
					}, function(err) {
						if (err) {
							console.log('Error adding resource');
							process.exit(1);
						}
					});
					db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd052', {
						actorID: '0002',
						organization: this.resource.offering.organization,
						name: this.resource.offering.name,
						version: this.resource.offering.version,
						accounting: {
							'/public' : {
								url: 'http://localhost/private',
								port: 9010,
								num: 0,
								correlation_number: 0,
								unit: 'megabyte'
							}
						},
						reference: 'ref'
					}, function(err) {
						if (err) {
							console.log('Error adding the accounting information');
							process.exit(1);
						}
					});
					db_mock.addInfo('aa610c1ee9b2c9e1295f32a9a45dd992851fd053', {
						actorID: '0002',
						organization: this.resource.offering.organization,
						name: this.resource.offering.name,
						version: this.resource.offering.version,
						accounting: {
							'/public2' : {
								url: 'http://localhost/private',
								port: 9010,
								num: 0,
								correlation_number: 0,
								unit: 'megabyte'
							}
						},
						reference: 'ref'
					}, function(err) {
						if (err) {
							console.log('Error adding the accounting information');
							process.exit(1);
						}
					});

					request(api_server.app)
						.get('/api/users/keys')
						.set('X-Actor-ID', '0002')
						.expect(200, [ 
							{ offering: { organization: 'aa', name: 'bb', version: '1' },
							API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd052' },
							{ offering: { organization: 'aa', name: 'bb', version: '1' },
							API_KEY: 'aa610c1ee9b2c9e1295f32a9a45dd992851fd053' } ], done);
				});
			});
		});
		task_callback();
	});	
});