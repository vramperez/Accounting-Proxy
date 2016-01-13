var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon');

describe('Testing REDIS database,', function() {

	describe('newService', function(done) {
		var spy_sadd, spy_hmset, spy_exec;
		var db, multi;

		before(function() {
			db = {
				on: function(event, callback){
					return callback();
				},
				multi: function(){
					return multi;
				}
			}
			multi = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return db;
				}
			};
			spy_sadd = sinon.spy(multi, 'sadd');
			spy_hmset = sinon.spy(multi, 'hmset');
		});

		beforeEach(function() {
			spy_sadd.reset();
			spy_hmset.reset();
		});

		it('syntax error in transaction', function(done) {
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.newService('', '', '', function(err) {
				assert.equal(err, 'Error');
				assert(spy_sadd.calledOnce);
				assert(spy_hmset.calledOnce);
				assert(spy_exec.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			multi.exec = function(callback) {
				return callback(null);
			}
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.newService('', '', '', function(err) {
				assert.equal(err, null);
				assert(spy_sadd.calledOnce);
				assert(spy_hmset.calledOnce);
				assert(spy_exec.calledOnce);
				done();
			});
		});
	});

	describe('getService', function() {
		var spy_hgetall;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_hgetall.reset();
		});

		it('error', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getService('', function(err, service) {
				assert.equal(err, 'Error');
				assert.equal(service, null);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback(null, {service: 'service'})
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getService('', function(err, service) {
				assert.equal(err, null);
				assert.deepEqual(service, {service: 'service'});
				assert(spy_hgetall.calledOnce);
				done();
			});
		});
	});

	describe('deleteService', function() {
		var spy_del, spy_srem, spy_exec;
		var multi;

		before(function() {
			db = {
				on: function(event, callback){
					return callback();
				},
				multi: function(){
					return multi;
				}
			}
			multi = {
				del: function(){},
				srem: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return db;
				}
			};
			spy_del = sinon.spy(multi, 'del');
			spy_srem = sinon.spy(multi, 'srem');
		});

		beforeEach(function() {
			spy_del.reset();
			spy_srem.reset();
		});

		it('syntax error in transaction', function(done) {
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.deleteService('', function(err) {
				assert.equal(err, 'Error');
				assert(spy_del.calledOnce);
				assert(spy_srem.calledOnce);
				assert(spy_exec.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			multi.exec = function(callback) {
				return callback(null, null);
			}
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.deleteService('', function(err) {
				assert.equal(err, null);
				assert(spy_del.calledOnce);
				assert(spy_srem.calledOnce);
				assert(spy_exec.calledOnce);
				done();
			});
		});
	});

	describe('getInfo', function() {
		var spy_smembers, spy_hgetall;
		var mock_db;	

		before(function() {
			async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], function(param) {
						return callback(param);
					});
				}
			}
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				smembers: function(key, callback) {
					return callback('Error', null);
				},
				hgetall: function(key, callback) {
					return callback('Error', null);	
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_smembers.reset();
			spy_hgetall.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getInfo('', function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				assert(spy_smembers.calledOnce);
				assert.equal(spy_hgetall.callCount, 0);
				done();
			});
		});

		it('error, second query failed', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback('Error', null);
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getInfo('', function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				assert(spy_smembers.calledOnce);
				assert.equal(spy_hgetall.callCount, 0);
				done();
			});
		});

		it('correct, no info available', function(done) {
			mock_db.smembers = function(key, callback) {
				return callback(null, []);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getInfo('', function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, {});
				assert(spy_smembers.calledOnce);
				assert.equal(spy_hgetall.callCount, 0);
				done();
			});
		});

		it('correct, info available', function(done) {
			mock_db.smembers = function(key, callback) {
				return callback(null, ['api_key']);
			}
			mock_db.hgetall = function(key, callback) {
				return callback(null, {
					organization: '',
					name: '',
					version: ''
				});
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getInfo('', function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, { api_key: { 
					API_KEY: 'api_key', 
					organization: '',
					name: '',
					version: '' } 
				});
				assert(spy_smembers.calledOnce);
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});
	});

	describe('addResource', function() {
		var spy_sadd, spy_hmset, spy_exec;
		var multi;
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

		before(function() {
			db = {
				on: function(event, callback){
					return callback();
				},
				multi: function(){
					return multi;
				}
			}
			multi = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return db;
				}
			};
			spy_sadd = sinon.spy(multi, 'sadd');
			spy_hmset = sinon.spy(multi, 'hmset');
		});

		beforeEach(function() {
			spy_sadd.reset();
			spy_hmset.reset();
		});

		it('syntax error in transaction', function(done) {
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.addResource(data, function(err) {
				assert.equal(err, 'Error');
				assert(spy_sadd.calledOnce);
				assert(spy_hmset.calledOnce);
				assert(spy_hmset.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			multi.exec = function(callback) {
				return callback(null, null);
			}
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.addResource(data, function(err) {
				assert.equal(err, null);
				assert(spy_sadd.calledOnce);
				assert(spy_hmset.calledOnce);
				assert(spy_hmset.calledOnce);
				done();
			});
		});
	});

	describe('getUnit', function() {
		var spy_hgetall;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_hgetall.reset();
		});

		it('error', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getUnit('', '', '', '', function(err, unit) {
				assert.equal(err, 'Error');
				assert.equal(unit, null);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('error, service no created', function(done) {
			mock_db.hgetall  = function(key, callback){
				return callback(null, undefined);
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getUnit('', '', '', '', function(err, unit) {
				assert.equal(err, null);
				assert.equal(unit, null);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.hgetall  = function(key, callback){
				return callback(null, {unit: 'megabyte'});
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getUnit('', '', '', '', function(err, unit) {
				assert.equal(err, null);
				assert.equal(unit, 'megabyte');
				assert(spy_hgetall.calledOnce);
				done();
			});
		});
	});

	describe('getApiKeys', function() {
		var spy_smembers;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_smembers = sinon.spy(mock_db, 'smembers');
		});

		beforeEach(function() {
			spy_smembers.reset();
		});

		it('error', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, 'Error');
				assert.equal(api_keys, null);
				assert(spy_smembers.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.smembers = function(key, callback) {
				return callback(null, ['api_key1']);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getApiKeys(function(err, api_keys) {
				assert.equal(err, null);
				assert.deepEqual(api_keys, ['api_key1']);
				assert(spy_smembers.calledOnce);
				done();
			});
		});
	});

	describe('getResources', function() {
		var spy_smembers;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_smembers = sinon.spy(mock_db, 'smembers');
		});

		beforeEach(function() {
			spy_smembers.reset();
		});

		it('error', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getResources('', function(err, resource) {
				assert.equal(err, 'Error');
				assert.deepEqual(resource, null);
				assert(spy_smembers.calledOnce);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.smembers = function(key, callback){
				return callback(null, ['/path1', '/path2']);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getResources('', function(err, resource) {
				assert.equal(err, null);
				assert.deepEqual(resource, ['/path1', '/path2']);
				assert(spy_smembers.calledOnce);
				done();
			});
		});
	});

	describe('getNotificationInfo', function() {
		var spy_hgetall;
		var mock_db;
		var api_key_info = {
			actorID: '0001',
			organization: '',
			name: '',
			version: '',
			reference: ''
		}		

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_hgetall.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getNotificationInfo('', '', function(err, notificationInfo) {
				assert.equal(err, 'Error');
				assert.deepEqual(notificationInfo, null);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('error, second query failed', function(done) {
			mock_db.hgetall = function(key, callback) {
				if (key != 'api_key') {
					return callback('Error', null);
				} else {
					return callback(null, api_key_info);
				}
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getNotificationInfo('api_key', '', function(err, notificationInfo) {
				assert.equal(err, 'Error');
				assert.deepEqual(notificationInfo, null);
				assert(spy_hgetall.calledTwice);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.hgetall = function(key, callback) {
				if (key === 'api_key') {
					return callback(null, api_key_info);
				} else {
					return callback(null, {correlation_number: '', num: ''});
				}
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getNotificationInfo('api_key', '', function(err, notificationInfo) {
				assert.equal(err, null);
				assert.deepEqual(notificationInfo, { 
					actorID: '0001',
				  	API_KEY: 'api_key',
				  	publicPath: '',
				  	organization: '',
				  	name: '',
				  	version: '',
				  	correlation_number: '',
				  	num: '',
				  	reference: ''
				});
				assert(spy_hgetall.calledTwice);
				done();
			});
		});
	});

	describe('checkBuy', function() {
		var spy_smembers, spy_each, async_stub;
		var mock_db;	

		before(function() {
			async_stub = {
				each: function(list, handler, callback) {
					return callback('Async error');
				}
			}
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_each = sinon.spy(async_stub, 'each');
		});

		beforeEach(function() {
			spy_smembers.reset();
			spy_each.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.checkBuy('', '', function(err, bought) {
				assert.equal(err, 'Error');
				assert(spy_smembers.calledOnce);
				done();
			});
		});

		it('error, async error', function(done) {
			mock_db.smembers = function(key, callback) {
				return callback(null, []);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.checkBuy('', '', function(err, bougth) {
				assert.equal(err, 'Async error');
				assert(spy_smembers.calledOnce);
				assert(spy_each.calledOnce);
				done();
			});
		});

		it('correct, not bought', function(done) {
			async_stub.each = function(list, handler, callback) {
				return handler(list[0], function(param) {
						return callback(param);
				});
			}
			mock_db.smembers = function(key, callback) {
				return callback(null, ['/path1']);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_each = sinon.spy(async_stub, 'each');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.checkBuy('', 'not_bought', function(err, bought) {
				assert.equal(err, null);
				assert.equal(bought, false);
				assert(spy_smembers.calledOnce);
				assert(spy_each.calledOnce);
				done();
			});
		});

		it('correct, bought', function(done) {
			async_stub.each = function(list, handler, callback) {
				return handler(list[0], function(param) {
						return callback(param);
				});
			}
			mock_db.smembers = function(key, callback) {
				return callback(null, ['/path1']);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_each = sinon.spy(async_stub, 'each');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.checkBuy('', '/path1', function(err, bought) {
				assert.equal(err, null);
				assert.equal(bought, true);
				assert(spy_smembers.calledOnce);
				assert(spy_each.calledOnce);
				done();
			});
		});
	});

	describe('addInfo', function() {
		var spy_sadd, spy_hmset, spy_exec;
		var mock_db, multi;
		var data = {
			actorID: '',
			accounting: {
				'path1': { 
					num: 1,
					correlation_number: 001
				}
			}
		}

		before(function() {
			async_stub = {
				forEachOf: function(list, handler, callback) {
					return callback('Async error');
				}
			}
			multi = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			db = {
				on: function(event, callback){
					return callback();
				},
				multi: function(){
					return multi;
				}
			}
			redis_stub = {
				createClient: function() {
					return db;
				}
			};
			spy_sadd = sinon.spy(multi, 'sadd');
			spy_hmset = sinon.spy(multi, 'hmset');
			spy_exec = sinon.spy(multi, 'exec');
		});

		beforeEach(function() {
			spy_sadd.reset();
			spy_hmset.reset();
			spy_exec.reset();
		});

		it('async error', function(done) {
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.addInfo('', data, function(err) {
				assert.equal(err, 'Async error');
				assert(spy_sadd.calledTwice);
				assert(spy_hmset.calledOnce);
				assert.equal(spy_exec.callCount, 0);
				assert
				done();
			});
		});

		it('syntax error in transaction', function(done) {
			async_stub.forEachOf = function(list, handler, callback) {
				return handler(list[Object.keys(list)[0]], 0, function(param) {
					return callback(param);
				});
			}
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.addInfo('', data, function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_sadd.callCount, 3);
				assert.equal(spy_hmset.callCount, 2);
				assert.equal(spy_exec.callCount, 1);
				done();
			});
		});

		it('correct, 1 element for accounting', function(done) {
			multi.exec = function(callback) {
				return callback(null);
			}
			async_stub.forEachOf = function(list, handler, callback) {
				return handler(list[Object.keys(list)[0]], 0, function(param) {
					return callback(param);
				});
			}
			spy_exec = sinon.spy(multi, 'exec');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub 
			});
			db.addInfo('', data, function(err) {
				assert.equal(err, null);
				assert.equal(spy_sadd.callCount, 3);
				assert.equal(spy_hmset.callCount, 2);
				assert.equal(spy_exec.callCount, 1);
				done();
			});
		});
	});

	describe('getApiKey', function() {
		var spy_smembers, spy_hgetall;
		var mock_db;
		var offer = {
			organization: 'org',
			name: 'name',
			version: 'version'
		}

		before(function() {
			async_stub = {
				each: function(list, handler, callback) {
					return handler(list[0], function(param) {
						return callback(param);
					});
				}
			}
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				smembers: function(key, callback) {
					return callback('Error', null);
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_smembers = sinon.spy(mock_db, 'smembers');
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_smembers.reset();
			spy_hgetall.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub});
			db.getApiKey('', '', function(err, api_key) {
				assert.equal(err, 'Error');
				assert.equal(api_key, null);
				assert(spy_smembers.calledOnce);
				assert.equal(spy_hgetall.callCount, 0);
				done();
			});
		});

		it('error, second query failed', function(done) {
			mock_db.smembers = function(key, callback) {
				return callback(null, ['api_key1']);
			}
			spy_smembers = sinon.spy(mock_db, 'smembers');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub });
			db.getApiKey('', '', function(err, api_key) {
				assert.equal(err, 'Error');
				assert.equal(api_key, null);
				assert(spy_smembers.calledOnce);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('correct, no api_keys available', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback(null, {
					organization: '',
					name: '',
					version: ''
				});
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub });
			db.getApiKey('', offer, function(err, api_key) {
				assert.equal(err, null);
				assert.equal(api_key, null);
				assert(spy_smembers.calledOnce);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});

		it('correct, api_keys available', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback(null, offer);
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {
				'redis': redis_stub,
				'async': async_stub });
			db.getApiKey('', offer, function(err, api_key) {
				assert.equal(err, null);
				assert.equal(api_key, 'api_key1');
				assert(spy_smembers.calledOnce);
				assert(spy_hgetall.calledOnce);
				done();
			});
		});
	});

	describe('count', function() {
		var spy_exists, spy_hget, spy_hmset;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				exists: function(key, callback) {
					return callback('Error', null);
				},
				hget: function(key, param, callback) {
					return callback('Error', null);
				},
				hmset: function(key, obj, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_exists = sinon.spy(mock_db, 'exists');
			spy_hget = sinon.spy(mock_db, 'hget');
			spy_hmset = sinon.spy(mock_db, 'hmset');
		});

		beforeEach(function() {
			spy_exists.reset();
			spy_hget.reset();
			spy_hmset.reset();
		});

		it('error, amount lower than 0', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', -1, function(err) {
				assert.equal(err, '[ERROR] The aomunt must be greater than 0');
				assert.equal(spy_exists.callCount, 0);
				assert.equal(spy_hget.callCount, 0);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', 1.22, function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_exists.callCount, 1);
				assert.equal(spy_hget.callCount, 0);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('error, non resource available', function(done) {
			mock_db.exists = function(key, callback) {
				return callback(null, 0);
			}
			spy_exists = sinon.spy(mock_db, 'exists');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', 1.22, function(err) {
				assert.equal(err, '[ERROR] The specified resource doesn\'t exist');
				assert.equal(spy_exists.callCount, 1);
				assert.equal(spy_hget.callCount, 0);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('error, second query failed', function(done) {
			mock_db.exists = function(key, callback) {
				return callback(null, 1);
			}
			spy_exists = sinon.spy(mock_db, 'exists');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', 1.22, function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_exists.callCount, 1);
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('error, add information failed', function(done) {
			mock_db.exists = function(key, callback) {
				return callback(null, 1);
			}
			mock_db.hget = function(key, param, callback) {
				return callback(null, '');
			}
			spy_exists = sinon.spy(mock_db, 'exists');
			spy_hget = sinon.spy(mock_db, 'hget');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', 1.22, function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_exists.callCount, 1);
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.exists = function(key, callback) {
				return callback(null, 1);
			}
			mock_db.hget = function(key, param, callback) {
				return callback(null, 1);
			}
			mock_db.hmset = function(key, obj, callback) {
				return callback(null);
			}
			spy_exists = sinon.spy(mock_db, 'exists');
			spy_hget = sinon.spy(mock_db, 'hget');
			spy_hmset = sinon.spy(mock_db, 'hmset');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.count('', '', '', 1.22, function(err) {
				assert.equal(err, null);
				assert.equal(spy_exists.callCount, 1);
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});
	});

	describe('resetCount', function(done) {
		var spy_hget, spy_hmset;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hget: function(key, param, callback) {
					return callback('Error', null);
				},
				hmset: function(key, obj, callback) {
					return callback('Error', null);
				}
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hget = sinon.spy(mock_db, 'hget');
			spy_hmset = sinon.spy(mock_db, 'hmset');
		});

		beforeEach(function() {
			spy_hget.reset();
			spy_hmset.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.resetCount('', '', '', function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('correct, no correlation number', function(done) {
			mock_db.hget = function(key, param, callback) {
				return callback(null, null);
			}
			spy_hget = sinon.spy(mock_db, 'hget');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.resetCount('', '', '', function(err) {
				assert.equal(err, null);
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 0);
				done();
			});
		});

		it('error, add information failed', function(done) {
			mock_db.hget = function(key, param, callback) {
				return callback(null, 0001);
			}
			spy_hget = sinon.spy(mock_db, 'hget');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.resetCount('', '', '', function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});

		it('correct, correlation number', function(done) {
			mock_db.hmset = function(key, param, callback) {
				return callback(null);
			}
			spy_hmset = sinon.spy(mock_db, 'hmset');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.resetCount('', '', '', function(err) {
				assert.equal(err, null);
				assert.equal(spy_hget.callCount, 1);
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});
	});

	describe('getAccountingInfo', function() {
		var spy_hgetall;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				},
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_hgetall.reset();
		});

		it('error, first query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.getAccountingInfo('', '', function(err, acc_info) {
				assert.equal(err, 'Error');
				assert.equal(acc_info, null);
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});

		it('correct, no accounting info available', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback(null, null);
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.getAccountingInfo('', '', function(err, acc_info) {
				assert.equal(err, null);
				assert.equal(acc_info, null);
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});

		it('correct, accounting info available', function(done) {
			var resource = {
					recordType: '',
					unit: '',
					component: ''
				}
			mock_db.hgetall = function(key, callback) {
				return callback(null, resource);
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.getAccountingInfo('', '', function(err, acc_info) {
				assert.equal(err, null);
				assert.deepEqual(acc_info, resource);
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});
	});

	describe('addCBSubscription', function() {
		var spy_hmset;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hmset: function(key, params, callback) {
					return callback('Error', null);
				},
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hmset = sinon.spy(mock_db, 'hmset');
		});

		beforeEach(function() {
			spy_hmset.reset();
		});

		it('error, add information failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.addCBSubscription('', '', '', '', '', '', '', function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.hmset = function(key, params, callback) {
				return callback(null);
			}
			spy_hmset = sinon.spy(mock_db, 'hmset');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.addCBSubscription('', '', '', '', '', '', '', function(err) {
				assert.equal(err, null);
				assert.equal(spy_hmset.callCount, 1);
				done();
			});
		});
	});

	describe('getDBSubscription', function(done) {
		var spy_hgetall;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				},
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
		});

		beforeEach(function() {
			spy_hgetall.reset();
		});

		it('error, query failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.getCBSubscription('', function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.hgetall = function(key, callback) {
				return callback(null, 'res');
			}
			spy_hgetall = sinon.spy(mock_db, 'hgetall');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.getCBSubscription('', function(err, subscriptionID) {
				assert.equal(err, null);
				assert.equal(subscriptionID, 'res');
				assert.equal(spy_hgetall.callCount, 1);
				done();
			});
		});
	});

	describe('deleteCBSubscription', function() {
		var spy_del;
		var mock_db;

		before(function() {
			mock_db = {
				on: function(event, callback){
					return callback();
				},
				del: function(key, callback) {
					return callback('Error', null);
				},
			}
			redis_stub = {
				createClient: function() {
					return mock_db;
				}
			};
			spy_del = sinon.spy(mock_db, 'del');
		});

		beforeEach(function() {
			spy_del.reset();
		});

		it('error, delete subscription failed', function(done) {
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.deleteCBSubscription('', function(err) {
				assert.equal(err, 'Error');
				assert.equal(spy_del.callCount, 1);
				done();
			});
		});

		it('correct', function(done) {
			mock_db.del = function(key, callback) {
				return callback(null);
			}
			spy_del = sinon.spy(mock_db, 'del');
			var db = proxyquire('../../db_Redis', {'redis': redis_stub });
			db.deleteCBSubscription('', function(err) {
				assert.equal(err, null);
				assert.equal(spy_del.callCount, 1);
				done();
			});
		});
	});
});