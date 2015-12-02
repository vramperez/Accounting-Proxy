var rewire = require('rewire'),
	http = require('http'),
	api = rewire('../../APIServer');

var db_mock = {
	loadResources: function(callback){
		callback({});
	},
	loadUnits: function(callback){
		var data = {
			'/public1': {
				publicPath: '/public1',
				organization: 'org1',
				name: 'name1',
				version: '1',
				unit: 'megabyte'
			},
			'/public2': {
				publicPath: '/public2',
				organization: 'org2',
				name: 'name2',
				version: '2',
				unit: 'megabyte'
			}
		}
		callback(data)
	},
	getService: function(path, callback){
		switch(path){
			case '/no_data':
				callback(undefined, undefined);
				break;
			default:
				callback(undefined, {url: 'url', port: 9000});
		}
	},
	addResource: function(resource, callback){
		switch(resource.offering){
			case 'err_addResource':
				callback('Error');
				break;
			default:
				callback(undefined);
		}
	},
	getApiKey: function(user, offer, callback){
		callback(undefined);
	},
	addInfo: function(api_key, info, callback){
		switch(api_key){
			case '00251be6e7b29c4d0c35ef4586d2d7ffb5105ce0':
				callback('Error');
				break;
			default:
				callback(undefined);
		}
	},
	getInfo: function(user, callback){
		switch(user){
			case 'err_getInfo':
				callback('Error', {});
				break;
			default:
				callback(undefined, {
					API_key1: {
						organization: 'organization1',
						name: 'name1',
						version: 'version1',
						api_key: 'API_key1'
					},
					API_key2: {
						organization: 'organization2',
						name: 'name2',
						version: 'version2',
						api_key: 'API_key2'
					}
				})
		}
	}
}

var req_mock = http.request();
	req_mock.get = function(header){
		return this._headers[header];
	};
	req_mock.resetBody = function(){
		this.body = {
			record_type: 'record_type',
			unit: 'megabyte',
			component_label: 'component_label',
			url:'url',
			offering: {
				organization: 'organization',
				name: 'name',
				version: 'version'
			},
			resources: [
				{
					provider: "provider1",
					name: "resource1",
					version: "1.0",
					content_type:"application/json",
					url: "http:\/\/www.example.com/public1"
				},
				{
					provider: "provider2",
					name: "resource2",
					version: "1.0",
					content_type:"application/json",
					url: "http:\/\/www.example.com/public2"
				}
			],
			user: 'userID',
			ref: 'reference'
		}
	};
	req_mock.on = function(event, callback){
		callback(this.body);
	};
	req_mock.setHeader = function(header, value){
		this._headers[header] = value;
	};
	req_mock.clearBody = function(){
		this.body = undefined;
	};
	req_mock.setEncoding = function(encoding){};

var resp_mock = {
	message: undefined,
	payload: undefined,
	status: function(stat){
		return this;
	},
	send: function(message){
		this.message = message;
	},
	json: function(payload){
		this.payload = payload;
	}
}

var proxy_mock = {
	getMap: function(callback){
		callback(map);
	},
	newBuy: function(api_key, data){}
};

var map = {
	'field1': 'value1',
	'field2': 'value1'
};

describe("Testing APIServer", function() {

	api.__set__("db", db_mock);
	api.__set__("proxy", proxy_mock);

	describe("method run", function() {

		beforeEach(function() {
			spyOn(db_mock, "loadResources").andCallThrough();
			spyOn(db_mock, "loadUnits").andCallThrough();
		});

		it('no resources available', function() {
			api.run(map);
			expect(db_mock.loadResources.callCount).toEqual(1);
			expect(db_mock.loadUnits.callCount).toEqual(1);
		});
	});

	describe("post /api/resources", function() {

		beforeEach(function(){
			spyOn(resp_mock, 'status').andCallThrough();
			spyOn(db_mock, 'getService').andCallThrough();
			spyOn(db_mock, 'addResource').andCallThrough();
			req_mock.resetBody();
			req_mock.setHeader('Content-Type', 'application/json');
		});

		afterEach(function() {
			req_mock.resetBody();
		});

		it("incorrect Content-Type", function() {
			req_mock.setHeader('Content-Type', 'application/xml');
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(415);
		});

		it('incorrect body xml, should be json return 400', function() {
			req_mock.body.record_type = undefined; 
			req_mock.body = JSON.stringify(req_mock.body);
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
		});

		it('get service return no data, should return 400', function() {
			req_mock.body.url = 'http://localhost/no_data'
			req_mock.body = JSON.stringify(req_mock.body);
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(db_mock.getService.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
			expect(db_mock.getService.calls[0].args[0]).toEqual('/no_data');
		});

		it('Unsupported accounting module, should return 400', function() {
			req_mock.body.unit = 'no_exist'
			req_mock.body = JSON.stringify(req_mock.body);
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(db_mock.getService.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
			expect(db_mock.getService.calls[0].args[0]).toEqual('url');
			expect(resp_mock.message).toEqual('Unsupported accounting unit.');
		});

		it('Add correct resource, database fail, should return 400', function() {
			req_mock.body.offering = 'err_addResource';
			req_mock.body = JSON.stringify(req_mock.body);
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(db_mock.getService.callCount).toEqual(1);
			expect(db_mock.addResource.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
		});

		it('Add correct resource, should return 201', function() {
			req_mock.body = JSON.stringify(req_mock.body);
			api.resourcesHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(db_mock.getService.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(201);
			expect(db_mock.getService.calls[0].args[0]).toEqual('url');
		});

	});

	describe('post /api/users', function() {

		beforeEach(function(){
			spyOn(resp_mock, 'status').andCallThrough();
			spyOn(db_mock, 'getApiKey').andCallThrough();
			spyOn(db_mock, 'addInfo').andCallThrough();
			spyOn(proxy_mock, 'newBuy').andCallThrough();
			req_mock.resetBody();
			req_mock.setHeader('Content-Type', 'application/json');
		});

		afterEach(function() {
			req_mock.resetBody();
		});

		it('incorrect Content-Type should return 415', function() {
			req_mock.setHeader('Content-Type', 'application/xml');
			api.usersHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(415);
		});

		it('add info to db fails', function() {
			req_mock.body.user = 'err_';
			req_mock.body.offering.organization = 'organization2';
			req_mock.body = JSON.stringify(req_mock.body);
			api.usersHandler(req_mock, resp_mock);
			expect(db_mock.getApiKey.callCount).toEqual(1);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
			expect(db_mock.addInfo.callCount).toEqual(1);
		});

		it('update map', function() {
			req_mock.body = JSON.stringify(req_mock.body);
			api.usersHandler(req_mock, resp_mock);
			expect(db_mock.getApiKey.callCount).toEqual(1);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(201);
			expect(proxy_mock.newBuy.callCount).toEqual(1);
			expect(proxy_mock.newBuy.calls[0].args[0]).toEqual('0c307d83843ff4c368e3e15bbe6399b09d6ee2f1');
			expect(proxy_mock.newBuy.calls[0].args[1]).toEqual({ actorID: undefined, organization: 'organization', name: 'name', version: 'version', accounting: {}, reference: undefined });
			expect(db_mock.addInfo.callCount).toEqual(1);
			expect(proxy_mock.newBuy.calls[0].args[0]).toEqual('0c307d83843ff4c368e3e15bbe6399b09d6ee2f1');
			expect(proxy_mock.newBuy.calls[0].args[1]).toEqual({ actorID: undefined, organization: 'organization', name: 'name', version: 'version', accounting: {}, reference: undefined });
		});

		it('correct, should return 201', function() {
			req_mock.body = JSON.stringify(req_mock.body);
			var resources_mock = {
				'/public1': 'value1',
				'/public2': 'value2'
			}	
			var offerResources_mock = {
				'8fd4fb2427b2470750e8c7a6f2c6f2d6521fccf3': 'megabyte',
				'5e11d209a20f9535923b3bb5f0f0b5ad632bdb27': 'megabyte'
			}
			api.__set__("resources", resources_mock);
			api.__set__("offerResource", offerResources_mock);
			api.usersHandler(req_mock, resp_mock);
			expect(db_mock.getApiKey.callCount).toEqual(1);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(201);
			expect(proxy_mock.newBuy.callCount).toEqual(1);
			expect(proxy_mock.newBuy.calls[0].args[0]).toEqual('0c307d83843ff4c368e3e15bbe6399b09d6ee2f1');
			expect(proxy_mock.newBuy.calls[0].args[1]).toEqual({ actorID : undefined, organization : 'organization', name : 'name', version : 'version', accounting : { '/public1' : { url : undefined, port : undefined, num : 0, correlation_number : 0, unit : 'megabyte' }, '/public2' : { url : undefined, port : undefined, num : 0, correlation_number : 0, unit : 'megabyte' } }, reference : undefined });
			expect(db_mock.addInfo.callCount).toEqual(1);
			expect(proxy_mock.newBuy.calls[0].args[0]).toEqual('0c307d83843ff4c368e3e15bbe6399b09d6ee2f1');
			expect(proxy_mock.newBuy.calls[0].args[1]).toEqual({ actorID : undefined, organization : 'organization', name : 'name', version : 'version', accounting : { '/public1' : { url : undefined, port : undefined, num : 0, correlation_number : 0, unit : 'megabyte' }, '/public2' : { url : undefined, port : undefined, num : 0, correlation_number : 0, unit : 'megabyte' } }, reference : undefined });
		});
	});
	
	describe('get /api/users/keys', function() {

		beforeEach(function(){
			spyOn(resp_mock, 'status').andCallThrough();
			spyOn(db_mock, 'getInfo').andCallThrough();
			spyOn(resp_mock, 'json').andCallThrough();
			req_mock.resetBody();
			req_mock.setHeader('Content-Type', 'application/json');
			req_mock.setHeader('X-Actor-ID', 'userID');
		});

		afterEach(function() {
			req_mock.resetBody();
		});

		it('request without X-Actor-ID, should return 400', function(){
			req_mock.setHeader('X-Actor-ID', undefined);
			api.keysHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
		});

		it('get info from db fail, should return 400', function(){
			req_mock.setHeader('X-Actor-ID', 'err_getInfo');
			api.keysHandler(req_mock, resp_mock);
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.status.calls[0].args[0]).toEqual(400);
		});

		it('correct request, should return correct info', function(){
			req_mock.setHeader('X-Actor-ID', 'userID');
			api.keysHandler(req_mock, resp_mock);
			expect(resp_mock.json.callCount).toEqual(1);
			expect(resp_mock.json.calls[0].args[0]).toEqual([{ offering : { organization : 'organization1', name : 'name1', version : 'version1' }, API_KEY : undefined }, { offering : { organization : 'organization2', name : 'name2', version : 'version2' }, API_KEY : undefined }]);
		});
	});
});