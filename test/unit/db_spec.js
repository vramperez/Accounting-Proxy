var rewire = require('rewire'),
	db = rewire('../../db_Redis');


var mock = {
	on: function(event, callback){},
	sadd: function(data, callback) {
		if (data[0] === 'err_sadd' || data[1] === 'err_sadd')
			callback('Error');
		else if(data[0] === 'API_KEYS' && data[1] === 'err_sadd')
			callback('Error');
		else
			callback();
	},
	hmset: function(key, data, callback){
		switch(key){
			case 'err_hmset':
				callback('Error');
				break;
			case 'err_hmset_newService':
				callback('Error');
				break;
			case 'err_hmsetorg1name11':
				callback('Error');
				break;
			case 'errAP1K3Y/public1':
				callback('Error');
				break;
			case 'correct':
			default:
				callback();
		}
	},
	hget: function(key, field, callback) {
		switch(key){
			case 'err_hget':
				callback('Error');
				break;
			case 'no_correlationNumber':
				callback(undefined, null);
				break;
			case 'actorapiKey/public':
				callback(undefined, 20.3);
				break;
			default:
				callback(undefined, '1');
		}
	},
	hgetall: function(key, callback){
		switch(key){
			case 'err_hgetall':
				callback('Error');
				break;
			case 'unit1':
				callback(undefined,{'publicPath': resource.publicPath,
					'organization': resource.offering.organization,
					'name': resource.offering.name,
					'version': resource.offering.version,
					'unit': resource.unit});
				break;
			case 'unit2':
				callback(undefined, {'publicPath': '/public2',
					'organization': resource.offering.organization,
					'name': resource.offering.name,
					'version': resource.offering.version,
					'unit': resource.unit});
				break;
			case 'res1':
				callback(undefined, {url: service1[1], port: service1[2]});
				break;
			case 'res2':
				callback(undefined, {url: service2[1], port: service2[2]});
				break;
			case 'one_apiKey':
				callback(undefined, { organization: "org1", name: "wrong_name", version: "1" , API_KEY: 'wrong'});
				break;
			case 'two_apiKey':
				callback(undefined, { organization: "org1", name: "name1", version: "1" ,API_KEY: 'ok'});
				break;
			case 'info1':
				callback(undefined, info1);
				break;
			case 'info2':
				callback(undefined, info2);
				break;
			case 'api_key1':
				callback(undefined, {publicPath: '/public1', org: 'org1', name: 'name1', version: '1'});
					break;
			case 'api_key2':
				callback(undefined, {publicPath: '/public2', org: 'org1', name: 'name1', version: '1'});
				break;
			case '/public1':
				callback(undefined, {url: 'url1', port: 'port1'});
				break;
			case '/public2':
				callback(undefined, {url: 'url2', port: 'port2'});
				break;
			case 'actorIDapi_key/public1':
			case 'actorIDapi_key/public2':
				callback(undefined, {num: 'num', correlation_number: 'co_number'});
				break;
			case '/public1_get':
				callback(undefined, { port : '9100', url : 'http://url1.com/' } );
				break;
			case '/publicundefinedundefinedundefined':
				callback(undefined, acc_info)
				break;
			case 'apiKey':
				callback(undefined, offer);
				break;
			case 'id':
				callback(null, 'correct');
				break;
			case 'apiKey1':
			case 'apiKey2':
				callback(undefined, {'api_key': key});
				break;
			case 'api_key':
				callback(undefined, {publicPath: 'hgetall', org: 'org1', name: 'name1', version: '1'});
				break;
			case 'no_exist':
			case 'null':
			default:
				callback(undefined, null);
		}
	},
	del: function(path, callback) {
		if(path === 'err_del')
			callback('Error');
		else
			callback();
	},
	srem: function(key, path, callback) {
		if(path === 'err_srem')
			callback('Error');
		else
			callback();
	},
	exists: function(key, callback) {
		switch(key){
			case 'err_exists':
				callback('Error');
				break;
			case 'err_hmset_newService':
			case 'err_sadd':
			case 'no_exists':
				callback(undefined, 0);
				break;
			case 'exist':
			case 'err_hget':
			case 'err_hmset':
			default:
				callback(undefined, 1);
		}
	}
};

db.__set__("db", mock);

var service1 = ['/public1', 'http://url1.com/', '9100', undefined],
	service2 = ['/public2', 'http://url2.com/', '9200', undefined];

var info1 = {API_KEY: 'info1', organization: 'org1', name: 'name1', version: '1'},
	info2 = {API_KEY: 'info2', organization: 'org2', name: 'name2', version: '2'};

var api_keys = ['apiKey1', 'apiKey2', 'null'],
	api_keys2 = ['apiKey1', 'null', 'apiKey2'];

var acc_info = {'recordType': 'recordType1', 'unit': 'unit1', 'component': 'component1'};

var resource = {
			publicPath: service1[0],
            offering: {
              organization: "org1",
              name: "name1",
              version: "1"
            },
            record_type: "event",
            unit: "megabyte",
            component_label: "megabyteusage"
}

var info = {
	organization: "org1",
	name: "name1",
	version: "1",
	actorID: "0001",
	API_KEY: "AP1K3Y",
	reference: "000000000000002",
	accounting:
		{
			'/public1': {
				num: 5.3,
				correlation_number: 0
			}
		}
}

var offer = {
  offering: {
    organization: "org1",
    name: "name1",
    version: "1"
  },
  reference: "000000000000002",
  customer: "0001",
  customer_name: "user2",
  resources: 
  [
    {
      provider: "provider1",
      name: "resource2",
      version: "1.0",
      content_type:"application/json",
      url: "http://example.com" + service1[0]
    }
  ]
}

describe(" Testing database ", function() {

	describe("new services", function() {
		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
			spyOn(mock, 'sadd').andCallThrough();
			spyOn(mock, 'hmset').andCallThrough();
			spyOn(mock, 'exists').andCallThrough();
		});

		it('exists fail', function(done) {
			db.newService('err_exists', service1[1], service1[2], function(err){
				expect(err).toEqual('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.sadd.callCount).toEqual(0);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('service already exist', function(done) {
			db.newService('exist', service1[1], service1[2], function(err) {
				expect(err).toEqual('[ERROR] The service already exists.');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.sadd.callCount).toEqual(0);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('sadd fail', function(done) {
			db.newService('err_sadd', service1[1], service1[2], function(err) {
				expect(err).toEqual('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('hmset fail', function(done) {
			db.newService('err_hmset_newService', service1[1], service1[2], function(err) {
				expect(err).toEqual('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('correct', function(done) {
			db.newService('no_exists', service2[1], service2[2], function(err) {
				expect(err).toBeNull();
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("get services", function() {

		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('hgetall fail', function(done) {
			db.getService('err_hgetall', function(err, obj){
				expect(err).toEqual('Error');
				expect(obj).toBeNull();
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('hgetall return non service', function(done) {
			db.getService('no_exist', function(err, obj){
				expect(err).toBeNull();
				expect(obj).toBeNull();
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('correct', function(done) {
			db.getService('/public1_get', function(err, obj){
				expect(err).toBeNull();
				expect(obj).toEqual({ port : '9100', url : 'http://url1.com/' });
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("delete services", function() {

		beforeEach(function() {
			spyOn(mock, 'del').andCallThrough();
			spyOn(mock, 'srem').andCallThrough();
		});

		it('del fail', function(done) {
			db.deleteService('err_del', function(err) {
				expect(err).toEqual('Error');
				expect(mock.del.callCount).toEqual(1);
				expect(mock.srem.callCount).toEqual(0);
				done();
			});
		});

		it('srem fail', function(done) {
			db.deleteService('err_srem', function(err) {
				expect(err).toEqual('Error');
				expect(mock.del.callCount).toEqual(1);
				expect(mock.srem.callCount).toEqual(1);
				done();
			});
		});

		it('correct', function(done) {
			db.deleteService(service1[0], function(err) {
				expect(err).toBeNull();
				expect(mock.del.callCount).toEqual(1);
				expect(mock.srem.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("add resources", function() {

		beforeEach(function() {
			spyOn(mock, 'sadd').andCallThrough();
			spyOn(mock, 'hmset').andCallThrough();
		});

		it('sadd fail', function(done) {
			this.res = JSON.parse(JSON.stringify(resource));
			this.res.publicPath = 'err';
			this.res.offering.organization = '_';
			this.res.offering.name = 's';
			this.res.offering.version = 'add';
			db.addResource(this.res, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('hmset fail', function(done) {
			this.res = JSON.parse(JSON.stringify(resource));
			this.res.publicPath = 'err_hmset';
			db.addResource(this.res, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('add correct resource', function(done) {
			db.addResource(resource, function(err){
				expect(err).toBeNull();
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});
		
	});

	describe("load units", function() {
	
		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('smembers fail', function(done) {
			mock.smembers = function(key, callback) {
				callback('Error');
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data){
				expect(err).not.toBeNull();
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('smembers return empty list', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, []);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('hgetall fail', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['err_hgetall']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).not.toBeNull();
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('hgetall return non resource', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['no_exist']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('load one correct unit', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['unit1']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({ '/public1' : { publicPath : '/public1', organization : 'org1', name : 'name1', version : '1', unit : 'megabyte' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('load two correct unit', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['unit1', 'unit2']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({ '/public1' : { publicPath : '/public1', organization : 'org1', name : 'name1', version : '1', unit : 'megabyte' }, 
										'/public2' : { publicPath : '/public2', organization : 'org1', name : 'name1', version : '1', unit : 'megabyte' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(2);
				done();
			});
		});

		it('load two correct unit', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['unit1', 'no_exist']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadUnits(function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({ '/public1' : { publicPath : '/public1', organization : 'org1', name : 'name1', version : '1', unit : 'megabyte' },});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(2);
				done();
			});
		});
	});

	describe("load resources", function() {
	
		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('smembers fail', function(done) {
			mock.smembers = function(key, callback) {
				callback('Error', undefined);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(res).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('smembers return empty list', function(done) {
			mock.smembers = function(key, callback) {
				callback('Error', []);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(res).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('hgetall fail', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['err']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('hgetall return non resource', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['no_exist']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('hgetall return one resource', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['res1']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({ res1 : { url : 'http://url1.com/', port : '9100' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('hgetall return two correct resources', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['res1', 'res2']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({ res1 : { url : 'http://url1.com/', port : '9100' }, res2 : { url : 'http://url2.com/', port : '9200' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(2);
				done();
			});
		});

		it('hgetall return two resources, one no exist', function(done) {
			mock.smembers = function(key, callback) {
				callback(undefined, ['res1', 'no_exist']);
			};
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResources(function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({ res1 : { url : 'http://url1.com/', port : '9100' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(2);
				done();
			});
		});
	});

	describe("addInfo", function() {
	
		beforeEach(function() {
			spyOn(mock, 'sadd').andCallThrough();
			spyOn(mock, 'hmset').andCallThrough();
		});

		it('first sadd fail', function(done) {
			db.addInfo('err_sadd', info, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('hmset fail', function(done) {
			db.addInfo('err_hmset',info, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('second sadd fail', function(done) {
			this.data = JSON.parse(JSON.stringify(info));
			this.data.actorID = 'err_sadd';
			db.addInfo(info.API_KEY, this.data, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(2);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('second hmset fail', function(done) {
			this.data = JSON.parse(JSON.stringify(info));
			this.data.actorID = 'err';
			db.addInfo(info.API_KEY, this.data, function(err) {
				expect(err).toEqual('Error');
				expect(mock.sadd.callCount).toEqual(2);
				expect(mock.hmset.callCount).toEqual(2);
				done();
			});
		});

		it('add info correct info, one accounting element', function(done) {
			db.addInfo(info.API_KEY, info, function(err) {
				expect(err).toBeNull();
				expect(mock.sadd.callCount).toEqual(2);
				expect(mock.hmset.callCount).toEqual(2);
				var i = 1;
				for(var p in info.accounting) {
					var acc = info.accounting[p];
					expect(mock.hmset.calls[i].args[0]).toBe(info.actorID + info.API_KEY + p);
					expect(mock.hmset.calls[i].args[1]).toEqual({ 'actorID': info.actorID, 'API_KEY': info.API_KEY, 'num': acc.num, 'publicPath': p, 'correlation_number': acc.correlation_number});
				}
				done();
			});
		});

		it('add info correct info, two accounting elements', function(done) {
			var info2 = JSON.parse(JSON.stringify(info));
			info2.accounting[service2[0]] = { num: 5.3, correlation_number: 0 };
			db.addInfo(info2.API_KEY, info2, function(err) {
				expect(err).toBeNull();
				expect(mock.sadd.callCount).toEqual(2);
				expect(mock.hmset.callCount).toEqual(3);
				expect(mock.hmset.calls[1].args[0]).toBe(info2.actorID + info2.API_KEY + service1[0]);
				expect(mock.hmset.calls[1].args[1]).toEqual({ 'actorID': info2.actorID, 'API_KEY': info2.API_KEY, 'num': info2.accounting[service1[0]].num, 'publicPath': service1[0], 'correlation_number': info2.accounting[service1[0]].correlation_number});
				expect(mock.hmset.calls[2].args[0]).toBe(info2.actorID + info2.API_KEY + service2[0]);
				expect(mock.hmset.calls[2].args[1]).toEqual({ 'actorID': info2.actorID, 'API_KEY': info2.API_KEY, 'num': info2.accounting[service2[0]].num, 'publicPath': service2[0], 'correlation_number': info2.accounting[service2[0]].correlation_number});
				done();
				done();
			});
		});
	});

	describe("getApiKey", function() {

		beforeEach(function() {
			mock.smembers = function(key, callback) {
				switch(key) {
					case 'err_smembers':
						callback('Error');
						break;
					case 'no_apiKey':
						callback(null, []);
						break;
					case 'one_apiKey':
						callback(null, ['one_apiKey']);
						break;
					case 'two_apiKey':
						callback(null, ['one_apiKey', 'two_apiKey']);
				}
			};
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('smembers fail', function(done) {
			db.getApiKey('err_smembers', offer, function(err, data) {
				expect(err).not.toBeNull();
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('smembers return empy list', function(done) {
			db.getApiKey('no_apiKey', offer, function(err, data) {
				expect(err).toBeNull();
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('return no apiKey', function(done) {
			db.getApiKey('one_apiKey', offer.offering, function(err, data) {
				expect(err).toBeNull();
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
		
	});

	describe("getInfo", function() {

		beforeEach(function() {
			mock.smembers = function(key, callback) {
				switch(key) {
					case 'err_smembers':
						callback('Error');
						break;
					case 'no_user':
						callback(undefined, []);
						break;
					case 'hgetall_fail':
						callback(undefined, ['err_hgetall']);
						break;
					case 'info1':
						callback(undefined, ['info1']);
						break;
					case 'info2':
						callback(undefined, ['info1', 'info2']);
				}
			};
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('smembers fail', function(done) {
			db.getInfo('err_smembers', function(err, res) {
				expect(err).toBe('Error');
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('smembers return empty list', function(done) {
			db.getInfo('no_user', function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(0);
				done();
			});
		});

		it('user with only one apiKey, return correct info', function(done) {
			db.getInfo('info1', function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({'info1': info1});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('user with two apiKeys, return correct info', function(done) {
			db.getInfo('info2', function(err, res) {
				expect(err).toBeNull();
				expect(res).toEqual({'info1': info1, 'info2': info2});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(2);
				done();
			});
		});
	});

	describe("count", function() {

		beforeEach(function() {
			spyOn(mock, 'hget').andCallThrough();
			spyOn(mock, 'exists').andCallThrough();
			spyOn(mock, 'hmset').andCallThrough();
		});

		it('exists fail', function(done) {
			db.count('err', '_', 'exists', 1.3, function(err, res) {
				expect(res).toBeNull();
				expect(err).toBe('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.hget.callCount).toEqual(0);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('negative amount', function(done) {
			db.count('actor', 'apiKey', '/public', -1.3, function(err, res) {
				expect(res).toBeNull();
				expect(err).toBe('[ERROR] The aomunt must be greater than 0');
				expect(mock.exists.callCount).toEqual(0);
				expect(mock.hget.callCount).toEqual(0);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('the reource doesn\'t exist', function(done) {
			db.count('no', '_', 'exists', 1.3, function(err, res) {
				expect(res).toBeNull();
				expect(err).toBe('[ERROR] The specified resource doesn\'t exist');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.hget.callCount).toEqual(0);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('hget fail', function(done) {
			db.count('err', '_', 'hget', 1.3, function(err, res) {
				expect(res).toBeNull();
				expect(err).toBe('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.hget.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(0);
				done();
			});
		});

		it('hmset fail', function(done) {
			db.count('err', '_', 'hmset', 1.3, function(err, res) {
				expect(res).toBeNull();
				expect(err).toBe('Error');
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.hget.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('correct count', function(done) {
			db.count('actor', 'apiKey', '/public', 1.3, function(err, res) {
				expect(err).toBeNull();
				expect(res).toBe(21.6);
				expect(mock.exists.callCount).toEqual(1);
				expect(mock.hget.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("resetCount", function() {

		beforeEach(function() {
			spyOn(mock, 'hget').andCallThrough();
			spyOn(mock, 'hmset').andCallThrough();
		});

		it('correlation number no exist', function(done) {
			db.resetCount('no_', 'correlation', 'Number', function(err) {
				expect(err).toBeNull();
				expect(mock.hget.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(0);
				expect(mock.hget.calls[0].args[0]).toEqual('no_correlationNumber');
				expect(mock.hget.calls[0].args[1]).toEqual('correlation_number');
				done();
			});
		});

		it('correlation number exists', function(done) {
			db.resetCount('co', 'rre', 'ct', function(err) {
				expect(err).toBeNull();
				expect(mock.hget.callCount).toEqual(1);
				expect(mock.hmset.callCount).toEqual(1);
				expect(mock.hmset.calls[0].args[0]).toEqual('correct');
				expect(mock.hmset.calls[0].args[1]).toEqual({'correlation_number': 2, 'num': '0'});
				done();
			});
		});
	});

	describe("get accounting info", function() {

		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('resource doesn\'t exist', function(done) {
			db.getAccountingInfo('', {organization: 'no', name: '_', version: 'exist'}, function(err, res){
				expect(res).toBeNull();
				expect(res).toBeNull();
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('return correct info', function(done) {
			db.getAccountingInfo('/public', offer, function(err, res){
				expect(err).toBeNull();
				expect(res).toEqual(acc_info);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("get offer", function() {

		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('no offer', function(done) {
			db.getOffer('no_exist', function(err, res){
				expect(err).toBeNull();
				expect(res).toBeNull();
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('return correct offer', function(done) {
			db.getOffer('apiKey', function(err, res){
				expect(err).toBeNull();
				expect(res).toEqual(offer);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("get reference", function() {

		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('no reference', function(done) {
			db.getReference('no_exist', function(err, res){
				expect(err).toBeNull();
				expect(res).toBeNull();
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('return correct reference', function(done) {
			db.getReference('apiKey', function(err, res){
				expect(err).toBeNull();
				expect(res).toEqual(offer.reference);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("add CB subscription", function() {

		beforeEach(function() {
			spyOn(mock, 'hmset').andCallThrough();
		});

		it('hmset fail', function(done) {
			db.addCBSubscription('', '', 'err_hmset', '', '', '', '', function(err){
				expect(err).toEqual('Error');
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});

		it('subscription add', function(done) {
			db.addCBSubscription('apiKey', '', '', '', '', '', '', function(res){
				expect(res).toBeNull();
				expect(mock.hmset.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("get CB subscription", function() {

		beforeEach(function() {
			spyOn(mock, 'hgetall').andCallThrough();
		});

		it('hmset fail', function(done) {
			db.getCBSubscription('id', function(err, res){
				expect(err).toBeNull();
				expect(res).toEqual('correct');
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});
	});

	describe("delete CB subscription", function() {

		beforeEach(function() {
			spyOn(mock, 'del').andCallThrough();
		});

		it('del', function(done) {
			db.deleteCBSubscription('err_del', function(err){
				expect(err).toEqual('Error');
				expect(mock.del.callCount).toEqual(1);
				done();
			});
		});

		it('correct', function(done) {
			db.deleteCBSubscription('correct', function(err){
				expect(err).toBeNull();
				expect(mock.del.callCount).toEqual(1);
				done();
			});
		});
	});

	// LOS TESTS DE ESTA FUNCIÓN AUXILIAR SE PRUEBAN CON LOS DE LOADFROMDB
	/*describe("loadResourcesAux", function() {
		var api_key = {
				actorID: 'actorID',
				API_KEY: 'api_key',
				organization: 'org1',
				version: '1',
				reference: '001',
				name: 'name1'
			};

		it('semembers fail', function(done) {
			var data = {};
			mock.smembers = function(key, callback){
				callback('Error');
			}
			spyOn(mock, 'smembers').andCallThrough();
			db.loadResourcesAux('api_key', data, function(){
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				done();
			});
		});

		it('first hgetall return null', function(done) {
			var data = {};
			mock.smembers = function(key, callback){
				callback(undefined, ['null']);
			}
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
			db.loadResourcesAux(api_key, data, function(){
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(1);
				done();
			});
		});

		it('second and third hgetall return null', function(done) {
			var data = {};
			this.api_key = JSON.parse(JSON.stringify(api_key));
			this.api_key.actorID = 'err';
			this.api_key.API_KEY = '_';
			mock.smembers = function(key, callback){
				callback(undefined, ['api_key']);
			}
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
			db.loadResourcesAux(this.api_key, data, function(){
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(3);
				done();
			});
		});

		it('load two correct resources', function(done) {
			var data = {};
			mock.smembers = function(key, callback){
				callback(undefined, ['api_key1', 'api_key2']);
			}
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
			db.loadResourcesAux(api_key, data, function(){
				expect(data).toEqual({ api_key : { actorID : 'actorID', organization : 'org1', name : 'name1', version : '1', accounting : { '/public1' : { url : 'url1', port : 'port1', num : 'num', correlation_number : 'co_number', unit : undefined }, '/public2' : { url : 'url2', port : 'port2', num : 'num', correlation_number : 'co_number', unit : undefined } }, reference : '001' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(6);
				done();
			});
		});
	});*/

	/*describe("load from DB", function() {

		beforeEach(function() {
			mock.smembers = function(key, callback){
				callback(undefined, api_keys);
			}
			spyOn(mock, 'smembers').andCallThrough();
			spyOn(mock, 'hgetall').andCallThrough();
			spyOn(db, 'loadResourcesAux').andCallThrough();
		});


		it('smembers fail', function(done) {
			mock.smembers = function(key, callback){
				callback('Error');
			}
			spyOn(mock, 'smembers').andCallThrough();
			db.loadFromDB(function(err, data){
				expect(err).toEqual('Error');
				expect(data).toBeNull();
				expect(mock.smembers.callCount).toEqual(1);
				done();
			});
		});

		it('smembers return empty list', function(done) {
			mock.smembers = function(key, callback){
					callback(undefined, []);
			}
			spyOn(mock, 'smembers').andCallThrough();
			db.loadFromDB(function(err, data){
				expect(err).toBeNull();
				expect(data).toEqual({});
				expect(mock.smembers.callCount).toEqual(1);
				done();
			});
		});

		it('three apiKeys, hgetall return one null', function(done) {
			db.loadFromDB(function(err, data){
				expect(err).toBeNull();
				expect(data).toEqual({ apiKey1 : { field1 : 'correct' }, apiKey2 : { field1 : 'correct' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(3);
				//expect(db.loadResourcesAux.callCount).toEqual(2);
				//expect(db.loadResourcesAux.calls[0].args[0]).toEqual( {'api_key': 'apiKey1'});
				//expect(db.loadResourcesAux.calls[1].args[0]).toEqual( {'api_key': 'apiKey2'});
				done();
			});
		});

		it('three apiKeys, hgetall return one null', function(done) {
			mock.smembers = function(key, callback){
				callback(undefined, api_keys2);
			}
			spyOn(mock, 'smembers').andCallThrough();
			db.loadFromDB(function(err, data){
				expect(err).toEqual(undefined);
				expect(data).toEqual({ apiKey1 : { field1 : 'correct' }, apiKey2 : { field1 : 'correct' } });
				expect(mock.smembers.callCount).toEqual(1);
				expect(mock.hgetall.callCount).toEqual(3);
				expect(db.loadResourcesAux.callCount).toEqual(2);
				expect(db.loadResourcesAux.calls[0].args[0]).toEqual( {'api_key': 'apiKey1'});
				expect(db.loadResourcesAux.calls[1].args[0]).toEqual( {'api_key': 'apiKey2'});
				done();
			});
		}); 
	});*/
});