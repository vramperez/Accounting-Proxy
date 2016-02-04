var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');
	


var mocker = function(implementations, callback) {
	var mocks, spies, proxy_server;

	// Create mocks and spies
	var log_mock = {
		log: function(level, msg) {},
		info: function(msg) {},
		warn: function(msg) {},
		error: function(msg) {}
	}
	mocks = {
		config: {
			database: './db'
		},
		notifier: {
			notify: function(notification_info) {}
		},
		async: {
			each: function(list, handler) {
				for (var i = 0; i < list.length; i++) {
					handler(list[i], function(param) { });
				}
			}
		},
		logger: {
			Logger: function(transports) {
				return log_mock;
			}
		},
		app: {
			set: function(prop, value) {},
			listen: function(port) {},
			get: function(prop) {},
			use: function(middleware) {}
		},
		bodyParser: {
			json: function() {}
		},
		contextBroker: {},
		api: {
			run: function() {}
		},
		cron: {},
		req: {},
		res: {},
		proxy: {},
		db: {},
		acc_modules: {},
		url: {}
	}
	spies = {
		notifier: {
			notify: sinon.spy(mocks.notifier, 'notify')
		},
		async: {
			each: sinon.spy(mocks.async, 'each')
		},
		logger: {
			log: sinon.spy(log_mock, 'log'),
			warn: sinon.spy(log_mock, 'warn'),
			info: sinon.spy(log_mock, 'info'),
			error: sinon.spy(log_mock, 'error')
		},
		app: {},
		contextBroker: {},
		cron: {},
		req: {},
		res: {},
		proxy: {},
		db: {},
		acc_modules: {},
		url: {}
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
		api_server = proxyquire('../../server', {
			express: function() {
				return mocks.app;
			},
			'./config': mocks.config,
			'./db': mocks.db,
			'async': mocks.async,
			'./APIServer': mocks.api,
			'winston': mocks.logger,
			'./notifier': mocks.notifier,
			'node-schedule': mocks.cron,
			'body-parser': mocks.bodyParser,
			'./HTTP_Client/HTTPClient': mocks.proxy,
			'./acc_modules/megabyte': mocks.acc_modules,
			'url': mocks.url,
			'./orion_context_broker/cb_handler': mocks.contextBroker
		});
		return callback(api_server, spies);
	});
}

describe('Testing Server', function() {

	describe('initialization functions', function() {
		var implementations;

		it('[notify] error obtaining api_keys from db', function(done) {
			implementations= {
				db: {
					getApiKeys: function(callback) {
						return callback('Error', null);
					}
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Notifying the WStore...');
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Notification to the WStore failed');
				done();
			});
		});

		it('[notify] error no api_keys available', function(done) {
			implementations.db.getApiKeys = function(callback) {
				return callback(null, []);
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], 'No data availiable');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Notifying the WStore...');
				done();
			});
		});
		it('[notify] error getting resources from db', function(done) {
			implementations.db.getApiKeys = function(callback) {
				return callback(null, ['api_key1']);
			}
			implementations.db.getResources = function(api_key, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 0);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.db.getResources.callCount, 1);
				assert.deepEqual(spies.async.each.getCall(0).args[0], ['api_key1']);
				assert.equal(spies.db.getResources.getCall(0).args[0], 'api_key1');
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				done();
			});
		});

		it('[notify] error no resources available', function(done) {
			implementations.db.getResources = function(api_key, callback) {
				return callback(null, []);
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.async.each.callCount, 1);
				assert.equal(spies.db.getResources.callCount, 1);
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], 'No data availiable');
				assert.deepEqual(spies.async.each.getCall(0).args[0], ['api_key1']);
				assert.equal(spies.db.getResources.getCall(0).args[0], 'api_key1');
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				done();
			});
		});

		it('[notify] error obtaining notification info', function(done) {
			implementations.db.getResources = function(api_key, callback) {
				return callback(null, [{resource: 'resource1'}]);
			}
			implementations.db.getNotificationInfo = function(api_key, resource, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 0);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.async.each.callCount, 2);
				assert.equal(spies.db.getNotificationInfo.callCount, 1);
				assert.equal(spies.db.getResources.callCount, 1);
				assert.deepEqual(spies.async.each.getCall(0).args[0], ['api_key1']);
				assert.deepEqual(spies.async.each.getCall(1).args[0], [{resource: 'resource1'}]);
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[0], 'api_key1');
				assert.deepEqual(spies.db.getNotificationInfo.getCall(0).args[1], {resource: 'resource1'});
				assert.equal(spies.db.getResources.getCall(0).args[0], 'api_key1');
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				done();
			});
		});

		it('[notify] correct notification', function(done) {
			implementations.db.getNotificationInfo = function(api_key, resource, callback) {
				return callback(null, {info: 'notification_info'});
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 0);
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.async.each.callCount, 2);
				assert.equal(spies.db.getNotificationInfo.callCount, 1);
				assert.equal(spies.db.getResources.callCount, 1);
				assert.equal(spies.notifier.notify.callCount, 1);
				assert.deepEqual(spies.async.each.getCall(0).args[0], ['api_key1']);
				assert.deepEqual(spies.async.each.getCall(1).args[0], [{resource: 'resource1'}]);
				assert.equal(spies.db.getNotificationInfo.getCall(0).args[0], 'api_key1');
				assert.deepEqual(spies.db.getNotificationInfo.getCall(0).args[1], {resource: 'resource1'});
				assert.equal(spies.db.getResources.getCall(0).args[0], 'api_key1');
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				done();
			});
		});

		it('load context broker', function(done){
			implementations.contextBroker = {
				run: function() {}
			}
			implementations.config = {
				database: './db',
				resources: {
					contextBroker: true
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 0);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading module for Orion Context Broker...');
				done();
			});
		});

		it('scheduled notification failed', function(done) {
			implementations.cron = {
				scheduleJob: function(schedule, callback) {
					return callback();
				}
			}
			implementations.db.getApiKeys = function(callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 4);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.log.callCount, 0);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Sending accounting information...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(2).args[0], 'Loading module for Orion Context Broker...');
				assert.equal(spies.logger.info.getCall(3).args[0], 'Notifying the WStore...');
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Notification to the WStore failed');
				assert.equal(spies.logger.error.getCall(0).args[0], 'Error while notifying the WStore');
				done();
			});
		});

		it('error loading accounting modules', function(done) {
			implementations.config.modules = {
				accounting: ['no_exist']
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 4);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.error.callCount, 2);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Sending accounting information...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(2).args[0], 'Loading module for Orion Context Broker...');
				assert.equal(spies.logger.info.getCall(3).args[0], 'Notifying the WStore...');
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Notification to the WStore failed');
				assert.equal(spies.logger.error.getCall(0).args[0], 'Error while notifying the WStore');
				assert.equal(spies.logger.error.getCall(1).args[0], 'No accounting module for unit \'%s\': missing file acc_modules/%s.jsno_exist');
				assert.equal(spies.logger.error.getCall(1).args[1], 'no_exist');
				done();
			});
		});
	});

	describe('user request (use)', function() {
		var implementations;

		it('error (400), missed X-Actor-ID header', function(done) {
			implementations = {
				req: {
					get: function(header) {
						return undefined;
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					end: function() {},
					json: function(msg) {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 2);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.json.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.log.getCall(1).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(1).args[1], '[%s] Undefined username');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Undefined "X-Actor-ID" header' });
				done();
			});
		});

		it('error (400), missed X-API.KEY header', function(done) {
			implementations = {
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return '0001';
						} else {
							return undefined;
						}
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					end: function() {},
					json: function(msg) {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 2);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.json.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.log.getCall(1).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(1).args[1], '[%s] Undefined API_KEY');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Undefined "X-API-KEY" header' });
				done();
			});
		});

		it('error (500), error checing the information', function(done) {
			implementations = {
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return '0001';
						} else {
							return 'api_key';
						}
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					end: function() {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				},
			}
			implementations.db = {
				checkInfo: function(user, api_key, path, callback) {
					return callback('Error', null);
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.end.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				done();
			});
		});

		it('error (401), invalid api_key or user', function(done) {
			implementations = {
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return '0001';
						} else {
							return 'api_key';
						}
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					end: function() {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				},
			}
			implementations.db = {
				checkInfo: function(user, api_key, path, callback) {
					return callback(null, null);
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.end.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.res.status.getCall(0).args[0], 401);
				done();
			});
		});

		it('error (500) getting the service from db', function(done) {
			implementations = {
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return '0001';
						} else {
							return 'api_key';
						}
					},
					path: '/path'
				},
				res: {
					status: function(status) {
						return this;
					},
					end: function() {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				},
				db: {
					checkInfo: function(user, api_key, path, callback) {
						return callback(null, 'megabyte');
					},
					getService: function(path, callback) {
						return callback('Error', null);
					}
				}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.end.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				done();
			});
		});

		it('error in accounting module', function(done) {
			implementations = {
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return '0001';
						} else {
							return 'api_key';
						}
					},
					path: '/path'
				},
				res: {
					send: function() {},
					setHeader: function(header, value) {}
				},
				app: {
					use: function(callback) {
						if (typeof callback == 'function') {
							return callback(implementations.req, implementations.res);
						} else {
							return;
						}
					}
				},
				proxy: {
					getClientIp: function(request, headers) {
						return 'header';
					},
					sendData: function(protocol, options, body, response, callback) {
						return callback(400, {}, [{header: 'header1'}]);
					}
				},
				config: {
					database: './db',
					resources: {
						contextBroker: false
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				acc_modules: {
					count: function(response, callback) {
						return callback('Error', null);
					}
				},
				url: {
					parse: function(url) {
						return {
							pathname: '/path'
						}
					}
				},
				db: {
					getService: function(path, callback) {
						return callback(null, {
							url: 'http://localhost/path',
							port: 9010,
						});
					},
					checkInfo: function(user, api_key, path, callback) {
						return callback(null, 'megabyte');
					}
				}
			}
			implementations.db.getService = function(path, callback) {
				return callback(null, {
					url: 'http://localhost/path',
					port: 9010,
				});
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.res.setHeader.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] An error ocurred while making the accounting');
				assert.equal(spies.logger.warn.getCall(0).args[1], 'api_key');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.equal(spies.url.parse.getCall(1).args[0], 'http://localhost/path');
				assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
				assert.deepEqual(spies.res.setHeader.getCall(0).args[1], {header: 'header1'});
				done();
			});
		});

		it('error in db while making th accounting', function(done) {
			var count_args = [0001, 'api_key', '/path', 1.23, {} ];

			implementations.db.count = function(user, api_key, publicPath, amount, callback) {
				return callback('Error');
			}
			implementations.acc_modules.count = function(response, callback) {
				return callback(null, 1.23);
			}
			implementations.req = {
				get: function(header) {
					if (header === 'X-Actor-ID') {
						return '0001';
					} else {
						return 'api_key';
					}
				},
				path: '/path'
			}
			implementations.res = {
				status: function(status) {
						return this;
				},
				send: function() {},
				setHeader: function(header, value) {}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.res.status.callCount, 0);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.res.setHeader.callCount, 1);
				assert.equal(spies.db.count.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] An error ocurred while making the accounting');
				assert.equal(spies.logger.warn.getCall(0).args[1], 'api_key');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.equal(spies.url.parse.getCall(1).args[0], 'http://localhost/path');
				assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
				assert.deepEqual(spies.res.setHeader.getCall(0).args[1], {header: 'header1'});
				async.forEachOf(count_args, function(arg, i, callback) {
					if (typeof arg != 'object') {
						assert.equal(spies.db.count.getCall(0).args[i], count_args[i]);
					} else {
						assert.deepEqual(spies.db.count.getCall(0).args[i], count_args[i]);
					}
					callback();
				})
				done();
			});
		});

		it('correct request', function(done) {
			var count_args = [0001, 'api_key', '/path', 1.23, {} ];

			implementations.db.count = function(user, api_key, publicPath, amount, callback) {
				return callback(null);
			}
			implementations.req = {
				get: function(header) {
					if (header === 'X-Actor-ID') {
						return '0001';
					} else {
						return 'api_key';
					}
				},
				path: '/path'
			}
			implementations.res = {
				status: function(status) {
						return this;
				},
				send: function() {},
				setHeader: function(header, value) {}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.res.status.callCount, 0);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.res.setHeader.callCount, 1);
				assert.equal(spies.db.count.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.equal(spies.url.parse.getCall(1).args[0], 'http://localhost/path');
				assert.equal(spies.res.setHeader.getCall(0).args[0], 0);
				assert.deepEqual(spies.res.setHeader.getCall(0).args[1], {header: 'header1'});
				async.forEachOf(count_args, function(arg, i, callback) {
					if (typeof arg != 'object') {
						assert.equal(spies.db.count.getCall(0).args[i], count_args[i]);
					} else {
						assert.deepEqual(spies.db.count.getCall(0).args[i], count_args[i]);
					}
					callback();
				});
				done();
			});
		});

		it('[ContextBroker subscription request] error', function(done) {
			implementations.config.resources.contextBroker = true;
			implementations.url.parse = function(url) {
				return {
					pathname: '/v1/subscribeContext'
				}
			}
			implementations.contextBroker = {
				getOperation: function(url, request, callback) {
					return callback('Error', null);
				}
			}
			implementations.req = {
				get: function(header) {
					if (header === 'X-Actor-ID') {
						return '0001';
					} else {
						return 'api_key';
					}
				},
				path: '/path',
				headers: 'header'
			}
			implementations.res = {
				status: function(status) {
						return this;
				},
				send: function() {},
				setHeader: function(header, value) {}
			}
			implementations.proxy = {
				getClientIp: function(request, headers) {}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.db.checkInfo.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.proxy.getClientIp.callCount, 1);
				assert.equal(spies.contextBroker.getOperation.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading module for Orion Context Broker...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.error.getCall(0).args[0], 'Error obtaining the operation based on CB path %s');
				assert.equal(spies.logger.error.getCall(0).args[1], '/v1/subscribeContext');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkInfo.getCall(0).args[0], '0001');
				assert.equal(spies.db.checkInfo.getCall(0).args[1], 'api_key');
				assert.equal(spies.db.checkInfo.getCall(0).args[2], '/path');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.proxy.getClientIp.getCall(0).args[0], implementations.req);
				assert.equal(spies.proxy.getClientIp.getCall(0).args[1], 'header');
				assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
				done();
			});
		});

		it('[ContextBroker subscription request] correct', function(done) {
			implementations.contextBroker = {
				getOperation: function(url, request, callback) {
					return callback(null, 'subscribe');
				},
				requestHandler: function(request, response, service, unit, operation, callback) {
					return callback('Error');
				}
			}
			implementations.req = {
				get: function(header) {
					if (header === 'X-Actor-ID') {
						return '0001';
					} else {
						return 'api_key';
					}
				},
				path: '/path',
				headers: 'header'
			}
			implementations.res = {
				status: function(status) {
						return this;
				},
				send: function() {},
				setHeader: function(header, value) {}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.db.checkInfo.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.proxy.getClientIp.callCount, 1);
				assert.equal(spies.contextBroker.getOperation.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading module for Orion Context Broker...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.error.getCall(0).args[0], 'Error processing CB request');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkInfo.getCall(0).args[0], '0001');
				assert.equal(spies.db.checkInfo.getCall(0).args[1], 'api_key');
				assert.equal(spies.db.checkInfo.getCall(0).args[2], '/path');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.proxy.getClientIp.getCall(0).args[0], implementations.req);
				assert.equal(spies.proxy.getClientIp.getCall(0).args[1], 'header');
				assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
				done();
			});
		});

		it('[ContextBroker request] correct', function(done) {
			implementations.proxy.sendData = function(protocol, options, body, response, callback) {
				return callback(200, {resp: 'resp'}, ['header1']);
			}
			implementations.acc_modules.count = function(response, callback) {
				return callback('Error', null);
			}
			implementations.contextBroker = {
				getOperation: function(url, request, callback) {
					return callback(null, null);
				},
				requestHandler:  function(request, response, service, unit, operation, callback) {
					return callback(null);
				}
			}
			implementations.req = {
				get: function(header) {
					if (header === 'X-Actor-ID') {
						return '0001';
					} else {
						return 'api_key';
					}
				},
				path: '/path',
				headers: 'header'
			}
			implementations.res = {
				status: function(status) {
						return this;
				},
				send: function() {},
				setHeader: function(header, value) {}
			}
			mocker(implementations, function(proxy_server, spies) {
				assert.equal(spies.logger.info.callCount, 2);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.db.checkInfo.callCount, 1);
				assert.equal(spies.db.getService.callCount, 1);
				assert.equal(spies.url.parse.callCount, 2);
				assert.equal(spies.proxy.getClientIp.callCount, 1);
				assert.equal(spies.contextBroker.getOperation.callCount, 1);
				assert.equal(spies.logger.info.getCall(0).args[0], 'Loading accounting modules...');
				assert.equal(spies.logger.info.getCall(1).args[0], 'Loading module for Orion Context Broker...');
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], '[%s] New request');
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] An error ocurred while making the accounting');
				assert.equal(spies.logger.warn.getCall(0).args[1], 'api_key');
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkInfo.getCall(0).args[0], '0001');
				assert.equal(spies.db.checkInfo.getCall(0).args[1], 'api_key');
				assert.equal(spies.db.checkInfo.getCall(0).args[2], '/path');
				assert.equal(spies.db.getService.getCall(0).args[0], '/path');
				assert.equal(spies.url.parse.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.proxy.getClientIp.getCall(0).args[0], implementations.req);
				assert.equal(spies.proxy.getClientIp.getCall(0).args[1], 'header');
				assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], 'http://localhost/path');
				assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
				done();
			});
		});
	});
});
