var proxyquire = require('proxyquire').noCallThru(),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var mocker = function(implementations, callback) {
	var api_server;

	var mocks = {
		app: {
			set: function(prop, value) {},
			use: function(middleware) {} ,
			post: function(path, middleware, handler) {} ,
			get: function(path, handler) {},
		},
		db: {},
		req: {},
		res: {},
		url: {},
		config: {},
		validation: {},
		mock_logger: {
			logger: {
				log: function(level, msg) {},
				warn: function(msg) {},
				error: function(msg) {}
			}
		}
	}
	var spies = {
		app: {},
		db: {},
		req: {},
		res: {},
		url: {},
		validation: {},
		logger: {
			log: sinon.spy(mocks.mock_logger.logger, 'log'),
			warn: sinon.spy(mocks.mock_logger.logger, 'warn'),
			error: sinon.spy(mocks.mock_logger.logger, 'error'),
		}
	}
	// Complete app mock implementation and add spies.
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
		if (implementations.config == undefined) {
			mocks.config = {
				accounting_proxy: {
					admin_port: 9001
				}
			}
		} else if (implementations.config.accounting_proxy == undefined) {
			mocks.config.accounting_proxy = {
				admin_port: 9001
			}
		}
		mocks.config.database = './db';
		api_server = proxyquire('../../APIServer', {
			express: function() {
				return mocks.app;
			},
			'./config': mocks.config,
			'./db': mocks.db,
			'url': mocks.url,
			'./accounting-proxy': mocks.mock_logger,
			'./validation': mocks.validation
		});
		return callback(api_server, spies);
	});
}

describe('Testing APIServer', function() {

	describe('Function "run"', function() {

		it('correct', function(done) {
			var port = 9001;
			var get_args = ['/api/users/keys', '/api/units', 'port'];
			var post_args = ['/api/resources', '/api/users'];
			var implementations = {
				app: {
					listen: function(port) {},
					get: function(prop) {
						return port;
					},
					post: function(path, middleware, handler) {},
					set: function(prop, value) {},
					use: function(middleware) {}
				},
				config: {
					accounting_proxy: {
						admin_port: port
					}
				}
			}
			mocker(implementations, function(api, spies) {
				api.run();
				assert.equal(spies.app.get.callCount, 3);
				async.forEachOf(get_args, function(arg, i, task_callback) {
					assert.equal(spies.app.get.getCall(i).args[0], arg);
				});
				assert.equal(spies.app.post.callCount, 2);
				async.forEachOf(post_args, function(arg, i, task_callback) {
					assert.equal(spies.app.post.getCall(i).args[0], arg);
				});
				assert.equal(spies.app.listen.callCount, 1);
				assert.equal(spies.app.listen.getCall(0).args[0], implementations.config.accounting_proxy.admin_port);
				assert.equal(spies.app.set.callCount, 1);
				assert.equal(spies.app.set.getCall(0).args[0], 'port');
				assert.equal(spies.app.set.getCall(0).args[1], implementations.config.accounting_proxy.admin_port);
				assert.equal(spies.app.use.callCount, 1);
				done();
			});
		});
	});

	describe('Function "getUnits"', function() {

		it('correct (200)', function() {
			var modules = ['cal', 'megabyte'];
			var implementations = {
				app: {
					get: function(path, callback) {
						if('/api/units' === path) {
							return callback(implementations.req, implementations.res);
						}
					}
				},
				req: {},
				res: {
					status: function(code) {
						return this;
					},
					json: function(body) {}
				},
				config: {
					modules: {
						accounting: modules
					}
				}
			}
			mocker(implementations, function(api, spies) {
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 200);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], {units: modules});
			});
		});
	});

	describe('Function "getApiKeys"', function() {

		it('error user not specified', function(done) {
			var implementations = {
				app: {
					get: function(path, callback) {
						if('/api/users/keys' === path) {
							return callback(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						return undefined;
					}
				},
				res: {
					status: function(code) {
						return this;
					},
					json: function(body) {}
				}
			}
			mocker(implementations, function(api, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Undefined "X-Actor-ID" header'});
				done();
			});
		});

		it('error getting the apiKeys from DB', function(done) {
			var user = '0001';
			var implementations = {
				app: {
					get: function(path, callback) {
						if('/api/users/keys' === path) {
							return callback(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						return user;
					}
				},
				res: {
					status: function(code) {
						return this;
					},
					send: function() {}
				},
				db: {
					getApiKeys: function(user, callback) {
						return callback('Error', null)
					}
				}

			}
			mocker(implementations, function(api, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('no apiKeys available', function(done) {
			var user = '0001';
			var implementations = {
				app: {
					get: function(path, callback) {
						if('/api/users/keys' === path) {
							return callback(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						return user;
					}
				},
				res: {
					status: function(code) {
						return this;
					},
					send: function() {}
				},
				db: {
					getApiKeys: function(user, callback) {
						return callback(null, null)
					}
				}
			}
			mocker(implementations, function(api, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('apiKeys avilable', function(done) {
			var user = '0001';
			var apiKeys = ['apiKey1', 'apiKey1'];
			var implementations = {
				app: {
					get: function(path, callback) {
						if('/api/users/keys' === path) {
							return callback(implementations.req, implementations.res);
						}
					}
				},
				req: {
					get: function(header) {
						return user;
					}
				},
				res: {
					status: function(code) {
						return this;
					},
					json: function(body) {}
				},
				db: {
					getApiKeys: function(user, callback) {
						return callback(null, apiKeys);
					}
				}

			}
			mocker(implementations, function(api, spies) {
				assert.equal(spies.req.get.callCount, 1);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-Actor-ID');
				assert.equal(spies.db.getApiKeys.callCount, 1);
				assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 200);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], apiKeys);
				done();
			});
		});
	});

	describe('Function "checkUrl"', function() {

		it('Invalid content-type', function(done) {
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/resources') {
							return middleware(implementations.req, implementations.res, handler);
						}
					}
				},
				req: {
					is: function(type) {
						return false;
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(json) {}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(0).args[0] , '/api/resources');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 415);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Content-Type must be "application/json"'});
				done();
			});
		});

		it('undefined URL in body', function(done) {
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/resources') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					},
					setEncoding: function(encoding) {},
					body: {}
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(json) {}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(0).args[0] , '/api/resources');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 400);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Invalid body, url undefined'});
				done();
			});
		});

		it('error checking the url', function(done) {
			var token = 'token';
			var url = 'http://example.com/path';
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/resources') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					},
					setEncoding: function(encoding) {},
					get: function(header) {
						return token;
					},
					body: {
						url: url
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					send: function() {}
				},
				db: {
					addToken: function(token, callback) {
						return callback('Error');
					},
					checkUrl: function(url, callback) {
						return callback('Error', false);
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(0).args[0], '/api/resources');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 500);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.addToken.callCount, 1);
				assert.equal(spies.db.addToken.getCall(0).args[0], token);
				assert.equal(spies.db.checkUrl.callCount, 1);
				assert.equal(spies.db.checkUrl.getCall(0).args[0], url);
				done();
			});
		});

		it('invalid url', function(done) {
			var token = 'token';
			var url = 'http://example.com/path';
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/resources') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					},
					setEncoding: function(encoding) {},
					get: function(header) {
						return token;
					},
					body: {
						url: url
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(msg) {}
				},
				db: {
					addToken: function(token, callback) {
						return callback('Error');
					},
					checkUrl: function(url, callback) {
						return callback(null, false);
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(0).args[0], '/api/resources');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 400);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Incorrect url ' + url});
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.addToken.callCount, 1);
				assert.equal(spies.db.addToken.getCall(0).args[0], token);
				assert.equal(spies.db.checkUrl.callCount, 1);
				assert.equal(spies.db.checkUrl.getCall(0).args[0], url);
				done();
			});
		});

		it('correct url', function(done) {
			var token = 'token';
			var url = 'http://example.com/path';
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/resources') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					},
					setEncoding: function(encoding) {},
					get: function(header) {
						return token;
					},
					body: {
						url: url
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					send: function() {}
				},
				db: {
					addToken: function(token, callback) {
						return callback('Error');
					},
					checkUrl: function(url, callback) {
						return callback(null, true);
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(0).args[0], '/api/resources');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0], 200);
				assert.equal(spies.res.send.callCount, 1);
				assert.equal(spies.req.get.callCount, 2);
				assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
				assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
				assert.equal(spies.db.addToken.callCount, 1);
				assert.equal(spies.db.addToken.getCall(0).args[0], token);
				assert.equal(spies.db.checkUrl.callCount, 1);
				assert.equal(spies.db.checkUrl.getCall(0).args[0], url);
				done();
			});
		});
	});

	describe('Function "newBuy"', function() {

		it('invalid content-type', function(done) {
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/users') {
							return middleware(implementations.req, implementations.res, handler);
						}
					}
				},
				req: {
					is: function(type) {
						return false;
					}
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(json) {}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(1).args[0] , '/api/users');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 415);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Content-Type must be "application/json"'});
				done();
			});
		});

		it('invalid json', function(done) {
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/users') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					}, 
					setEncoding: function(encoding) {},
					body: {}
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(json) {}
				},
				validation: {
					validate: function(schema, body, callback) {
						return callback('Error');
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(1).args[0] , '/api/users');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.validation.validate.callCount, 1);
				assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
				assert.deepEqual(spies.validation.validate.getCall(0).args[1] , {});
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 400);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Invalid json'});
				done();
			});
		});

		it('error adding the information to db', function(done) {
			var path = '/path';
			var body = {
				orderID: 'orderId',
				productId: 'productId',
				customer: '0001',
				productSpecification: {
					unit: 'call',
					recordType: 'callusage',
					url: 'http://example.com' + path
				}
			}
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/users') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					}, 
					setEncoding: function(encoding) {},
					body: body
				},
				res: {
					status: function(status) {
						return this;
					},
					send: function() {}
				},
				validation: {
					validate: function(schema, body, callback) {
						return callback(null);
					}
				},
				db: {
					newBuy: function(buy, callback) {
						return callback('Error');
					}
				}, 
				url: {
					parse: function(url) {
						return {
							pathname: path
						};
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(1).args[0] , '/api/users');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.validation.validate.callCount, 1);
				assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
				assert.deepEqual(spies.validation.validate.getCall(0).args[1] , body);
				assert.equal(spies.db.newBuy.callCount, 1);
				assert.deepEqual(spies.db.newBuy.getCall(0).args[0], {
					apiKey: 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb',
					publicPath: path,
					orderId: body.orderId,
					productId: body.productId,
					customer: body.customer,
					unit: body.productSpecification.unit,
					recordType: body.productSpecification.recordType
				});
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 400);
				assert.equal(spies.res.send.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			var path = '/path';
			var body = {
				orderID: 'orderId',
				productId: 'productId',
				customer: '0001',
				productSpecification: {
					unit: 'call',
					recordType: 'callusage',
					url: 'http://example.com' + path
				}
			}
			var implementations = {
				app: {
					post: function(path, middleware, handler) {
						if (path === '/api/users') {
							return middleware(implementations.req, implementations.res, function() {
								handler(implementations.req, implementations.res);
							});
						}
					}
				},
				req: {
					is: function(type) {
						return true;
					}, 
					setEncoding: function(encoding) {},
					body: body
				},
				res: {
					status: function(status) {
						return this;
					},
					json: function(msg) {}
				},
				validation: {
					validate: function(schema, body, callback) {
						return callback(null);
					}
				},
				db: {
					newBuy: function(buy, callback) {
						return callback(null);
					}
				}, 
				url: {
					parse: function(url) {
						return {
							pathname: path
						};
					}
				}
			}
			mocker(implementations, function(proxy, spies) {
				assert.equal(spies.app.post.callCount, 2);
				assert.equal(spies.app.post.getCall(1).args[0] , '/api/users');
				assert.equal(spies.req.is.callCount, 1);
				assert.equal(spies.req.is.getCall(0).args[0] , 'application/json');
				assert.equal(spies.validation.validate.callCount, 1);
				assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
				assert.deepEqual(spies.validation.validate.getCall(0).args[1] , body);
				assert.equal(spies.db.newBuy.callCount, 1);
				assert.deepEqual(spies.db.newBuy.getCall(0).args[0], {
					apiKey: 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb',
					publicPath: path,
					orderId: body.orderId,
					productId: body.productId,
					customer: body.customer,
					unit: body.productSpecification.unit,
					recordType: body.productSpecification.recordType
				});
				assert.equal(spies.res.status.callCount, 1);
				assert.equal(spies.res.status.getCall(0).args[0] , 201);
				assert.equal(spies.res.json.callCount, 1);
				assert.deepEqual(spies.res.json.getCall(0).args[0], {'API-KEY': 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb'});
				done();
			});
		});
	});
});