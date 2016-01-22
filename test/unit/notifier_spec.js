var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon');

var mocker = function(implementations, callback) {
	var proxy_notifier, mocks, spies;

	// Create mocks and spies
	var log_mock = {
		log: function(level, msg) {},
		warn: function(msg) {}
	}
	mocks = {
		db: {},
		config: {},
		info: {},
		http: {},
		logger: {
			Logger: function(transports) {
				return log_mock;
			}
		}
	}
	spies = {
		db: {},
		config: {},
		info: {},
		http: {},
		logger: {
			log: sinon.spy(log_mock, 'log'),
			warn: sinon.spy(log_mock, 'warn')
		}
	}
	mocks.config = implementations.config;
	if (implementations.db.resetCount != undefined) {
		mocks.db.resetCount = implementations.db.resetCount;
		spies.db.resetCount = sinon.spy(mocks.db, 'resetCount');
	}	
	if (implementations.db.getAccountingInfo != undefined) {
		mocks.db.getAccountingInfo = implementations.db.getAccountingInfo;
		spies.db.getAccountingInfo = sinon.spy(mocks.db, 'getAccountingInfo');
	}
	if (implementations.http != undefined && implementations.http.request != undefined) {
		mocks.http.request = implementations.http.request;
		spies.http.request = sinon.spy(mocks.http, 'request');
	}
	// Mock dependencies
	proxy_notifier = proxyquire('../../notifier', {
		'./config': mocks.config,
		'./db': mocks.db,
		'winston': mocks.logger,
		'./HTTP_Client/info.json': mocks.info,
		'http': mocks.http
	});
	return callback(proxy_notifier, spies);
}
describe('Testing Notifier', function() {

	describe('notify', function() {
		var implementations = {
			config: {
				database: './db'
			},
			db: {}
		}
		var accounting_info = {
			publicPath: '/path',
			organization: 'organization',
			name: 'name',
			version: 1.0,
			num: 1.23,
			reference: 'reference'
		}

		it('no request needed', function(done) { // Logger test?
			var accounting_info = {
				num: 0
			};
			mocker(implementations, function(proxy_notifier, spies) {
				proxy_notifier.notify(accounting_info);
				assert.equal(spies.logger.log.callCount, 1);
				assert.equal(spies.logger.log.getCall(0).args[0], 'debug');
				assert.equal(spies.logger.log.getCall(0).args[1], 'No request needed.');
				done();
			});
		});

		it('error getting accounting info from db', function(done) {
			implementations.db.getAccountingInfo = function(path, info, callback) {
				return callback('Error', null);
			}
			mocker(implementations, function(proxy_notifier, spies) {
				proxy_notifier.notify(accounting_info);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], '/path');
				assert.deepEqual(spies.db.getAccountingInfo.getCall(0).args[1], {
					organization: accounting_info.organization,
					name: accounting_info.name,
					version: accounting_info.version
				});
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Error while notifying');
				done();
			});
		});

		it('error, request failed', function(done) {
			implementations.info = {
				offering: {}
			}
			implementations.config.WStore = {
				accounting_host: 'localhost',
				accounting_port: 9010,
				accounting_path: '/path'
			}
			implementations.http = {
				request: function(options, callback) {
					callback({
						statusCode: 400
					});
					return {
						write: function(body) {},
						end: function() {}
					}
				}
			}
			implementations.db.getAccountingInfo = function(path, info, callback) {
				return callback(null, {
					unit: 'megabyte',
					record_type: 'rec_type',
					component_label: 'label'
				});
			}
			mocker(implementations, function(proxy_notifier, spies) {
				proxy_notifier.notify(accounting_info);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.http.request.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], '/path');
				assert.deepEqual(spies.db.getAccountingInfo.getCall(0).args[1], {
					organization: accounting_info.organization,
					name: accounting_info.name,
					version: accounting_info.version
				});
				assert.deepEqual(spies.http.request.getCall(0).args[0], {
					host: implementations.config.WStore.accounting_host,
					port: implementations.config.WStore.accounting_port,
					path: implementations.config.WStore.accounting_path + accounting_info.reference + '/accounting',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': 194
					}
				});
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Resquest failed!');
				done();
			});
		});

		it('error reseting the accounting', function(done) {
			implementations.http = {
				request: function(options, callback) {
					callback({
						statusCode: 200
					});
					return {
						write: function(body) {},
						end: function() {}
					}
				}
			}
			implementations.db.resetCount = function(user, api_key, publicPath, callback) {
				return callback('Error');
			}
			mocker(implementations, function(proxy_notifier, spies) {
				proxy_notifier.notify(accounting_info);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 1);
				assert.equal(spies.logger.log.callCount, 2);
				assert.equal(spies.http.request.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], '/path');
				assert.deepEqual(spies.db.getAccountingInfo.getCall(0).args[1], {
					organization: accounting_info.organization,
					name: accounting_info.name,
					version: accounting_info.version
				});
				assert.deepEqual(spies.http.request.getCall(0).args[0], {
					host: implementations.config.WStore.accounting_host,
					port: implementations.config.WStore.accounting_port,
					path: implementations.config.WStore.accounting_path + accounting_info.reference + '/accounting',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': 194
					}
				});
				assert.equal(spies.logger.warn.getCall(0).args[0], 'Error while reseting the account');
				done();
			});
		});

		it('correct notification', function(done) {
			implementations.db.resetCount = function(user, api_key, publicPath, callback) {
				return callback(null);
			}
			mocker(implementations, function(proxy_notifier, spies) {
				proxy_notifier.notify(accounting_info);
				assert.equal(spies.db.getAccountingInfo.callCount, 1);
				assert.equal(spies.logger.warn.callCount, 0);
				assert.equal(spies.logger.log.callCount, 2);
				assert.equal(spies.http.request.callCount, 1);
				assert.equal(spies.db.getAccountingInfo.getCall(0).args[0], '/path');
				assert.deepEqual(spies.db.getAccountingInfo.getCall(0).args[1], {
					organization: accounting_info.organization,
					name: accounting_info.name,
					version: accounting_info.version
				});
				assert.deepEqual(spies.http.request.getCall(0).args[0], {
					host: implementations.config.WStore.accounting_host,
					port: implementations.config.WStore.accounting_port,
					path: implementations.config.WStore.accounting_path + accounting_info.reference + '/accounting',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': 194
					}
				});
				done();
			});
		});
	});
});