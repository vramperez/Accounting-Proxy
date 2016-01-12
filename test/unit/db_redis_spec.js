var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon');

describe('Testing REDIS database,', function() {

	describe('newService', function(done) {
		var spy_sadd, spy_hmset, spy_exec;
		var db, multi;

		before(function() {
			db = {
				on: function(){},
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
				on: function(){},
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
				on: function(){},
				multi: function(){
					return multi;
				}
			}
			multi = {
				del: function(){},
				srem: function(){},
				on: function(){},
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

	describe('getResource', function() {
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
				on: function(){},
				multi: function(){
					return multi;
				}
			}
			multi = {
				sadd: function(){},
				hmset: function(){},
				on: function(){},
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
				on: function(){},
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
				on: function(){},
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
				on: function(){},
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
				on: function(){},
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
				on: function(){},
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
				on: function(){},
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
				done();
			});
		});

		it('syntax error in transaction');
		it('correct, 1 element for accounting');
		it('correct, 2 elements for accounting');
	});
});