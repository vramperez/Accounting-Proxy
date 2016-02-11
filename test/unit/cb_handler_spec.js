var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var mocker = function(implementations, callback) {
	var mocks, spies, cb_handler;

	// Create mocks and spies
	var log_mock = {
		log: function(level, msg) {},
		info: function(msg) {},
		warn: function(msg) {},
		error: function(msg) {}
	}
	mocks = {
		logger: {
			Logger: function(transports) {
				return log_mock;
			}
		},
		app: {
			listen: function(port) {},
			get: function(prop) {
				return 9010;
			},
			use: function(middleware) {},
			set: function(key, value) {},
			post: function(path, handler) {}
		},
		config: {
			database: './db',
			resources: {
				notification_port: 9002
			}
		},
		db: {},
		async: {
			forEachOf: function(list, handler, callback) {
				for(var  i=0; i<Object.keys(list).length; i++) {
					handler(list[Object.keys(list)[i]], Object.keys(list)[i], function(param) {
						if (i == Object.keys(list).length - 1 ) {
							return callback(param);
						}
					});
				}
			}
		},
		req: {},
		res: {},
		bodyParser: {},
		proxy: {},
		url: {},
		server: {
			'@noCallThru': true
		},
		subsUrls: {
			'@noCallThru': true
		}
	}
	spies = {
		logger: {
			log: sinon.spy(log_mock, 'log'),
			warn: sinon.spy(log_mock, 'warn'),
			info: sinon.spy(log_mock, 'info'),
			error: sinon.spy(log_mock, 'error')
		},
		app: {},
		config: {},
		db: {},
		async: {
			forEachOf: sinon.spy(mocks.async, 'forEachOf')
		},
		req: {},
		res: {},
		bodyParser: {},
		proxy: {},
		url: {},
		server: {},
		subsUrls: {}
	}

	// Complete app_mock implementation and add spies
	async.each(Object.keys(implementations), function(obj, task_callback1) {
		async.each(Object.keys(implementations[obj]), function(implem, task_callback2) {
			mocks[obj][implem.toString()] = implementations[obj][implem.toString()];
			if ( typeof implementations[obj][implem] == 'function' && implementations[obj][implem] != undefined) {
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
		// Mocking dependencies
		cb_handler = proxyquire('../../orion_context_broker/cb_handler', {
			express: function() {
				return mocks.app;
			},
			'../config': mocks.config,
			'.././db': mocks.db,
			'async': mocks.async,
			'winston': mocks.logger,
			'body-parser': mocks.bodyParser,
			'../HTTP_Client/HTTPClient': mocks.proxy,
			'url': mocks.url,
			'../server': mocks.server,
			'winston': mocks.logger,
			'./subsUrls': mocks.subsUrls
		});
		return callback(cb_handler, spies);
	});
}

describe('Testing Context-Broker handler', function() {

	describe('run', function() {
		var implementations;

		it('correct', function() {
			implementations = {
				app: {
					listen: function(port) {},
					get: function(prop) {
						return 9002;
					}
				},
				config: {
					database: './db'
				}
			}

			mocker(implementations, function(cb_handler, spies) {
				cb_handler.run();
				assert.equal(spies.app.listen.callCount, 1);
				assert.equal(spies.app.get.callCount, 1);
				assert.equal(spies.app.listen.getCall(0).args[0], 9002);
				assert.equal(spies.app.get.getCall(0).args[0], 'port');
			});
		});
	});

	describe('notificationHandler', function() {
		var implementations, count_args;

		it('error getting the subscriptionID', function(done) {
			implementations = {
				req: {
					body: {
						subscriptionID: 'subscriptionID'
					}
				},
				res: {},
				db: {
					getCBSubscription: function(subscriptionID, callback) {
						return callback('Error', null);
					}
				},
				app: {
					post: function(path, handler) {
						return handler(implementations.req, implementations.res);
					}
				},
				config: {
					database: './db'
				}
			}
			mocker(implementations, function(cb_handler, spies) {
				assert.equal(spies.db.getCBSubscription.callCount, 1);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.logger.error.getCall(0).args[0], 
					'An error ocurred while making the accounting: Invalid subscriptionId');
				done();
			});
		});

		it('error making the accounting', function(done) {
			count_args = ['api_key', '/path', 'megabyte', { subscriptionID: 'subscriptionID' }];

			implementations.server = {
				count: function(api_key, path, unit, body, callback) {
					return callback('Error');
				}
			}
			implementations.db.getCBSubscription = function(subscriptionID, callback) {
				return callback(null, {
					API_KEY: 'api_key',
					publicPath: '/path',
					unit: 'megabyte',
					ref_host: 'localhost',
					ref_port: 9030,
					ref_path: '/path'
				});
			}
			mocker(implementations, function(cb_handler, spies) {
				assert.equal(spies.db.getCBSubscription.callCount, 1);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.server.count.callCount, 1);
				assert.equal(spies.logger.error.getCall(0).args[0], 
					'An error ocurred while making the accounting');
				async.forEachOf(count_args, function(arg, i, task_callback) {
					if (typeof arg != 'object') {
						assert.equal(spies.server.count.getCall(0).args[i], count_args[i]);
					} else {
						assert.deepEqual(spies.server.count.getCall(0).args[i], count_args[i]);
					}
					task_callback();
				});
				done();
			});
		});
		
		it('correct notification, but error notifying the client', function(done) {
			var sendData_args = ['http', {
				host: 'localhost',
				port: 9030,
				path: '/path',
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				}
			}];

			implementations.server.count = function(api_key, path, unit, body, callback) {
				return callback(null);
			}
			implementations.proxy = {
				sendData: function(proto, options, body, response, callback) {
					return callback(400, { statusMessage: 'Wrong'}, ['header1']);
				}
			}
			implementations.res = {
				send: function(msg) {},
				setHeader: function(key, value) {}
			}
			mocker(implementations, function(cb_handler, spies) {
				assert.equal(spies.db.getCBSubscription.callCount, 1);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.server.count.callCount, 1);
				assert.equal(spies.proxy.sendData.callCount, 1);
				assert.equal(spies.res.setHeader.callCount, 1);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.logger.error.getCall(0).args[0], 
					'An error ocurred while notifying the subscription to: http://localhost:9030/path. Status: 400 Wrong');
				async.forEachOf(count_args, function(arg, i, task_callback) {
					if (typeof arg != 'object') {
						assert.equal(spies.server.count.getCall(0).args[i], count_args[i]);
					} else {
						assert.deepEqual(spies.server.count.getCall(0).args[i], count_args[i]);
					}
					task_callback();
				});
				async.forEachOf(sendData_args, function(arg, i, task_callback) {
					if (typeof sendData_args[i] != 'object') {
						assert.equal(spies.proxy.sendData.getCall(0).args[i], sendData_args[i]);
					} else {
						assert.deepEqual(spies.proxy.sendData.getCall(0).args[i], sendData_args[i]);
					}
					task_callback();
				});
				done();
			});
		});
	});

	describe('getOperation', function() {
		var implementations, request;

		it('correct, subscription operation', function(done) {
			request = {
				method: 'POST'
			}
			implementations = {
				subsUrls: 
					[
						['DELETE', '/unsubs_path', 'unsubscribe'],
						['POST', '/subs_path', 'subscribe']
					]
			}
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.getOperation('/subs_path', request, function(err, operation) {
					assert.equal(err, null);
					assert.equal(operation, 'subscribe');
					assert.equal(spies.async.forEachOf.callCount, 1);
					done();
				});
			});
		});

		it('correct, no subscription/unsubscription operation', function(done) {
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.getOperation('/no_subscription_path', request, function(err, operation) {
					assert.equal(err, null);
					assert.equal(operation, null);
					assert.equal(spies.async.forEachOf.callCount, 1);
					done();
				});
			});
		});
	});

	describe('requestHandler', function() {
		var implementations, addCBSubscription_args; 

		it('[subscription] error adding the CBSubscription to db', function(done) {
			addCBSubscription_args = ['api_key', '/path', 'subscriptionID', 'localhost', 9010, '/path', 'megabyte'];

			implementations = {
				config: {
					database: './db',
					resources: {
						host: 'localhost',
						notification_port: 9030
					}
				},
				url: {
					parse: function(url) {
						return {
							pathname: '/path',
							hostname: 'localhost',
							port: 9010,
						}
					}
				},
				req: {
					method: 'POST',
					path: '/path',
					body: {
						reference: 'http://localhost/path'
					},
					get: function(prop) {
						return 'api_key';
					}
				},
				res: {
					setHeader: function(key, value) {},
					send: function(msg) {}
				},
				db: {
					addCBSubscription: function(api_key, path, subscriptionID, host, port, pathRef, unit, callback) {
						return callback('Error');
					}
				},
				proxy: {
					sendData: function(proto, options, body, response, callback) {
						return callback(200, JSON.stringify({
							subscribeResponse: {
								subscriptionId: 'subscriptionID'
							}
						}), ['header1']);
					}
				}
			}
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.requestHandler(implementations.req, implementations.res, {port: 9010, url: 'http://localhost/path'}, 'megabyte', 'subscribe', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.proxy.sendData.callCount, 1);
					assert.equal(spies.res.setHeader.callCount, 1);
					assert.equal(spies.db.addCBSubscription.callCount, 1);
					assert.equal(spies.res.send.callCount, 1);
					assert.equal(spies.url.parse.callCount, 6);
					assert.equal(spies.proxy.sendData.getCall(0).args[0], 'http');
					assert.deepEqual(spies.proxy.sendData.getCall(0).args[1], {
						headers: {
							accept: 'application/json',
							'content-type': 'application/json'
						},
						host: 'localhost',
						method: 'POST',
						path: '/path',
						port: 9010
					});
					assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
					assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
					assert.deepEqual(spies.res.send.getCall(0).args[0], {
						subscribeResponse: {
							subscriptionId: "subscriptionID"
						}
					});
					async.forEachOf(addCBSubscription_args, function(arg, i, callback) {
						assert.equal(spies.db.addCBSubscription.getCall(0).args[i], addCBSubscription_args[i]);
					});
					assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(1).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(2).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(3).args[0], 'http://localhost/path');
					done();
				});
			});
		});

		it('[subscription] correct request', function(done) {
			implementations.db.addCBSubscription = function(api_key, path, subscriptionID, host, port, pathRef, unit, callback) {
				return callback(null);
			}
			implementations.req = {
				method: 'POST',
				path: '/path',
				body: {
					reference: 'http://localhost/path'
				},
				get: function(prop) {
					return 'api_key';
				}
			}
			implementations.res = {
				setHeader: function(key, value) {},
				send: function(msg) {}
			}
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.requestHandler(implementations.req, implementations.res, {port: 9010, url: 'http://localhost/path'}, 'megabyte', 'subscribe', function(err) {
					assert.equal(err, null);
					assert.equal(spies.proxy.sendData.callCount, 1);
					assert.equal(spies.res.setHeader.callCount, 1);
					assert.equal(spies.db.addCBSubscription.callCount, 1);
					assert.equal(spies.res.send.callCount, 1);
					assert.equal(spies.url.parse.callCount, 6);
					assert.equal(spies.proxy.sendData.getCall(0).args[0], 'http');
					assert.deepEqual(spies.proxy.sendData.getCall(0).args[1], {
						headers: {
							accept: 'application/json',
							'content-type': 'application/json'
						},
						host: 'localhost',
						method: 'POST',
						path: '/path',
						port: 9010
					});
					assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
					assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
					assert.deepEqual(spies.res.send.getCall(0).args[0], {
						subscribeResponse: {
							subscriptionId: "subscriptionID"
						}
					});
					async.forEachOf(addCBSubscription_args, function(arg, i, callback) {
						assert.equal(spies.db.addCBSubscription.getCall(0).args[i], addCBSubscription_args[i]);
					});
					assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(1).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(2).args[0], 'http://localhost/path');
					assert.equal(spies.url.parse.getCall(3).args[0], 'http://localhost/path');
					done();
				});
			});
		});

		it('[unsubscription] error removing the CBSubscription to db', function(done) {
			implementations.req = {
				method: 'POST',
				path: '/path',
				body: {
					reference: 'http://localhost/path',
					subscriptionId: 'subscriptionId'
				},
				get: function(prop) {
					return 'api_key';
				}
			}
			implementations.res = {
				setHeader: function(key, value) {},
				send: function(msg) {}
			}
			implementations.db.deleteCBSubscription = function(subscriptionID, callback) {
				return callback('Error');
			}
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.requestHandler(implementations.req, implementations.res, {port: 9010, url: 'http://localhost/path'}, 'megabyte', 'unsubscribe', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.proxy.sendData.callCount, 1);
					assert.equal(spies.res.setHeader.callCount, 1);
					assert.equal(spies.res.send.callCount, 1);
					assert.equal(spies.db.deleteCBSubscription.callCount, 1);
					assert.equal(spies.proxy.sendData.getCall(0).args[0], 'http');
					assert.deepEqual(spies.proxy.sendData.getCall(0).args[1], {
						headers: {
							accept: 'application/json',
							'content-type': 'application/json'
						},
						host: 'localhost',
						method: 'POST',
						path: '/path',
						port: 9010
					});
					assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
					assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
					assert.deepEqual(spies.res.send.getCall(0).args[0], {
						subscribeResponse: {
							subscriptionId: "subscriptionID"
						}
					});
					assert.equal(spies.db.deleteCBSubscription.getCall(0).args[0], 'subscriptionId');
					done();
				});
			});
		});

		it('[unsubscription] correct request', function(done) {
			implementations.req = {
				method: 'DELETE',
				path: '/v1/contextSubscriptions/subscriptionID',
				body: {
					reference: 'http://localhost/path',
					subscriptionId: 'subscriptionId'
				},
				get: function(prop) {
					return 'api_key';
				}
			}
			implementations.res = {
				setHeader: function(key, value) {},
				send: function(msg) {}
			}
			implementations.db.deleteCBSubscription = function(subscriptionID, callback) {
				return callback(null);
			}
			mocker(implementations, function(cb_handler, spies) {
				cb_handler.requestHandler(implementations.req, implementations.res, {port: 9010, url: 'http://localhost/path'}, 'megabyte', 'unsubscribe', function(err) {
					assert.equal(err, null);
					assert.equal(spies.proxy.sendData.callCount, 1);
					assert.equal(spies.res.setHeader.callCount, 1);
					assert.equal(spies.res.send.callCount, 1);
					assert.equal(spies.db.deleteCBSubscription.callCount, 1);
					assert.equal(spies.proxy.sendData.getCall(0).args[0], 'http');
					assert.deepEqual(spies.proxy.sendData.getCall(0).args[1], {
						headers: {
							accept: 'application/json',
							'content-type': 'application/json'
						},
						host: 'localhost',
						method: 'DELETE',
						path: '/path',
						port: 9010
					});
					assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
					assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
					assert.deepEqual(spies.res.send.getCall(0).args[0], {
						subscribeResponse: {
							subscriptionId: "subscriptionID"
						}
					});
					assert.equal(spies.db.deleteCBSubscription.getCall(0).args[0], 'subscriptionID');
					done();
				});
			});
		});
	});
})