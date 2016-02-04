var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	async = require('async');

var sqlite_mocker = function(implementations, callback) {
	var spies = {};
	// Create mocks
	var mock = {
		serialize: function(callback) {
			return callback();
		},
		run: implementations.run,
		all: implementations.all,
	}
	var sqlite_stub = {
		verbose: function() {
			return this;
		},
		Database: function(name) {
			return mock;
		}
	};
	var async_stub = {
		each: function(list, handler, callback) {
			for (var i = 0; i < list.length; i++) {
				handler(list[i], function(param) {
					if (i == list.length - 1) {
						return callback(param);
					}
				});
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
		}	
	}
	// Create necessary spies
	if (implementations.run != undefined) {
		spies.run = sinon.spy(mock, 'run');
	} if (implementations.all != undefined) {
		spies.all = sinon.spy(mock, 'all');
	}
	spies.each = sinon.spy(async_stub, 'each');
	spies.forEachOf = sinon.spy(async_stub, 'forEachOf');
	// Mock the dependencies
	var db = proxyquire('../../db', {
		'sqlite3': sqlite_stub,
		'async': async_stub });
	return callback(db, spies);
}

describe('Testing Sqlite database,', function() {

	describe('init', function() {
		var implementations;

		var sentences = [ 
			[ 'PRAGMA encoding = "UTF-8";' ],
  			[ 'PRAGMA foreign_keys = 1;' ],
  			[ 'CREATE TABLE IF NOT EXISTS public (                     publicPath      TEXT,                     url             TEXT,                     port            TEXT,                     PRIMARY KEY (publicPath)                )' ],
  			[ 'CREATE TABLE IF NOT EXISTS offerResource (                     publicPath      TEXT,                     organization    TEXT,                     name            TEXT,                     version         TEXT,                     record_type     TEXT,                     unit            TEXT,                     component_label TEXT,                     PRIMARY KEY (publicPath, organization, name, version)               )' ],
  			[ 'CREATE TABLE IF NOT EXISTS offerAccount (                     organization    TEXT,                     name            TEXT,                     version         TEXT,                     actorID         TEXT,                     API_KEY         TEXT,                     reference       TEXT,                     PRIMARY KEY (API_KEY),                     FOREIGN KEY (actorID) REFERENCES accounts (actorID)                )' ],
  			[ 'CREATE TABLE IF NOT EXISTS accounting (                     actorID             TEXT,                     API_KEY             TEXT,                     num                 INT,                      publicPath          TEXT,                     correlation_number  INT,                      PRIMARY KEY (actorID, API_KEY, publicPath),                     FOREIGN KEY (actorID) REFERENCES accounts(actorID),                     FOREIGN KEY (API_KEY) REFERENCES offerAccount(API_KEY)                )' ],
  			[ 'CREATE TABLE IF NOT EXISTS subscriptions (                     subscriptionID      TEXT,                     API_KEY             TEXT,                     publicPath          TEXT,                     ref_host            TEXT,                     ref_port            TEXT,                     ref_path            TEXT,                     unit                TEXT,                     PRIMARY KEY (subscriptionID)                 )' ]
  		]

		it('correct', function(done) {
			implementations = {
				run: function(create) { }
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.init();
				assert.equal(spies.run.callCount, 7);
				var i = 0;
				async.each(spies.args, function(call, task_callback) {
					assert.equal(call[0], sentences[i][0]);
					i++;
					task_callback();
				}, function() {
					done();
				});
			});
		});
	});

	describe('newService', function() {
		var sentence = 'INSERT OR REPLACE INTO public \
            VALUES ($path, $url, $port)';
        var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.newService('/path', 'http://localhost/', '9010',function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual((spies.run.getCall(0)).args[1], {
						$path: '/path',
            			$url: 'http://localhost/',
            			$port: '9010'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.newService('/path', 'http://localhost/', '9010',function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual((spies.run.getCall(0)).args[1], {
						$path: '/path',
            			$url: 'http://localhost/',
            			$port: '9010'
					});
					done();
				});
			});
		});
	});

	describe('deleteService', function() {
		var sentence = 'DELETE FROM public \
            WHERE publicPath=$path';
        var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.deleteService('/path', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual((spies.run.getCall(0)).args[1], {
						$path: '/path',
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.deleteService('/path', function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual((spies.run.getCall(0)).args[1], {
						$path: '/path',
					});
					done();
				});
			});
		});
	});

	describe('getService', function() {
		var sentence = 'SELECT url, port \
            FROM public \
            WHERE publicPath=$path';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getService('/path',function(err, service) {
					assert.equal(err, 'Error');
					assert.equal(service, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual((spies.all.getCall(0)).args[1], {
						$path: '/path',
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, [{port: '9010', url: 'http://localhost'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getService('/path',function(err, service) {
					assert.equal(err, null);
					assert.deepEqual(service, {port: '9010', url: 'http://localhost'});
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual((spies.all.getCall(0)).args[1], {
						$path: '/path',
					});
					done();
				});
			});
		});
	});

	describe('getInfo', function() {
		var sentence = 'SELECT organization, name, version, API_KEY \
            FROM offerAccount \
            WHERE actorID=$user';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getInfo('user',function(err, info) {
					assert.equal(err, 'Error');
					assert.equal(info, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual((spies.all.getCall(0)).args[1], {
						$user: 'user',
					});
					done();
				});
			});
		});

		it('no results', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getInfo('user',function(err, info) {
					assert.equal(err, null);
					assert.deepEqual(info, {});
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual((spies.all.getCall(0)).args[1], {
						$user: 'user',
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, {info: 'info'});
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getInfo('user',function(err, info) {
					assert.equal(err, null);
					assert.deepEqual(info, {info: 'info'});
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual((spies.all.getCall(0)).args[1], {
						$user: 'user',
					});
					done();
				});
			});
		});
	});
	
	describe('addResource', function() {
		var sentence = 'INSERT OR REPLACE INTO offerResource \
            VALUES ($publicPath, $org, $name, $version, $record_type, $unit, $component_label)';
        var data = 
			{
				publicPath: '/path',
				offering: 
				{
					organization: 'organization',
					name: 'name',
					version: '1.0'
				},
				record_type: 'record',
				unit: 'megabyte',
				component_label: 'label'
			};
		var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addResource(data, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$publicPath: data.publicPath,
						$org: data.offering.organization,
						$name: data.offering.name,
						$version: data.offering.version,
						$record_type: data.record_type,
						$unit: data.unit,
						$component_label: data.component_label
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addResource(data, function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$publicPath: data.publicPath,
						$org: data.offering.organization,
						$name: data.offering.name,
						$version: data.offering.version,
						$record_type: data.record_type,
						$unit: data.unit,
						$component_label: data.component_label
					});
					done();
				});
			});
		});
	});

	describe('getUnit', function() {
		var sentence = 'SELECT unit \
            FROM offerResource \
            WHERE publicPath=$path AND organization=$org AND name=$name AND version=$version';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'organization', 'name', '1.0', function(err, res) {
					assert.equal(err, 'Error');
					assert.equal(res, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$path: '/path',
                		$org: 'organization',
               			$name: 'name',
                		$version: '1.0'
					});
					done();
				});
			});
		});

		it('no results', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'organization', 'name', '1.0', function(err, res) {
					assert.equal(err, null);
					assert.equal(res, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$path: '/path',
                		$org: 'organization',
               			$name: 'name',
                		$version: '1.0'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, [{unit: 'megabyte'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getUnit('/path', 'organization', 'name', '1.0', function(err, res) {
					assert.equal(err, null);
					assert.equal(res, 'megabyte');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$path: '/path',
                		$org: 'organization',
               			$name: 'name',
                		$version: '1.0'
					});
					done();
				});
			});
		});
	});

	describe('getApiKeys', function() {
		var sentence = 'SELECT API_KEY \
            FROM offerAccount';
        var implementations;

		it('query error', function(done) {
			implementations = {
				all: function(query, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKeys(function(err, api_keys) {
					assert.equal(err, 'Error');
					assert.equal(api_keys, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.each.callCount, 0);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					done();
				});
			});
		});

		it('no api_keys available', function(done) {
			implementations = {
				all: function(query, callback) {
					return callback(null, undefined);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKeys(function(err, api_keys) {
					assert.equal(err, null);
					assert.deepEqual(api_keys, []);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.each.callCount, 0);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations= {
				all: function(query, callback) {
					return callback(null, [{API_KEY: 'api_key'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKeys(function(err, api_keys) {
					assert.equal(err, null);
					assert.deepEqual(api_keys, ['api_key']);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.each.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.each.getCall(0).args[0], 
						[{API_KEY: 'api_key'}]);
					done();
				});
			});
		});
	});

	describe('getResources', function() {
		var sentence = 'SELECT publicPath \
            FROM accounting \
            WHERE API_KEY=$api_key';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getResources('api_key', function(err, res) {
					assert.equal(err, 'Error');
					assert.equal(res, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, ['resource']);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getResources('api_key', function(err, res) {
					assert.equal(err, null);
					assert.equal(res, 'resource');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});
	});

	describe('getNotificationInfo', function() {
		var sentence = 'SELECT acc.API_KEY, acc.actorID as acotrID, acc.num as num, \
                acc.publicPath as publicPath, acc.correlation_number as correlation_number, \
                offer.organization as organization, offer.name as name, offer.version as version \
            FROM accounting as acc , offerAccount as offer \
            WHERE acc.API_KEY=offer.API_KEY AND acc.API_KEY=$api_key AND offer.API_KEY=$api_key';
       var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getNotificationInfo('api_key', '', function(err, info) {
					assert.equal(err, 'Error');
					assert.equal(info, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, ['info']);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getNotificationInfo('api_key', '', function(err, info) {
					assert.equal(err, null);
					assert.equal(info, 'info');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});
	});

	describe('checkBuy', function() {
		var sentence = 'SELECT publicPath \
            FROM accounting \
            WHERE API_KEY=$api_key';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '', function(err, buy) {
					assert.equal(err, 'Error');
					assert.equal(buy, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});

		it('correct, bought', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, ['not_empty']);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '', function(err, buy) {
					assert.equal(err, null);
					assert.equal(buy, true);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});

		it('correct, not bought', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, []);
				}	
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkBuy('api_key', '', function(err, buy) {
					assert.equal(err, null);
					assert.equal(buy, false);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key'
					});
					done();
				});
			});
		});
	});

	describe('count', function() {
		var sentence = 'UPDATE accounting \
        SET num=num+$amount \
        WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath';
        var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.2, function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$actorID: '0001',
            			$API_KEY: 'api_key',
            			$publicPath: '/path',
            			$amount: 1.2
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.count('0001', 'api_key', '/path', 1.2, function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$actorID: '0001',
            			$API_KEY: 'api_key',
            			$publicPath: '/path',
            			$amount: 1.2
					});
					done();
				});
			});
		});
	});

	describe('resetCount', function() {
		var sentence = 'UPDATE accounting \
        SET num=0, correlation_number=correlation_number+1 \
        WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath';
        var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$actorID: '0001',
            			$API_KEY: 'api_key',
            			$publicPath: '/path'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback){
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.resetCount('0001', 'api_key', '/path', function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$actorID: '0001',
            			$API_KEY: 'api_key',
            			$publicPath: '/path'
					});
					done();
				});
			});
		});
	});

	describe('getApiKey', function() {
		var sentence = 'SELECT API_KEY \
        FROM offerAccount \
        WHERE organization=$org AND name=$name AND version=$version AND actorID=$actorID';
        var offer = {
        	organization: 'organization',
        	name: 'name',
        	version: '1.0',
        	actorID: '0001'
        }
        var implementations;

		it('Error', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, 'Error');
					assert.equal(api_key, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$org: offer.organization,
            			$name: offer.name,
            			$version: offer.version,
            			$actorID: '0001'
					});
					done();
				});
			});
		});

		it('no api_key available', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, null);
					assert.equal(api_key, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$org: offer.organization,
            			$name: offer.name,
            			$version: offer.version,
            			$actorID: '0001'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, [{API_KEY: 'api_key'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getApiKey('0001', offer, function(err, api_key) {
					assert.equal(err, null);
					assert.equal(api_key, 'api_key');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$org: offer.organization,
            			$name: offer.name,
            			$version: offer.version,
            			$actorID: '0001'
					});
					done();
				});
			});
		});
	});

	describe('getAccountingINfo', function() {
		var sentence = 'SELECT record_type, unit, component_label \
        FROM offerResource \
        WHERE publicPath=$publicPath AND organization=$org AND name=$name AND version=$v';
        var offer = {
        	organization: 'organization',
        	name: 'name',
        	v: '1.0'
        }
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, info) {
					assert.equal(err, 'Error');
					assert.equal(info, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$publicPath: '/path',
						$org: offer.organization,
						$name: offer.name,
						$v: offer.version
					});
					done();
				});
			});
		});

		it('no info available', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, info) {
					assert.equal(err, null);
					assert.equal(info, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$publicPath: '/path',
						$org: offer.organization,
						$name: offer.name,
						$v: offer.version
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, ['info']);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getAccountingInfo('/path', offer, function(err, info) {
					assert.equal(err, null);
					assert.equal(info, 'info');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$publicPath: '/path',
						$org: offer.organization,
						$name: offer.name,
						$v: offer.version
					});
					done();
				});
			});
		});
	});

	describe('addInfo', function() {
		var sentence = 'INSERT OR REPLACE INTO offerAccount \
                VALUES ($org, $name, $version, $actorID, $API_KEY, $ref)';
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
		var implementations;

		it('error first query', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback('Error first query');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, 'Error first query');
					assert.equal(spies.run.callCount, 1);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$org: data.organization,
						$name: data.name,
						$version: data.version,
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$ref: data.reference
					});
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					done();
				});
			});
		});

		it('error second query', function(done) {
			implementations = {
				run: function(query, params, callback) {
					if(query === 'INSERT OR REPLACE INTO accounting                             VALUES ($actorID, $API_KEY, $num, $publicPath, $correlation_number)') {
						return callback('Error second query');
					} else {
						return callback(null);
					}
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, 'Error second query');
					assert.equal(spies.run.callCount, 2);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$org: data.organization,
						$name: data.name,
						$version: data.version,
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$ref: data.reference
					});
					assert.deepEqual(spies.run.getCall(1).args[1], {
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$num: data.accounting['path1'].num,
						$publicPath: 'path1',
						$correlation_number: data.accounting['path1'].correlation_number
					});
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					done();
				});
			});
		});

		it('correct (1 element)', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 2);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$org: data.organization,
						$name: data.name,
						$version: data.version,
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$ref: data.reference
					});
					assert.deepEqual(spies.run.getCall(1).args[1], {
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$num: data.accounting['path1'].num,
						$publicPath: 'path1',
						$correlation_number: data.accounting['path1'].correlation_number
					});
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					done();
				});
			});
		});

		it('correct (2 elements)', function(done) {
			data.accounting['path2'] = {
				num: 1,
				correlation_number: 001
			}
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}

			sqlite_mocker(implementations, function(db, spies) {
				db.addInfo('api_key', data, function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.callCount, 4);
					assert.equal(spies.forEachOf.callCount, 1);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$org: data.organization,
						$name: data.name,
						$version: data.version,
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$ref: data.reference
					});
					assert.deepEqual(spies.run.getCall(1).args[1], {
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$num: data.accounting['path1'].num,
						$publicPath: 'path1',
						$correlation_number: data.accounting['path1'].correlation_number
					});
					assert.deepEqual(spies.run.getCall(2).args[1], {
						$org: data.organization,
						$name: data.name,
						$version: data.version,
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$ref: data.reference
					});
					assert.deepEqual(spies.run.getCall(3).args[1], {
						$actorID: data.actorID,
						$API_KEY: 'api_key',
						$num: data.accounting['path2'].num,
						$publicPath: 'path2',
						$correlation_number: data.accounting['path2'].correlation_number
					});
					assert.deepEqual(spies.forEachOf.getCall(0).args[0], data.accounting);
					done();
				});
			});
		});
	});

	describe('checkInfo', function() {
		var sentence = 'SELECT offerResource.unit\
            FROM offerAccount, offerResource\
            WHERE offerAccount.organization=offerResource.organization AND offerAccount.name=offerResource.name AND offerAccount.version=offerResource.version AND\
                    offerAccount.API_KEY=$api_key AND offerAccount.actorID=$actorID AND offerResource.publicPath=$publicPath';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, 'Error');
					assert.equal(unit, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key',
                		$actorID: '0001',
                		$publicPath: '/path'
					});
					done();
				});
			});
		});

		it('no info available', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, null);
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key',
                		$actorID: '0001',
                		$publicPath: '/path'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback) {
					return callback(null, [{unit: 'megabyte'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.checkInfo('0001', 'api_key', '/path', function(err, unit) {
					assert.equal(err, null);
					assert.equal(unit, 'megabyte');
					assert.equal(spies.all.callCount, 1);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$api_key: 'api_key',
                		$actorID: '0001',
                		$publicPath: '/path'
					});
					done();
				});
			});
		});
	});

	describe('addCBSubscription', function() {
		var sentence = 'INSERT OR REPLACE INTO subscriptions \
            VALUES ($subs_id, $api_key, $publicPath, $ref_host, $ref_port, $ref_path, $unit)';
       var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback('Error');
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addCBSubscription('api_key', '/path', 'subscription_id', 'localhost', 9010, '/private', 'megabyte', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$subs_id: 'subscription_id',
						$api_key: 'api_key',
						$publicPath: '/path',
						$ref_host: 'localhost',
						$ref_port: 9010,
						$ref_path: '/private',
						$unit: 'megabyte'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.addCBSubscription('api_key', '/path', 'subscription_id', 'localhost', 9010, '/private', 'megabyte', function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$subs_id: 'subscription_id',
						$api_key: 'api_key',
						$publicPath: '/path',
						$ref_host: 'localhost',
						$ref_port: 9010,
						$ref_path: '/private',
						$unit: 'megabyte'
					});
					done();
				});
			});
		});
	});

	describe('getCBSubscription', function(done) {
		var sentence = 'SELECT subscriptionID \
        FROM subscriptions \
        WHERE subscriptionID=$subs_id';
        var implementations;

		it('error', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getCBSubscription('subscription_id', function(err, subs_info) {
					assert.equal(err, 'Error');
					assert.equal(subs_info, null);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$subs_id: 'subscription_id'
					});
					done();
				});
			});
		});

		it('no subscription info available', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, []);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getCBSubscription('subscription_id', function(err, subs_info) {
					assert.equal(err, null);
					assert.equal(subs_info, null);
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$subs_id: 'subscription_id'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				all: function(query, params, callback){
					return callback(null, [{subs_info: 'subs_info'}]);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.getCBSubscription('subscription_id', function(err, subs_info) {
					assert.equal(err, null);
					assert.deepEqual(subs_info, {subs_info: 'subs_info'});
					assert.equal(spies.all.getCall(0).args[0], sentence);
					assert.deepEqual(spies.all.getCall(0).args[1], {
						$subs_id: 'subscription_id'
					});
					done();
				});
			});
		});
	});

	describe('deleteCBSubscription', function() {
		var sentence = 'DELETE FROM subscriptions \
            WHERE subscriptionID=$subs_id';
        var implementations;

		it('error', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback('Error', null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.deleteCBSubscription('subscription_id', function(err) {
					assert.equal(err, 'Error');
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$subs_id: 'subscription_id'
					});
					done();
				});
			});
		});

		it('correct', function(done) {
			implementations = {
				run: function(query, params, callback) {
					return callback(null);
				}
			}
			sqlite_mocker(implementations, function(db, spies) {
				db.deleteCBSubscription('subscription_id', function(err) {
					assert.equal(err, null);
					assert.equal(spies.run.getCall(0).args[0], sentence);
					assert.deepEqual(spies.run.getCall(0).args[1], {
						$subs_id: 'subscription_id'
					});
					done();
				});
			});
		});
	});
});