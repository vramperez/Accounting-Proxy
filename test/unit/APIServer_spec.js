var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var mocker = function(implementations, callback) {
	var spies = {
		app: {},
		db: {},
		req: {},
		res: {}
	};
	var api_server;
	// Define default mockers
	var mocks = {
		app: {
			set: function(prop, value) {},
			use: function(middleware) {},
			post: function(path, handler) {},
			get: function(path, handler) {},
		},
		db: {},
		req: {},
		res: {}
	};
	// Complete app_mock implementation and add spies
	async.each(Object.keys(implementations), function(obj, task_callback1) {
		async.each(Object.keys(implementations[obj]), function(implem, task_callback2) {
			if (implementations[obj][implem] != undefined) {
				mocks[obj][implem.toString()] = implementations[obj][implem.toString()];
				if (obj == 'req' || obj == 'res') {
					spies[obj][implem.toString()] = sinon.spy(implementations[obj], implem.toString());
				} else {
					spies[obj][implem.toString()] = sinon.spy(mocks[obj], implem.toString());
				}
				task_callback2();
			} else {
				task_callback2();
			}
		}, function() {
			return task_callback1();
		});
	}, function() {
		api_server = proxyquire('../../APIServer', {
			express: function() {
				return mocks.app;
			},
			'./db': mocks.db,
			'./db_Redis': mocks.db
		});
		return callback(api_server, spies);
	});
}

describe('Testing APIServer', function() {

	describe('run', function() {
		var implementations;

		it('correct', function() {
			implementations = {
				app: {
					listen: function(port){},
					get: function(prop){ return 'prop'}
				}
			}
			mocker(implementations, function(api_server_mock, spies) {
				api_server_mock.run();
				assert.equal(spies.app.listen.callCount, 1);
				assert.equal(spies.app.get.callCount, 2);
				assert.equal(spies.app.get.getCall(1).args[0], 'port');
			});
		});
	});

	describe('newResourceHandler', function() {

	});

	describe('newBuyHandler', function() {

	});

	describe('keysHandler', function() {
		var implementations;

		it("error (400), missed header 'X-Actor-ID'", function(done) {
			implementations = {
				req: {
					get: function(header) {
						return undefined;
					}
				},
				res: {
					status: function(stat) {
						return this;
					},
					send: function() {}
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			};
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('error, get info from db failed', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return '0001';
					}
				},
				res: {
					status: function(stat) {
						return this;
					},
					send: function() {}
				},
				db: {
					getInfo: function(user, callback) {
						return callback('Error', null);
					}
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				done();
			});
		});

		it('correct, one api_key information available', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return '0001';
					}
				},
				res: {
					status: function(stat) {
						return this;
					},
					send: function() {},
					json: function(body) {}
				},
				db: {
					getInfo: function(user, callback) {
						return callback(null, [{
							API_KEY: 'api_key',
							organization: 'organization',
							name: 'name',
							version: 1.0
						}]);
					}
				},
				app: {
					get: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				}
			}
			mocker(implementations, function(api_server, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.res.status.callCount, 0);
				assert.equal(spies.res.send.callCount, 0);
				assert.deepEqual(spies.res.json.getCall(0).args[0], [ { 
					offering: { 
						organization: 'organization',
						name: 'name',
						version: 1
					},
    				API_KEY: 'api_key' } ]);
				done();
			});
		});

		it('correct, two api_keys information available');
	});
});