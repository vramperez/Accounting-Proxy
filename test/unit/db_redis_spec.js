var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var redis_mocker = function(implementations, callback) {
	var mock_db, redis_stub, multi, async_stub;
	var db;
	var toSpy, spies = {};
	// Create mocks
	if (implementations.exec != undefined) {
		multi = {
			exists: implementations.exists,
			sadd: implementations.sadd,
			srem: implementations.srem,
			smembers: implementations.smembers,
			hmset: implementations.hmset,
			hget: implementations.hget,
			hgetall: implementations.hgetall,
			del: implementations.del,
			exec: implementations.exec
		}
		mock_db = {
			on: function(event, callback){
				return callback();
			},
			multi: function(){
				return multi;
			}
		}
		redis_stub = {
			createClient: function() {
				return mock_db;
			}
		};
		toSpy = multi;
	} else {
		mock_db = {
			on: function(event, callback){
				return callback();
			},
			exists: implementations.exists,
			sadd: implementations.sadd,
			srem: implementations.srem,
			smembers: implementations.smembers,
			hmset: implementations.hmset,
			hget: implementations.hget,
			hgetall: implementations.hgetall,
			del: implementations.del
		}
		redis_stub = {
			createClient: function() {
				return mock_db;
			}
		};
		toSpy = mock_db;
	}
	async_stub = {
		each: function(list, handler, callback) {
			for (var i = 0; i < list.length; i++) {
				handler(list[i], function(param) {
					if (i == list.length - 1) {
						return callback(param);
					}
				});
			}
			if (list.length == 0) {
				return callback();
			}
		},
		forEachOf: function(list, handler, callback) {
			for(var  i=0; i<Object.keys(list).length; i++) {
				handler(list[Object.keys(list)[i]], Object.keys(list)[i], function(param) {
					if (i == Object.keys(list).length - 1 ) {
						return callback(param);
					}
				});
			}
		},
		filter: function(list, handler, callback) {
			var results = [];

			for (var i = 0; i < list.length; i++) {
				handler(list[i], function(condition) {
					if (condition) {
						results.push(list[i]);
					}
					if (i == list.length - 1) {
						return callback(results);
					}
				});
			}
			if (list.length == 0) {
				return callback(results);
			}
		}
	}
	// Create necessary spies
	if (implementations.exists != undefined) {
		spies.exists = sinon.spy(toSpy, 'exists');
	}
	if (implementations.sadd != undefined) {
		spies.sadd = sinon.spy(toSpy, 'sadd');
	}
	if (implementations.srem != undefined) {
		spies.srem = sinon.spy(toSpy, 'srem');
	}
	if (implementations.smembers != undefined) {
		spies.smembers = sinon.spy(toSpy, 'smembers');
	}
	if (implementations.hmset != undefined) {
		spies.hmset = sinon.spy(toSpy, 'hmset');
	}
	if (implementations.hget != undefined) {
		spies.hget = sinon.spy(toSpy, 'hget');
	}
	if (implementations.hgetall != undefined) {
		spies.hgetall = sinon.spy(toSpy, 'hgetall');
	}
	if (implementations.del != undefined) {
		spies.del = sinon.spy(toSpy, 'del');
	}
	if (implementations.exec != undefined) {
		spies.exec = sinon.spy(toSpy, 'exec');
	}
	spies.each = sinon.spy(async_stub, 'each');
	spies.forEachOf = sinon.spy(async_stub, 'forEachOf');
	spies.filter = sinon.spy(async_stub, 'filter');
	db = proxyquire('../../db_Redis', {
		'redis': redis_stub,
		'async': async_stub});
	return callback(db, spies);
}

describe('Testing Redis database,', function() {

	describe('init', function() {
		var db;

		it('init', function() {
			redis_mocker({}, function(db, spies) {
				db.init();
			});
		});
	});

	describe('checkInfo', function() {
		var db, implementations;

		it('error, first query failed', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.hgetall.callCount, 0);
					assert.equal(spies.each.callCount, 0);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					done();
				});
			});
		});

		it('error, second query failed', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					done();
				});
			});
		});

		it('error, first query of auxiliar method failed', function(done) {
			implementations.smembers = function(key, callback) {
				if (key === 'resources') {
					return callback('Error', null);
				} else {
					return callback(null, ['api_key']);
				}
			}
			implementations.hgetall = function(key, callback) {
				return callback(null, ['resource']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 2);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.equal(spies.smembers.getCall(1).args[0], 'resources');
					done();
				});
			});
		});

		it('error, second query of auxiliar method failed', function(done) {
			implementations.smembers = function(key, callback) {
				if (key === 'resources') {
					return callback(null, ['resource']);
				} else {
					return callback(null, ['api_key']);
				}
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'resource') {
					return callback('Error', null);
				} else {
					return callback(null, ['resource']);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 2);
					assert.equal(spies.hgetall.callCount, 2);
					assert.equal(spies.each.callCount, 2);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.equal(spies.smembers.getCall(1).args[0], 'resources');
					assert.deepEqual(spies.each.getCall(1).args[0], ['resource']);
					assert.equal(spies.hgetall.getCall(1).args[0], 'resource');
					done();
				});
			});
		});

		it('error, third query of auxiliar method failed', function(done) {
			implementations.smembers = function(key, callback) {
				if (key === 'resources') {
					return callback(null, ['resource']);
				} else {
					return callback(null, ['api_key']);
				}
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'resource') {
					return callback(null, {publicPath: 'Error'});
				} else if (key === 'Error') {
					return callback('Error', null);
				} else {
					return callback(null, ['resource']);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 2);
					assert.equal(spies.hgetall.callCount, 3);
					assert.equal(spies.each.callCount, 2);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.equal(spies.smembers.getCall(1).args[0], 'resources');
					assert.deepEqual(spies.each.getCall(1).args[0], ['resource']);
					assert.equal(spies.hgetall.getCall(1).args[0], 'resource');
					assert.equal(spies.hgetall.getCall(2).args[0], 'Error');
					done();
				});
			});
		});

		it('correct, no unit available', function(done) {
			implementations.smembers = function(key, callback) {
				if (key === 'resources') {
					return callback(null, ['resource']);
				} else {
					return callback(null, ['api_key']);
				}
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'resource') {
					return callback(null, {publicPath: 'publicPath'});
				} else if (key === 'publicPath') {
					return callback(null, null);
				} else {
					return callback(null, ['resource']);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, null);
					assert.equal(spies.smembers.callCount, 2);
					assert.equal(spies.hgetall.callCount, 3);
					assert.equal(spies.each.callCount, 2);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.equal(spies.smembers.getCall(1).args[0], 'resources');
					assert.deepEqual(spies.each.getCall(1).args[0], ['resource']);
					assert.equal(spies.hgetall.getCall(1).args[0], 'resource');
					assert.equal(spies.hgetall.getCall(2).args[0], 'publicPath');
					done();
				});
			});
		});

		it('correct, unit available', function(done) {
			implementations.smembers = function(key, callback) {
				if (key === 'resources') {
					return callback(null, ['resource', 'another_resource']);
				} else {
					return callback(null, ['api_key', 'another_api_key']);
				}
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'resource') {
					return callback(null, {
						publicPath: '/path',
						org: 'org',
						name: 'name',
						version: 'version',
						unit: 'megabyte'
					});
				} else if (key === '/path') {
					return callback(null, null);
				} else if (key == 'another_resource'){
					return callback(null, {
						publicPath: '/path',
						org: 'wrong',
						name: 'wrong',
						version: 'wrong',
						unit: 'wrong'
					});
				} else {
					return callback(null, {
						organization: 'org',
						name: 'name',
						version: 'version',
					});
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, 'megabyte');
					assert.equal(spies.smembers.callCount, 2);
					assert.equal(spies.hgetall.callCount, 5);
					assert.equal(spies.each.callCount, 2);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key', 'another_api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.equal(spies.smembers.getCall(1).args[0], 'resources');
					assert.deepEqual(spies.each.getCall(1).args[0], ['resource', 'another_resource']);
					assert.equal(spies.hgetall.getCall(1).args[0], 'resource');
					assert.equal(spies.hgetall.getCall(2).args[0], '/path');
					done();
				});
			});
		});
	});

	describe('newService', function() {
		var db, implementations;

		it('syntax error in transaction', function(done) {
			implementations = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function (db, spies) {
				db.newService('/path', 'http://localhost:9010/private', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.sadd.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], ['public', '/path']);
					assert.deepEqual(spies.hmset.getCall(0).args[0], '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {'url': 'http://localhost:9010/private'});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.exec = function (callback) {
				return callback(null);
			}
			redis_mocker(implementations, function (db, spies) {
				db.newService('/path', 'http://localhost:9010/private', function(err) {
					assert.equal(err, null);
					assert.equal(spies.sadd.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], ['public', '/path']);
					assert.deepEqual(spies.hmset.getCall(0).args[0], '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {'url': 'http://localhost:9010/private'});
					done();
				});
			});
		});
	});

	describe('getService', function() {
		var db, implementations;

		it('error', function(done) {
			implementations = {
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function (db, spies) {
				db.getService('/path', function(err, service) {
					assert.equal(err, 'Error');
					assert.equal(service, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0], '/path')
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.hgetall = function(key, callback) {
				return callback(null, {service: 'service'});
			}
			redis_mocker(implementations, function (db, spies) {
				db.getService('/path', function(err, service) {
					assert.equal(err, null);
					assert.deepEqual(service, {service: 'service'});
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0], '/path');
					done();
				});
			});
		});
	});

	describe('deleteService', function() {
		var db, implementations;

		it('syntax error in transaction', function(done) {
			implementations = {
				del: function(){},
				srem: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.deleteService('/path', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.del.callCount, 1);
					assert.equal(spies.srem.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.equal(spies.del.getCall(0).args[0], '/path');
					assert.equal(spies.srem.getCall(0).args[0], 'public');
					assert.equal(spies.srem.getCall(0).args[1], '/path');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.exec = function(callback) {
				return callback(null, null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.deleteService('/path', function(err) {
					assert.equal(err, null);
					assert.equal(spies.del.callCount, 1);
					assert.equal(spies.srem.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.equal(spies.del.getCall(0).args[0], '/path');
					assert.equal(spies.srem.getCall(0).args[0], 'public');
					assert.equal(spies.srem.getCall(0).args[1], '/path');
					done();
				});
			});
		});
	});

	describe('getInfo', function() {
		var db, implementations;	

		it('error, first query failed', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				},
				hgetall: function(key, callback) {
					return callback('Error', null);	
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getInfo('0001', function(err, info) {
					assert.equal(err, 'Error');
					assert.equal(info, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 0);
					assert.equal(spies.hgetall.callCount, 0);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					done();
				});
			});
		});

		it('error, second query failed', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getInfo('0001', function(err, info) {
					assert.equal(err, 'Error');
					assert.equal(info, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.equal(spies.hgetall.getCall(0).args[0], 'api_key');
					done();
				});
			});
		});

		it('correct, no info available', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, []);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getInfo('0001', function(err, info) {
					assert.equal(err, null);
					assert.deepEqual(info, {});
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.hgetall.callCount, 0);
					assert.deepEqual(spies.each.getCall(0).args[0], []);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					done();
				});
			});
		});

		it('correct, info available', function(done) {
			var info = {
				organization: 'organization',
				name: 'name',
				version: '1.0'
			}
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key']);
			}
			implementations.hgetall = function(key, callback) {
				return callback(null, info);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getInfo('0001', function(err, information) {
					assert.equal(err, null);
					assert.deepEqual(information, [ { API_KEY: 'api_key',
   						organization: 'organization',
    					name: 'name',
    					version: '1.0' } ]);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.each.getCall(0).args[0], ['api_key']);
					assert.equal(spies.hgetall.getCall(0).args[0], 'api_key');
					done();
				});
			});
		});
	});

	describe('addResource', function() {
		var db, implementations;
		var data =
		{
			publicPath: '/path',
			offering: 
			{
				organization: 'organization',
				name: 'name',
				version: '1.0'
			},
			record_type: '',
			unit: 'megabyte',
			component_label: 'label'
		};

		it('syntax error in transaction', function(done) {
			implementations = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.addResource(data, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.sadd.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], 
						['resources', data.publicPath + data.offering.organization + data.offering.name + data.offering.version]);
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						data.publicPath + data.offering.organization + data.offering.name + data.offering.version); 
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'publicPath': data.publicPath,
						'org': data.offering.organization,
						'name': data.offering.name,
						'version': data.offering.version,
						'record_type': data.record_type,
						'unit': data.unit,
						'component_label': data.component_label
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.exec = function(callback) {
				return callback(null, null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.addResource(data, function(err) {
					assert.equal(err, null);
					assert.equal(spies.sadd.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], 
						['resources', data.publicPath + data.offering.organization + data.offering.name + data.offering.version]);
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						data.publicPath + data.offering.organization + data.offering.name + data.offering.version); 
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'publicPath': data.publicPath,
						'org': data.offering.organization,
						'name': data.offering.name,
						'version': data.offering.version,
						'record_type': data.record_type,
						'unit': data.unit,
						'component_label': data.component_label
					});
					done();
				});
			});
		});
	});

	describe('getUnit', function() {
		var db, implementations;

		it('error', function(done) {
			implementations = {
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'org', 'name', '1.0', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.hgetall.getCall(0).args[0],  '/path' + 'org' + 'name' + '1.0');
					done();
				});
			});
		});

		it('error, service no created', function(done) {
			implementations.hgetall  = function(key, callback){
				return callback(null, undefined);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'org', 'name', '1.0', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.hgetall.getCall(0).args[0],  '/path' + 'org' + 'name' + '1.0');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.hgetall  = function(key, callback){
				return callback(null, {unit: 'megabyte'});
			}
			redis_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'org', 'name', '1.0', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, 'megabyte');
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.hgetall.getCall(0).args[0],  '/path' + 'org' + 'name' + '1.0');
					done();
				});
			});
		});
	});

	describe('getApiKeys', function() {
		var db, implementations;

		it('error', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKeys(function(err, api_keys) {
					assert.equal(err, 'Error');
					assert.equal(api_keys, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'API_KEYS');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key1']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKeys(function(err, api_keys) {
					assert.equal(err, null);
					assert.deepEqual(api_keys, ['api_key1']);
					assert.equal(spies.smembers.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'API_KEYS');
					done();
				});
			});
		});
	});

	describe('getResources', function() {
		var db, implementations;

		it('error', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getResources('api_key', function(err, resource) {
					assert.equal(err, 'Error');
					assert.deepEqual(resource, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'api_key' + '_paths');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.smembers = function(key, callback){
				return callback(null, ['/path1', '/path2']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getResources('api_key', function(err, resource) {
					assert.equal(err, null);
					assert.deepEqual(resource, ['/path1', '/path2']);
					assert.equal(spies.smembers.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'api_key' + '_paths');
					done();
				});
			});
		});
	});

	describe('getNotificationInfo', function() {
		var db, implementations;
		var api_key_info = {
			actorID: '0001',
			organization: 'organization',
			name: 'name',
			version: '1.0',
			reference: 'ref'
		}		

		it('error, first query failed', function(done) {
			implementations = {
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getNotificationInfo('api_key', '', function(err, notificationInfo) {
					assert.equal(err, 'Error');
					assert.deepEqual(notificationInfo, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					done();
				});
			});
		});

		it('error, second query failed', function(done) {
			implementations.hgetall = function(key, callback) {
				if (key != 'api_key') {
					return callback('Error', null);
				} else {
					return callback(null, api_key_info);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getNotificationInfo('api_key', '/path', function(err, notificationInfo) {
					assert.equal(err, 'Error');
					assert.deepEqual(notificationInfo, null);
					assert.equal(spies.hgetall.callCount, 2);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.deepEqual(spies.hgetall.getCall(1).args[0], 
						api_key_info.actorID + 'api_key' + '/path');
					done();
				});
			});
		});

		it('correct', function(done) {
			var resource = {
				correlation_number: '', 
				num: '1.0'
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'api_key') {
					return callback(null, api_key_info);
				} else {
					return callback(null, resource);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getNotificationInfo('api_key', '/path', function(err, notificationInfo) {
					assert.equal(err, null);
					assert.deepEqual(notificationInfo, { 
						actorID: api_key_info.actorID, 
						API_KEY: 'api_key',
						publicPath: '/path',
						organization: api_key_info.organization,
						name: api_key_info.name,
						version: api_key_info.version,
						correlation_number: resource.correlation_number,
						num: resource.num,
						reference: api_key_info.reference
					});
					assert.equal(spies.hgetall.callCount, 2);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key');
					assert.deepEqual(spies.hgetall.getCall(1).args[0], 
						api_key_info.actorID + 'api_key' + '/path');
					done();
				});
			});
		});
	});

	describe('checkBuy', function() {
		var db, implementations;

		it('error, first query failed', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '', function(err, bought) {
					assert.equal(err, 'Error');
					assert.equal(bought, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 0);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'api_key' + '_paths');
					done();
				});
			});
		});

		it('correct, not bought', function(done) {
			implementations.each = function(list, handler, callback) {
				return handler(list[0], function(param) {
					return callback(param);
				});
			}
			implementations.smembers = function(key, callback) {
				return callback(null, ['wrong_path', '/path1']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '', function(err, bought) {
					assert.equal(err, null);
					assert.equal(bought, false);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.deepEqual(spies.each.getCall(0).args[0], ['wrong_path', '/path1']);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'api_key' + '_paths');
					done();
				});
			});
		});

		it('correct, bought', function(done) {
			implementations.each = function(list, handler, callback) {
				return handler(list[0], function(param) {
					return callback(param);
				});
			}
			implementations.smembers = function(key, callback) {
				return callback(null, ['/path1']);
			}
			redis_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '/path1', function(err, bought) {
					assert.equal(err, null);
					assert.equal(bought, true);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.deepEqual(spies.each.getCall(0).args[0], ['/path1']);
					assert.deepEqual(spies.smembers.getCall(0).args[0], 'api_key' + '_paths');
					done();
				});
			});
		});
	});

	describe('addInfo', function() {
		var db, implementations;
		var data = {
			organization: 'organization',
			name: 'name',
			version: '1.0',
			reference: 'ref',
			actorID: '0001',
			accounting: {
				'path1': { 
					num: 1,
					correlation_number: 001
				}
			}
		}

		it('syntax error in transaction', function(done) {
			implementations = {
				sadd: function(){},
				hmset: function(){},
				exec: function(callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.sadd.callCount, 3);
					assert.equal(spies.hmset.callCount, 2);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], ['API_KEYS', 'api_key']);
					assert.deepEqual(spies.sadd.getCall(1).args[0], [data.actorID, 'api_key']);
					assert.deepEqual(spies.sadd.getCall(2).args[0], ['api_key' + '_paths', 'path1']);
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					assert.deepEqual(spies.hmset.getCall(0).args[0], 'api_key');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'organization': data.organization,
						'name': data.name,
						'version': data.version,
						'actorID': data.actorID,
						'reference': data.reference
					});
					assert.deepEqual(spies.hmset.getCall(1).args[1], {
						'actorID': data.actorID,
						'API_KEY': 'api_key',
						'num': data.accounting['path1'].num,
						'publicPath': 'path1',
						'correlation_number': data.accounting['path1'].correlation_number,
					});
					done();
				});
			});
		});

		it('correct, 1 element for accounting', function(done) {
			implementations.exec = function(callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, null);
					assert.equal(spies.sadd.callCount, 3);
					assert.equal(spies.hmset.callCount, 2);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], ['API_KEYS', 'api_key']);
					assert.deepEqual(spies.sadd.getCall(1).args[0], [data.actorID, 'api_key']);
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					assert.deepEqual(spies.hmset.getCall(0).args[0], 'api_key');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'organization': data.organization,
						'name': data.name,
						'version': data.version,
						'actorID': data.actorID,
						'reference': data.reference
					});
					assert.deepEqual(spies.hmset.getCall(1).args[1], {
						'actorID': data.actorID,
						'API_KEY': 'api_key',
						'num': data.accounting['path1'].num,
						'publicPath': 'path1',
						'correlation_number': data.accounting['path1'].correlation_number,
					});
					done();
				});
			});
		});

		it('correct, 2 elements for accounting', function(done) {
			var data2 = {
				organization: 'organization',
				name: 'name',
				version: '1.0',
				reference: 'ref',
				actorID: '0001',
				accounting: {
					'path1': { 
						num: 1,
						correlation_number: 001
					},
					'path2': {
						num: 2,
						correlation_number: 002
					}
				}
			}
			implementations.exec = function(callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data2, function(err) {
					assert.equal(err, null);
					assert.equal(spies.sadd.callCount, 4);
					assert.equal(spies.hmset.callCount, 3);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.exec.callCount, 1);
					assert.deepEqual(spies.sadd.getCall(0).args[0], ['API_KEYS', 'api_key']);
					assert.deepEqual(spies.sadd.getCall(1).args[0], [data.actorID, 'api_key']);
					assert.deepEqual(spies.sadd.getCall(2).args[0], ['api_key' + '_paths', 'path1']);
					assert.deepEqual(spies.sadd.getCall(3).args[0], ['api_key' + '_paths', 'path2']);
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data2.accounting);
					assert.deepEqual(spies.hmset.getCall(0).args[0], 'api_key');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'organization': data.organization,
						'name': data.name,
						'version': data.version,
						'actorID': data.actorID,
						'reference': data.reference
					});
					assert.deepEqual(spies.hmset.getCall(1).args[1], {
						'actorID': data.actorID,
						'API_KEY': 'api_key',
						'num': data.accounting['path1'].num,
						'publicPath': 'path1',
						'correlation_number': data.accounting['path1'].correlation_number,
					});
					done();
				});
			});
		});
	});

	describe('getApiKey', function() {
		var db, implementations;
		var offer = {
			organization: 'org',
			name: 'name',
			version: 'version'
		}

		it('error, first query failed', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback('Error', null);
				},
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, 'Error');
					assert.equal(api_key, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.filter.callCount, 0);
					assert.equal(spies.hgetall.callCount, 0);
					assert.deepEqual(spies.smembers.getCall(0).args[0], '0001');
					done();
				});
			});
		});

		it('no api_keys available for the user', function(done) {
			implementations = {
				smembers: function(key, callback) {
					return callback(null, []);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, null);
					assert.equal(api_key, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.filter.callCount, 0);
					assert.deepEqual(spies.smembers.getCall(0).args[0], '0001');
					done();
				});
			});
		});

		it('error, second query failed', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key1']);
			}
			implementations.hgetall = function(key, callback) {
				return callback('Error', null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, 'Error');
					assert.equal(api_key, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.filter.callCount, 1);
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.filter.getCall(0).args[0], ['api_key1']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key1');
					done();
				});
			});
		});

		it('correct, no api_keys available', function(done) {
			implementations.hgetall = function(key, callback) {
				return callback(null, {
					organization: '',
					name: '',
					version: ''
				});
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, null);
					assert.equal(api_key, null);
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.filter.callCount, 1);
					assert.equal(spies.hgetall.callCount, 1);
					assert.deepEqual(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.filter.getCall(0).args[0], ['api_key1']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key1');
					done();
				});
			});
		});

		it('correct, api_keys available', function(done) {
			implementations.smembers = function(key, callback) {
				return callback(null, ['api_key1', 'another_api_key']);
			}
			implementations.hgetall = function(key, callback) {
				if (key === 'api_key1') {
					return callback(null, offer);	
				} else {
					return callback(null, {
						organization: 'wrong', 
						name: 'wrong',
						version: 'wrong'
					});
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, null);
					assert.equal(api_key, 'api_key1');
					assert.equal(spies.smembers.callCount, 1);
					assert.equal(spies.filter.callCount, 1);
					assert.equal(spies.hgetall.callCount, 2);
					assert.deepEqual(spies.smembers.getCall(0).args[0], '0001');
					assert.deepEqual(spies.filter.getCall(0).args[0], ['api_key1', 'another_api_key']);
					assert.deepEqual(spies.hgetall.getCall(0).args[0], 'api_key1');
					assert.deepEqual(spies.hgetall.getCall(1).args[0], 'another_api_key');
					done();
				});
			});
		});
	});

	describe('count', function() {
		var db, implementations;

		it('error, amount lower than 0', function(done) {
			implementations = {
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
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', -1, function(err) {
					assert.equal(err, '[ERROR] The aomunt must be greater than 0');
					assert.equal(spies.exists.callCount, 0);
					assert.equal(spies.hget.callCount, 0);
					assert.equal(spies.hmset.callCount, 0);
					done();
				});
			});
		});

		it('error, first query failed', function(done) {
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.3, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.exists.callCount, 1);
					assert.equal(spies.hget.callCount, 0);
					assert.equal(spies.hmset.callCount, 0);
					assert.deepEqual(spies.exists.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					done();
				});
			});
		});

		it('error, non resource available', function(done) {
			implementations.exists = function(key, callback) {
				return callback(null, 0);
			}
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.3, function(err) {
					assert.equal(err, '[ERROR] The specified resource doesn\'t exist');
					assert.equal(spies.exists.callCount, 1);
					assert.equal(spies.hget.callCount, 0);
					assert.equal(spies.hmset.callCount, 0);
					assert.deepEqual(spies.exists.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					done();
				});
			});
		});

		it('error, second query failed', function(done) {
			implementations.exists = function(key, callback) {
				return callback(null, 1);
			}
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.3, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.exists.callCount, 1);
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 0);
					assert.deepEqual(spies.exists.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[0],
						'0001' + 'api_key' + '/path' );
					assert.deepEqual(spies.hget.getCall(0).args[1], 'num');
					done();
				});
			});
		});

		it('error, add information failed', function(done) {
			implementations.exists = function(key, callback) {
				return callback(null, 1);
			}
			implementations.hget = function(key, param, callback) {
				return callback(null, 1);
			}
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.3, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.exists.callCount, 1);
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.exists.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[0],
						'0001' + 'api_key' + '/path' );
					assert.deepEqual(spies.hget.getCall(0).args[1], 'num');
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'num': 2.3 });
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.exists = function(key, callback) {
				return callback(null, 1);
			}
			implementations.hget = function(key, param, callback) {
				return callback(null, 1);
			}
			implementations.hmset = function(key, obj, callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.3, function(err) {
					assert.equal(err, null);
					assert.equal(spies.exists.callCount, 1);
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.exists.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[0],
						'0001' + 'api_key' + '/path' );
					assert.deepEqual(spies.hget.getCall(0).args[1], 'num');
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'num': 2.3 });
					done();
				});
			});
		});
	});

	describe('resetCount', function(done) {
		var db, implementations;

		it('error, first query failed', function(done) {
			implementations = {
				hget: function(key, param, callback) {
					return callback('Error', null);
				},
				hmset: function(key, obj, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 0);
					assert.deepEqual(spies.hget.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[1], 'correlation_number'); 
					done();
				});
			});
		});

		it('correct, no correlation number', function(done) {
			implementations.hget = function(key, param, callback) {
				return callback(null, null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, null);
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 0);
					assert.deepEqual(spies.hget.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[1], 'correlation_number'); 
					done();
				});
			});
		});

		it('error, add information failed', function(done) {
			implementations.hget = function(key, param, callback) {
				return callback(null, 0001);
			}
			redis_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.hget.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[1], 'correlation_number'); 
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'correlation_number': 2,
						'num': 0 }); 
					done();
				});
			});
		});

		it('correct, correlation number', function(done) {
			implementations.hmset = function(key, param, callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, null);
					assert.equal(spies.hget.callCount, 1);
					assert.equal(spies.hmset.callCount, 1);
					assert.deepEqual(spies.hget.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hget.getCall(0).args[1], 'correlation_number'); 
					assert.deepEqual(spies.hmset.getCall(0).args[0], 
						'0001' + 'api_key' + '/path');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'correlation_number': 2,
						'num': 0 }); 
					done();
				});
			});
		});
	});

	describe('getAccountingInfo', function() {
		var db, implementations;
		var offer = {
			organization: 'organization',
			name: 'name',
			version: 1.0
		}

		it('error, first query failed', function(done) {
			implementations = {
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, acc_info) {
					assert.equal(err, 'Error');
					assert.equal(acc_info, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0],
						'/path' + offer.organization + offer.name + offer.version);
					done();
				});
			});
		});

		it('correct, no accounting info available', function(done) {
			implementations.hgetall = function(key, callback) {
				return callback(null, null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, acc_info) {
					assert.equal(err, null);
					assert.equal(acc_info, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0],
						'/path' + offer.organization + offer.name + offer.version);
					done();
				});
			});
		});

		it('correct, accounting info available', function(done) {
			var resource = {
				recordType: 'recordType',
				unit: 'megabyte',
				component: 'component'
			}
			implementations.hgetall = function(key, callback) {
				return callback(null, resource);
			}
			redis_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, acc_info) {
					assert.equal(err, null);
					assert.deepEqual(acc_info, resource);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0],
						'/path' + offer.organization + offer.name + offer.version);
					done();
				});
			});
		});
	});

	describe('addCBSubscription', function() {
		var db, implementations;

		it('error, add information failed', function(done) {
			implementations = {
				hmset: function(key, params, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.addCBSubscription('api_key', '/path', 'subs_id', 'localhost', 9010, '/path', 'megabyte', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.hmset.getCall(0).args[0], 'subs_id');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'API_KEY': 'api_key',
						'publicPath': '/path',
						'ref_host': 'localhost',
						'ref_port': 9010,
						'ref_path': '/path',
						'unit': 'megabyte'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.hmset = function(key, params, callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.addCBSubscription('api_key', '/path', 'subs_id', 'localhost', 9010, '/path', 'megabyte', function(err) {
					assert.equal(err, null);
					assert.equal(spies.hmset.callCount, 1);
					assert.equal(spies.hmset.getCall(0).args[0], 'subs_id');
					assert.deepEqual(spies.hmset.getCall(0).args[1], {
						'API_KEY': 'api_key',
						'publicPath': '/path',
						'ref_host': 'localhost',
						'ref_port': 9010,
						'ref_path': '/path',
						'unit': 'megabyte'
					});
					done();
				});
			});
		});
	});

	describe('getDBSubscription', function(done) {
		var db, implementations;

		it('error, query failed', function(done) {
			implementations = {
				hgetall: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.getCBSubscription('subs_id', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0], 'subs_id');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.hgetall = function(key, callback) {
				return callback(null, 'res');
			}
			redis_mocker(implementations, function(db, spies) {
				db.getCBSubscription('subs_id', function(err) {
					assert.equal(err, null);
					assert.equal(spies.hgetall.callCount, 1);
					assert.equal(spies.hgetall.getCall(0).args[0], 'subs_id');
					done();
				});
			});
		});
	});

	describe('deleteCBSubscription', function() {
		var db, implementations;

		it('error, delete subscription failed', function(done) {
			implementations = {
				del: function(key, callback) {
					return callback('Error', null);
				}
			}
			redis_mocker(implementations, function(db, spies) {
				db.deleteCBSubscription('subs_id', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.del.callCount, 1);
					assert.equal(spies.del.getCall(0).args[0], 'subs_id');
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations.del = function(key, callback) {
				return callback(null);
			}
			redis_mocker(implementations, function(db, spies) {
				db.deleteCBSubscription('subs_id', function(err) {
					assert.equal(err, null);
					assert.equal(spies.del.callCount, 1);
					assert.equal(spies.del.getCall(0).args[0], 'subs_id');
					done();
				});
			});
		});
	});
});