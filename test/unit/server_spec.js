var proxyquire = require('proxyquire').noCallThru(),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async'),
	rewire = require('rewire');
	


var mocker = function(implementations, callback) {
	var mocks, spies, proxy_server;

	mocks = {
		app: {
			set: function(prop, value) {},
			listen: function(port) {},
			get: function(prop) {},
			use: function(middleware) {}
		},
		req: {},
		res: {},
		config: {},
		api: {},
		notifier: {},
		cron: {},
		async: {
			series: async.series,
			each: async.each
		},
		url: {},
		requester: {
			request: {}
		},
		db: {},
		mock_logger: {
			logger: {
				log: function(level, msg) {},
				warn: function(msg) {},
				error: function(msg) {},
				info: function(msg) {}
			}
		},
		contextBroker: {},
		acc_modules: {}
	}

	spies = {
		app: {},
		req: {},
		res: {},
		config: {},
		api: {},
		notifier: {},
		cron: {},
		async: {
			series: sinon.spy(mocks.async, 'series'),
			each: sinon.spy(mocks.async, 'each')
		},
		url: {},
		requester: {},
		db: {},
		logger: {
			log: sinon.spy(mocks.mock_logger.logger, 'log'),
			warn: sinon.spy(mocks.mock_logger.logger, 'warn'),
			error: sinon.spy(mocks.mock_logger.logger, 'error'),
			info: sinon.spy(mocks.mock_logger.logger, 'info')
		},
		contextBroker: {},
		acc_modules: {}
	}

	// Complete app_mock implementation and add spies
	if (implementations.config == undefined) {
			mocks.config = {
				accounting_proxy: {
					port: 9000
				}
			}
		} else if (implementations.config.accounting_proxy == undefined) {
			mocks.config.accounting_proxy = {
				port: 9000
			}
		}
		mocks.config.database = './db';
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
		server = proxyquire('../../server', {
			express: function() {
				return mocks.app;
			},
			request: mocks.requester.request,
			'./config': mocks.config,
			'./db': mocks.db,
			'async': mocks.async,
			'./APIServer': mocks.api,
			'./accounting-proxy': mocks.mock_logger,
			'./notifier': mocks.notifier,
			'node-schedule': mocks.cron,
			'./acc_modules/megabyte': mocks.acc_modules,
			'url': mocks.url,
			'./orion_context_broker/cb_handler': mocks.contextBroker
		});
		return callback(server, spies);
	});
}

describe('Testing Server', function() {

	describe('Function "initialize"', function() {

		it('error notifying the WStore: error getting information from db', function(done) {
			var implementations = {
				db: {
					getNotificationInfo: function(callback) {
						return callback('Error');
					},
					init: function() {}
				}
			}
			mocker(implementations, function(server, spies) {
				server.init(function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.db.init.callCount, 1);
					done();
				});
			});
		});

		it('not necessary notify the WStore', function(done) {
			var implementations = {
				app: {
					listen: function(port) {},
					get: function(prop) {}
				},
				db: {
					getNotificationInfo: function(callback) {
						return callback(null, null);
					},
					init: function() {}
				},
				config: {
					resources: {
						contextBroker: true
					}
				},
				contextBroker: {
					run: function() {}
				},
				cron: {
					scheduleJob: function(schedule, callback) {}
				},
				api: {
					run: function() {}
				}
			}
			mocker(implementations, function(server, spies) {
				server.init(function(err) {
					assert.equal(err, null);
					assert.equal(spies.db.init.callCount, 1);
					assert.equal(spies.logger.info.callCount, 1);
					assert.equal(spies.logger.info.getCall(0).args[0], 'Loading module for Orion Context Broker...');
					assert.equal(spies.contextBroker.run.callCount, 1);
					assert.equal(spies.cron.scheduleJob.callCount, 1);
					assert.equal(spies.cron.scheduleJob.getCall(0).args[0], '00 00 * * *');
					assert.equal(spies.app.get.callCount, 1);
					assert.equal(spies.app.get.getCall(0).args[0], 'port');
					assert.equal(spies.app.listen.callCount, 1);
					assert.equal(spies.api.run.callCount, 1);
					done();
				});
			});
		});

		it('error notifying the WStore', function(done) {
			var notificationInfo = {
				apiKey1: {
					customer: '0001',
					value: '1.3',
					correlationNumber: '2',
					recordType: 'callusage',
					unit: 'call'
				}
			}
			var implementations = {
				db: {
					getNotificationInfo: function(callback) {
						return callback(null, notificationInfo);
					},
					init: function() {}
				},
				config: {
					resources: {
						contextBroker: true
					}
				},
				notifier: {
					notify: function(info, callback) {
						return callback('Error');
					}
				}
			}
			mocker(implementations, function(server, spies) {
				server.init(function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.db.init.callCount, 1);
					assert.equal(spies.logger.info.callCount, 1);
					assert.equal(spies.logger.info.getCall(0).args[0], 'Notifying the WStore...');
					assert.equal(spies.async.each.callCount, 1);
					assert.deepEqual(spies.async.each.getCall(0).args[0], {
					    apiKey1: {
						    correlationNumber: "2",
						    customer: "0001",
						    recordType: "callusage",
						    unit: "call",
						    value: "1.3"
						}
					});
					done();
				});
			});
		});

		it('error scheduling the notifications', function(done) {
			var implementations = {
				app: {
					listen: function(port) {},
					get: function(prop) {}
				},
				db: {
					count: 0,
					getNotificationInfo: function(callback) {
						if (this.count == 0) {
							this.count++;
							return callback(null, null);
						} else {
							return callback('Error', null);
						}
					},
					init: function() {}
				},
				config: {
					resources: {
						contextBroker: true
					}
				},
				contextBroker: {
					run: function() {}
				},
				cron: {
					scheduleJob: function(schedule, callback) {
						return callback();
					}
				},
				api: {
					run: function() {}
				}
			}
			mocker(implementations, function(server, spies) {
				server.init(function(err) {
					assert.equal(err, null);
					assert.equal(spies.db.init.callCount, 1);
					assert.equal(spies.logger.info.callCount, 2);
					assert.equal(spies.logger.info.getCall(0).args[0], 'Loading module for Orion Context Broker...');
					assert.equal(spies.logger.info.getCall(1).args[0], 'Sending accounting information...');
					assert.equal(spies.logger.error.callCount, 1);
					assert.equal(spies.logger.error.getCall(0).args[0], 'Error while notifying the WStore: Error');
					assert.equal(spies.contextBroker.run.callCount, 1);
					assert.equal(spies.cron.scheduleJob.callCount, 1);
					assert.equal(spies.cron.scheduleJob.getCall(0).args[0], '00 00 * * *');
					assert.equal(spies.app.get.callCount, 1);
					assert.equal(spies.app.get.getCall(0).args[0], 'port');
					assert.equal(spies.app.listen.callCount, 1);
					assert.equal(spies.api.run.callCount, 1);
					done();
				});
			});
		});

		it('correct initialization', function(done) {
			var notificationInfo = {
				apiKey1: {
					customer: '0001',
					value: '1.3',
					correlationNumber: '2',
					recordType: 'callusage',
					unit: 'call'
				},
				apiKey2: {
					customer: '0002',
					value: '1.3',
					correlationNumber: '2',
					recordType: 'callusage',
					unit: 'call'
				}
			}
			var implementations = {
				app: {
					listen: function(port) {},
					get: function(prop) {}
				},
				db: {
					count: 0,
					getNotificationInfo: function(callback) {
						return callback(null, notificationInfo);
					},
					init: function() {}
				},
				config: {
					resources: {
						contextBroker: true
					}
				},
				contextBroker: {
					run: function() {}
				},
				cron: {
					scheduleJob: function(schedule, callback) {
						return callback();
					}
				},
				api: {
					run: function() {}
				},
				notifier: {
					notify: function(info, callback) {
						return callback(null);
					}
				}
			}
			var info_args = [ 'Notifying the WStore...', 'Notifying the WStore...', 'Loading module for Orion Context Broker...',
							'Sending accounting information...', 'Notifying the WStore...', 'Notifying the WStore...'];
			mocker(implementations, function(server, spies) {
				server.init(function(err) {
					assert.equal(err, null);
					assert.equal(spies.db.init.callCount, 1);
					assert.equal(spies.logger.info.callCount, info_args.length);
					async.forEachOf(info_args, function(arg, i, task_callback) {
						assert.equal(spies.logger.info.getCall(i).args[0], arg);
						task_callback();
					});
					assert.equal(spies.contextBroker.run.callCount, 1);
					assert.equal(spies.cron.scheduleJob.callCount, 1);
					assert.equal(spies.cron.scheduleJob.getCall(0).args[0], '00 00 * * *');
					assert.equal(spies.app.get.callCount, 1);
					assert.equal(spies.app.get.getCall(0).args[0], 'port');
					assert.equal(spies.app.listen.callCount, 1);
					assert.equal(spies.api.run.callCount, 1);
					done();
				});
			});
		});
	});

	describe('[No ContextBroker Request]', function() {

		it('undefined user', function(done) {
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						return undefined;
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					json: function(json) {}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], 'Undefined username');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 401);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Undefined "X-Actor-ID" header'});
				done();
			});
		});

		it('undefined api-key', function(done) {
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
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
					status: function(statusCode) {
						return this;
					},
					json: function(json) {}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], 'Undefined API_KEY');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 401);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Undefined "X-API-KEY" header'});
				done();
			});
		});

		it('error checking the request', function(done) {
			var user = '0001';
			var apiKey = 'apiKey';
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback('Error', false);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('invalid request', function(done) {
			var user = '0001';
			var apiKey = 'apiKey';
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					json: function(msg) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, false);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 401);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Invalid API_KEY or user' });
				done();
			});
		});

		it('error getting the accounting information', function(done) {
			var user = '0001';
			var apiKey = 'apiKey';
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback('Error', null);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				done();
			});
		});

		it('no accounting info available', function(done) {
			var user = '0001';
			var apiKey = 'apiKey';
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, null);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				done();
			});
		});

		it('error getting the endpoint path', function(done) {
			var path = '/path2';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: path,
				url: 'http://example.com/patth1',
				unit: 'megabyte'
			}
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return path
						}
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					json: function(msg) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], { error: 'Invalid public path ' + implementations.req.path});
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				done();
			});
		});

		it('error sending request to the endpoint', function(done) {
			var path = 'path1';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/path1',
				url: 'http://example.com/patth1',
				unit: 'megabyte'
			}
			var implementations = {
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return ['', path];
						},
						substring: function(length) {
							return 'path1';
						}
					},
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					}
				},
				config: {
					resources: {
						contextBroker: false
					}
				},
				requester: {
					request: function(options, callback)  {
						return callback('Error', null, null);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/patth1/path1',
					method: 'GET',
					headers: { header1: 'value1' } 
				});
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.warn.getCall(0).args[0], 'An error ocurred requesting the endpoint: ' + accountingInfo.url + '/' + path);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 504);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('no accounting module specified', function(done) {
			var path = 'path1';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/path1',
				url: 'http://example.com/patth1',
				unit: 'no_exist'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return ['', path];
						},
						substring: function(length) {
							return 'path1';
						}
					},
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					}
				},
				config: {
					resources: {
						contextBroker: false
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				requester: {
					request: function(options, callback)  {
						return callback(null, {headers: { header1: 'header1'}}, null);
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback('Error', null);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/patth1/path1',
					method: 'GET',
					headers: { header1: 'value1' } 
				});
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] Error making the accounting: No accounting module for unit "%s": missing file acc_modules/%s.jsno_exist');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('error in accounting_module', function(done) {
			var path = 'path1';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/path1',
				url: 'http://example.com/patth1',
				unit: 'megabyte'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return ['', path];
						},
						substring: function(length) {
							return 'path1';
						}
					},
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					}
				},
				config: {
					resources: {
						contextBroker: false
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				requester: {
					request: function(options, callback)  {
						return callback(null, {headers: { header1: 'header1'}}, null);
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback('Error', null);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/patth1/path1',
					method: 'GET',
					headers: { header1: 'value1' } 
				});
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] Error making the accounting: Error');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('error making the accounting', function(done) {
			var path = 'path1';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/path1',
				url: 'http://example.com/patth1',
				unit: 'megabyte'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return ['', path];
						},
						substring: function(length) {
							return 'path1';
						}
					},
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					},
					makeAccounting: function(apiKey, amount, callback) {
						return callback('Error');
					}
				},
				config: {
					resources: {
						contextBroker: false
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				requester: {
					request: function(options, callback)  {
						return callback(null, {headers: { header1: 'header1'}}, null);
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback(null, 0.163);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/patth1/path1',
					method: 'GET',
					headers: { header1: 'value1' } 
				});
				assert.equal(spies.db.makeAccounting.callCount, 1);
				assert.equal(spies.db.makeAccounting.getCall(0).args[0], apiKey);
				assert.equal(spies.db.makeAccounting.getCall(0).args[1], '0.163');
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.warn.getCall(0).args[0], '[%s] Error making the accounting: Error');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			var path = 'path1';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/path1',
				url: 'http://example.com/patth1',
				unit: 'megabyte'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: {
						split: function(char) {
							return ['', path];
						},
						substring: function(length) {
							return 'path1';
						}
					},
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					},
					makeAccounting: function(apiKey, amount, callback) {
						return callback(null);
					}
				},
				config: {
					resources: {
						contextBroker: false
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				requester: {
					request: function(options, callback)  {
						return callback(null, {headers: { header1: 'header1'}}, {});
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback(null, 0.163);
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/patth1/path1',
					method: 'GET',
					headers: { header1: 'value1' } 
				});
				assert.equal(spies.db.makeAccounting.callCount, 1);
				assert.equal(spies.db.makeAccounting.getCall(0).args[0], apiKey);
				assert.equal(spies.db.makeAccounting.getCall(0).args[1], '0.163');
				assert.equal(spies.res.send.callCount, 1);
				assert.deepEqual(spies.res.send.getCall(0).args[0], {});
				done();
			});
		});
	});

	describe('[ContextBroker Request] error handling subscription', function() {


		it('error sending the request to context-broker', function(done) {
			var path = '/v1/updateContext';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/v1/updateContext',
				url: 'http://example.com/v1/updateContext',
				unit: 'megabyte'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: path,
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					},
					makeAccounting: function(apiKey, amount, callback) {
						return callback(null);
					}
				},
				config: {
					resources: {
						contextBroker: true
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback(null, 0.163);
					}
				},
				url: {
					parse: function(url) {
						return {pathname: path}
					}
				},
				contextBroker: {
					getOperation: function(pathname, req, callback) {
						return callback('unsubscribe')
					},
					subscriptionHandler: function(req, res, url, unit, operation, callback) {
						return callback('Error');
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.contextBroker.getOperation.callCount, 1);
				assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], path);
				assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
				assert.equal(spies.contextBroker.subscriptionHandler.callCount, 1);
				assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[0], implementations.req);
				assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[1], implementations.res);
				assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[2], accountingInfo.url);
				assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[3], 'megabyte');
				assert.equal(spies.contextBroker.subscriptionHandler.getCall(0).args[4], 'unsubscribe');
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.logger.error.getCall(0).args[0], 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var path = '/v1/updateContext';
			var user = '0001';
			var apiKey = 'apiKey';
			var accountingInfo = {
				publicPath: '/v1/updateContext',
				url: 'http://example.com/v1/updateContext',
				unit: 'megabyte'
			}
			var implementations = {
				rewire: true,
				app: {
					use: function(path, handler) {
						if (path === '/') {
							return handler(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						if (header === 'X-Actor-ID') {
							return user;
						} else {
							return apiKey;
						}
					},
					path: path,
					method: 'GET',
					headers: {
						header1: 'value1'
					}
				},
				res: {
					status: function(statusCode) {
						return this;
					},
					send: function() {},
					setHeader: function(header, value) {}
				},
				db: {
					checkRequest: function(user, apiKey, callback) {
						return callback(null, true);
					},
					getAccountingInfo: function(apiKey, callback) {
						return callback(null, accountingInfo);
					},
					makeAccounting: function(apiKey, amount, callback) {
						return callback(null);
					}
				},
				config: {
					resources: {
						contextBroker: true
					},
					modules: {
						accounting: ['megabyte']
					}
				},
				acc_modules: {
					count: function(body, callback) {
						return callback(null, 0.163);
					}
				},
				url: {
					parse: function(url) {
						return {pathname: path}
					}
				},
				contextBroker: {
					getOperation: function(pathname, req, callback) {
						return callback('administration')
					},
					subscriptionHandler: function(req, res, url, unit, operation, callback) {
						return callback('Error');
					}
				},
				requester: {
					request: function(options, callback) {
						return callback(null, { headers: {header1: 'header1'}}, {});
					}
				}
			}
			mocker(implementations, function(server, spies) {
				assert.equal(spies.app.use.callCount, 2);
				assert.equal(spies.app.use.getCall(1).args[0], '/');
				assert.equal(spies.req.get.callCount, 4);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(2).args[0], 'X-Actor-ID');
				assert.equal(spies.req.get.getCall(3).args[0], 'X-API-KEY');
				assert.equal(spies.db.checkRequest.callCount, 1);
				assert.equal(spies.db.checkRequest.getCall(0).args[0], user);
				assert.equal(spies.db.checkRequest.getCall(0).args[1], apiKey);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], apiKey);
				assert.equal(spies.contextBroker.getOperation.callCount, 1);
				assert.equal(spies.contextBroker.getOperation.getCall(0).args[0], path);
				assert.deepEqual(spies.contextBroker.getOperation.getCall(0).args[1], implementations.req);
				assert.equal(spies.requester.request.callCount, 1);
				assert.deepEqual(spies.requester.request.getCall(0).args[0], { 
					url: 'http://example.com/v1/updateContext',
  					method: 'GET',
  					headers: { header1: 'value1' } 
  				});
  				assert.equal(spies.res.setHeader.callCount, 1);
  				assert.equal(spies.res.setHeader.getCall(0).args[0], 'header1');
  				assert.equal(spies.res.setHeader.getCall(0).args[1], 'header1');
				assert.equal(spies.res.send.callCount, 1);
				assert.deepEqual(spies.res.send.getCall(0).args[0], {});
				done();
			});
		});
	});
});