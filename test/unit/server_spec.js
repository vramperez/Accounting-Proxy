var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');
	


var mocker = function(implementations, callback) {
	var mocks, spies, proxy_server;

	mocks = {
		app: {},
		config: {},
		api: {},
		notifier: {},
		cron: {},
		async: {
			series: async.series,
			each: async.each
		},
		url: {},
		request: {},
		db: {},
		mock_logger: {
			logger: {
				log: function(level, msg) {},
				warn: function(msg) {},
				error: function(msg) {}
			}
		},
		contextBroker: {},
		mkdirp: {
			mkdirp: function(path, callback) {
				return callback();
			}
		},
		acc_modules: {}
	}

	spies = {
		app: {},
		config: {},
		api: {},
		notifier: {},
		cron: {},
		async: {},
		url: {},
		request: {},
		db: {},
		logger: {
			log: sinon.spy(mocks.mock_logger.logger, 'log'),
			warn: sinon.spy(mocks.mock_logger.logger, 'warn'),
			error: sinon.spy(mocks.mock_logger.logger, 'error'),
		},
		contextBroker: {},
		mkdirp: {},
		acc_modules: {}
	}

	// Complete app_mock implementation and add spies
	mocks.config.database = './db';
	console.log(implementations.config.accounting_proxy.port == undefined)
	if (implementations.config == undefined || implementations.config.accounting_proxy.port == undefined) {
			mocks.config.accounting_proxy = {
				port: 9000
			}
	}
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
			'./orion_context_broker/cb_handler': mocks.contextBroker,
			mkdirp: mocks.mkdir.mkdirp
		});
		return callback(server, spies);
	});
}

describe('Testing Server', function() {

	describe('Function "initialize"', function() {

		it('error loading accounting modules', function(done) {
			var implementations = {
				config: {
					modules: {
						accounting: ['megabyte', 'no_exist']
					}
				},
				db: {
					init: function(){}
				}
			}
			mocker(implementations, function(server, spies) {
				server.init();
				assert.equal(spies.db.init.callCount, 1);
				assert.equal(spies.async.series.callCount, 1);
				assert.equal(spies.logger.error.callCount, 1);
				assert.equal(spies.logger.error.getCall(0).args[0], '');
			});
		});
	});
});