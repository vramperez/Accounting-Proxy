var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon');

describe('Testing SQLITE database,', function() {

	describe('init', function() {

		it('correct', function() {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(create) { }
					}
				}
			};
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.init();
		});
	});

	describe('newService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('deleteService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.deleteService('', function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.deleteService('', function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getService('',function(err, service) {
				assert.equal(err, 'Error');
				assert.equal(service, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, [{port: '', url: ''}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getService('',function(err, service) {
				assert.equal(err, null);
				assert.deepEqual(service, {port: '', url: ''});
				done();
			});
		});
	});

	describe('getInfo', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				done();
			});
		});

		it('no results', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, {});
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, {info: 'info'});
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, {info: 'info'});
				done();
			});
		});
	});
	
	describe('addResource', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(query, params, callback) {
							return callback('Error');
						}
					}
				}
			};
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			var data = 
			{
				publicPath: '',
				offering: 
				{
					organization: '',
					name: '',
					version: ''
				},
				record_type: '',
				unit: '',
				component_label: ''
			};
			db.addResource(data, function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(query, params, callback) {
							return callback(null);
						}
					}
				}
			};
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			var data = 
			{
				publicPath: '',
				offering: 
				{
					organization: '',
					name: '',
					version: ''
				},
				record_type: '',
				unit: '',
				component_label: ''
			};
			db.addResource(data, function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getUnit', function() {
		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getUnit('', '', '', '', function(err, res) {
				assert.equal(err, 'Error');
				assert.equal(res, null);
				done();
			});
		});

		it('no results', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getUnit('', '', '', '', function(err, res) {
				assert.equal(err, null);
				assert.equal(res, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, [{unit: 'megabyte'}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getUnit('', '', '', '', function(err, res) {
				assert.equal(err, null);
				assert.equal(res, 'megabyte');
				done();
			});
		});
	});

	describe('getApiKeys', function() {

		it('query error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, callback) {
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, 'Error');
				assert.equal(api_keys, null);
				done();
			});
		});

		it('no api_keys available', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, callback) {
							return callback(null, undefined);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, null);
				assert.deepEqual(api_keys, []);
				done();
			});
		});

		it('async error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, callback) {
							return callback(null, {});
						}
					};
				}
			}
			var async_stub = {
				each: function(list, handler, callback) {
					return callback('Async error');
				}
			}
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, 'Async error');
				assert.deepEqual(api_keys, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, callback) {
							return callback(null, [{API_KEY: 'api_key'}]);
						}
					};
				}
			}
			var async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], function(param) {
						return callback(param);
					});
				}
			}
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, null);
				assert.deepEqual(api_keys, ['api_key']);
				done();
			});
		});
	});

	describe('getResources', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getResources('', function(err, res) {
				assert.equal(err, 'Error');
				assert.equal(res, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, ['resource']);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getResources('', function(err, res) {
				assert.equal(err, null);
				assert.equal(res, 'resource');
				done();
			});
		});
	});

	describe('getNotificationInfo', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getNotificationInfo('', '', function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				done();;
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, ['info']);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getNotificationInfo('', '', function(err, info) {
				assert.equal(err, null);
				assert.equal(info, 'info');
				done();;
			});
		});
	});

	describe('checkBuy', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkBuy('', '', function(err, buy) {
				assert.equal(err, 'Error');
				assert.equal(buy, null);
				done();
			});
		});

		it('correct, bought', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, ['not_empty']);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkBuy('', '', function(err, buy) {
				assert.equal(err, null);
				assert.equal(buy, true);
				done();
			});
		});

		it('correct, not bought', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback) {
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkBuy('', '', function(err, buy) {
				assert.equal(err, null);
				assert.equal(buy, false);
				done();
			});
		});
	});

	describe('count', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.count('', '', '', '', function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.count('', '', '', '', function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('resetCount', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.resetCount('', '', '', function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.resetCount('', '', '', function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getApiKey', function() {

		it('Error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getApiKey('', '', function(err, api_key) {
				assert.equal(err, 'Error');
				assert.equal(api_key, null);
				done();
			});
		});

		it('no api_key available', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getApiKey('', '', function(err, api_key) {
				assert.equal(err, null);
				assert.equal(api_key, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, [{API_KEY: 'api_key'}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getApiKey('', '', function(err, api_key) {
				assert.equal(err, null);
				assert.equal(api_key, 'api_key');
				done();
			});
		});
	});

	describe('getAccountingINfo', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getAccountingInfo('', '', function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				done();
			});
		});

		it('no info available', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getAccountingInfo('', '', function(err, info) {
				assert.equal(err, null);
				assert.equal(info, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, ['info']);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getAccountingInfo('', '', function(err, info) {
				assert.equal(err, null);
				assert.equal(info, 'info');
				done();
			});
		});
	});

	describe('addInfo', function() {

		var data = {
				publicPath: '',
				organization: '',
				name: '',
				version: '',
				actorID: '',
				reference: '',
				accounting: {
					'path1': { 
						num: 1,
						correlation_number: 001
					}
				}
			};

		it('error first query', function(done) {
			var obj = {
				serialize: function(callback) {
					return callback();
				},
				run: function(query, params, callback) {
					return callback('Error first query');
				}
			}
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return obj;
				}
			};
			var async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], path, function(param) {
						return callback(param);
					});
				}
			}
			var spy = sinon.spy(obj, 'run');
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.addInfo('', data, function(err) {
				assert.equal(err, 'Error first query');
				assert(spy.calledOnce);
				done();
			});
		});

		it('error second query', function(done) {
			var obj = {
				serialize: function(callback) {
					return callback();
				},
				run: function(query, params, callback) {
					if(query === 'INSERT OR REPLACE INTO accounting                             VALUES ($actorID, $API_KEY, $num, $publicPath, $correlation_number)') {
						return callback('Error second query');
					} else {
						return callback(null);
					}
				}
			}
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return obj;
				}
			};
			var async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], path, function(param) {
						return callback(param);
					});
				}
			}
			var spy = sinon.spy(obj, 'run');
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.addInfo('', data, function(err) {
				assert.equal(err, 'Error second query');
				assert(spy.calledTwice);
				done();
			});
		});

		it('correct (1 element)', function(done) {
			var obj = {
				serialize: function(callback) {
					return callback();
				},
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return obj;
				}
			};
			var async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], path, function(param) {
						return callback(param);
					});
				}
			}
			var spy = sinon.spy(obj, 'run');
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.addInfo('', data, function(err) {
				assert.equal(null);
				assert(spy.calledTwice);
				done();
			});
		});

		it('correct (2 element)', function(done) {
			var obj = {
				serialize: function(callback) {
					return callback();
				},
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return obj;
				}
			};
			var async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], path, function(param) {
						return callback(param);
					});
				}
			}
			data.accounting['path2'] = {
				num: 1,
				correlation_number: 001
			}
			var spy = sinon.spy(obj, 'run');
			var db = proxyquire('../../db', 
				{'sqlite3': sqlite_stub,
				 'async': async_stub});
			db.addInfo('', data, function(err) {
				assert.equal(null);
				assert.equal(spy.callCount, 4);
				done();
			});
		});
	});

	describe('checkInfo', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkInfo('', '', '', function(err, unit) {
				assert.equal(err, 'Error');
				assert.equal(unit, null);
				done();
			});
		});

		it('no info available', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkInfo('', '', '', function(err, unit) {
				assert.equal(err, null);
				assert.equal(unit, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, [{unit: 'megabyte'}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.checkInfo('', '', '', function(err, unit) {
				assert.equal(err, null);
				assert.equal(unit, 'megabyte');
				done();
			});
		});
	});

	describe('addCBSubscription', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(query, params, callback) {
							return callback('Error');
						}
					}
				}
			};
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.addCBSubscription('', '', '', '', '', '', '', function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(query, params, callback) {
							return callback(null);
						}
					}
				}
			};
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.addCBSubscription('', '', '', '', '', '', '', function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getCBSubscription', function(done) {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getCBSubscription('', function(err, subs_info) {
				assert.equal(err, 'Error');
				assert.equal(subs_info, null);
				done();
			});
		});

		it('no subscription info available', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getCBSubscription('', function(err, subs_info) {
				assert.equal(err, null);
				assert.equal(subs_info, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, [{subs_info: 'subs_info'}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getCBSubscription('', function(err, subs_info) {
				assert.equal(err, null);
				assert.deepEqual(subs_info, {subs_info: 'subs_info'});
				done();
			});
		});
	});

	describe('deleteCBSubscription', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.deleteCBSubscription('', function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.deleteCBSubscription('', function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});
});