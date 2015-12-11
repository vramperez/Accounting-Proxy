var proxyquire = require('proxyquire');


var db_mock = {
	err_load: false,
	err_count: false,
	map: {},
	count: function(actoriId, api_key, path, amount, callback){
		if(this.err_count)
			callback('Error')
		else
			callback(undefined, undefined);
	},
	loadFromDB: function(callback){
		if(this.err_load)
			return callback('Error', undefined);
		else
			return callback(undefined, this.map);
	},
	reset: function(){
		this.err_load = false;
		this.err_count = false;
		this.map = {};
	}
}

var api_mock = {
	run: function(map){}
}

var notifier_mock = {
	err: false,
	notify: function(info, callback){
		return callback('api-key1', '/public1', 0)
	},
	reset: function(){
		this.err = false;
	}
}

var contextBroker_mock = {
	CBSubscriptionPath: function(url, request, callback){

	},
	CBRequestHandler: function(request, response, accounting, operation){

	},
	run: function(){}
}

var acc_modules_mock = {
	error: false,
	unit: function(response, callback){
		if(error)
			callback('Error', undefined);
		else
			callback(undefined, 12.3);
	},
	reset: function(){
		this.error = false;
	}
}

var config_mock = {
	resources: {
		contextBroker: false
	},
	reset: function(){
		this.resources.contextBroker = false;
	}
}

var req_mock = {
	on: function(){},
	get: function(header){
		return this[header];
	},
	reset: function(){

	}
}

var resp_mock = {
	statusCode: undefined,
	status: function(status){
		this.statusCode = status;
		return this;
	},
	end: function(){},
	send: function(resp){},
	setHeader: function(header, value){},
	reset: function() {
		this.statusCode = undefined;
	}
}

var app_mock = {
	set: function(prop, value){},
	listen: function(port){},
	get: function(prop){
		return 0;
	},
	use: function(callback){
		return callback(req_mock, resp_mock);
	}
}

var proxy_mock = {
	getClientIp: function(request, headers){
		return ['header'];
	},
	sendData: function(protocol, options, body, response, callback){
		return callback(200, {}, ['header']);
	}
}

describe('Testing accounting-proxy server', function() {

	describe('load from DB', function() {

		beforeEach(function() {
			spyOn(app_mock, 'listen').andCallThrough();
			spyOn(api_mock, 'run').andCallThrough();
			spyOn(notifier_mock, 'notify').andCallThrough();
			spyOn(contextBroker_mock, 'run').andCallThrough();
		});

		afterEach(function() {
			db_mock.reset();
			config_mock.reset();
		});

		it('error loading from DB', function() {
			db_mock.err_load = true;
			this.server = proxyquire('../../server', {'./db_Redis': db_mock});
			expect(notifier_mock.notify.callCount).toEqual(0);
			expect(app_mock.listen.callCount).toEqual(0);
			expect(api_mock.run.callCount).toEqual(0);
		});

		it('no data available', function() {
			db_mock.map = {};
			var server = proxyquire('../../server', {'./db_Redis': db_mock});
			expect(notifier_mock.notify.callCount).toEqual(0);
			expect(app_mock.listen.callCount).toEqual(0);
			expect(api_mock.run.callCount).toEqual(0);
		});

		it('data available, context broker activated', function() {
			db_mock.map = {
				'api-key1': {
					name: 'name',
					version: 1,
					reference: 'reference',
					accounting: {
						'/public1': {
							actorID: 'actorID1',
							organization: 'organization1',
							num: 10.23,
							correlation_number: 0000002
						}
					}
				}
			}
			config_mock.resources.contextBroker = true;
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock, 
				'./notifier': notifier_mock,
				'./config': config_mock,
				'./orion_context_broker/cb_handler': contextBroker_mock});
			expect(app_mock.listen.callCount).toEqual(0);
			expect(api_mock.run.callCount).toEqual(0);
			expect(notifier_mock.notify.callCount).toEqual(1);
			expect(contextBroker_mock.run.callCount).toEqual(1);
		});
	});

	describe('auxiliar functions', function() {

		beforeEach(function() { 
			spyOn(acc_modules_mock, 'unit').andCallThrough();
			spyOn(db_mock, 'count').andCallThrough();
		});

		afterEach(function() {
			db_mock.reset();
			acc_modules_mock.reset();
		});

		it('new buy', function() {
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock,
			});
			server.newBuy('api_key1', { field1: 'value1', field2: 'value2' });
			// Can't check
		});

		it('get map', function(done) {
			db_mock.map = {
				'field1': 'value1'
			}
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock,
			});
			server.getMap(function (data){
				expect(data).toEqual(db_mock.map);
				done();
			});
		});

		
	});

	describe("'use' express", function() {

		beforeEach(function() {
			spyOn(resp_mock, 'status').andCallThrough();
			spyOn(resp_mock, 'end').andCallThrough();
			spyOn(proxy_mock, 'getClientIp').andCallThrough();
			spyOn(proxy_mock, 'sendData').andCallThrough();
			spyOn(db_mock, 'count').andCallThrough();
			spyOn(contextBroker_mock, 'CBRequestHandler').andCallThrough();
		});

		afterEach(function() {
			db_mock.reset();
			req_mock.reset();
			resp_mock.reset();
			config_mock.reset();
		});

		it('userID not defined, should return 400', function() {
			var server = proxyquire('../../server', { 
				express:  function(){
					return app_mock;
				} 
			});
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.statusCode).toEqual(400);
			expect(resp_mock.end.callCount).toEqual(1);
			expect(proxy_mock.getClientIp.callCount).toEqual(0);
		});

		it('API-KEY not defined, should return 400', function() {
			req_mock['X-Actor-ID'] = 'userID';
			var server = proxyquire('../../server', { 
				express:  function(){
					return app_mock;
				} 
			});
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.statusCode).toEqual(400);
			expect(resp_mock.end.callCount).toEqual(1);
			expect(proxy_mock.getClientIp.callCount).toEqual(0);
		});


		it('wrong userID, should return 403', function() {
			req_mock['X-Actor-ID'] = 'actorID';
			req_mock['X-API-KEY'] = 'api-key';
			var server = proxyquire('../../server', {
				express:  function(){
					return app_mock;
				}
			});
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.statusCode).toEqual(403);
			expect(resp_mock.end.callCount).toEqual(1);
			expect(proxy_mock.getClientIp.callCount).toEqual(0);
		});

		it('wrong userID, should return 403', function() {
			req_mock['X-Actor-ID'] = 'actorID';
			req_mock['X-API-KEY'] = 'api-key';
			db_mock.map = { 
				'api-key': {
					actorID: 'other_user'
				} 
			};
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock,
				express:  function(){
					return app_mock;
				}
			});
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.statusCode).toEqual(403);
			expect(resp_mock.end.callCount).toEqual(1);
			expect(proxy_mock.getClientIp.callCount).toEqual(0);
		});

		it('no accounting info, should return 404', function() {
			req_mock['X-Actor-ID'] = 'actorID';
			req_mock['X-API-KEY'] = 'api-key';
			db_mock.map = { 
				'api-key': {
					actorID: 'actorID',
					accounting: { }
				} 
			};
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock,
				express:  function(){
					return app_mock;
				}
			});
			expect(resp_mock.status.callCount).toEqual(1);
			expect(resp_mock.statusCode).toEqual(404);
			expect(resp_mock.end.callCount).toEqual(1);
			expect(proxy_mock.getClientIp.callCount).toEqual(0);
		});

		it('no CB, error while making the accounting', function() {
			// Falta test que falle en count del módulo 
			req_mock['X-Actor-ID'] = 'actorID';
			req_mock['X-API-KEY'] = 'api-key';
			req_mock.path = '/public';
			db_mock.err_count = true;
			db_mock.map = { 
				'api-key': {
					actorID: 'actorID',
					accounting: { 
						'/public': {
							port: 9000,
							url: "http://localhost:9000/path",
							unit: 'megabyte'
						}
					}
				} 
			};
			var server = proxyquire('../../server', {
				'./db_Redis': db_mock,
				'./HTTP_Client/HTTPClient': proxy_mock,
				express:  function() {
					return app_mock;
				}
			});
			expect(resp_mock.status.callCount).toEqual(0);
			expect(resp_mock.end.callCount).toEqual(0);
			expect(proxy_mock.getClientIp.callCount).toEqual(1);
			expect(proxy_mock.sendData.callCount).toEqual(1);
			expect(db_mock.count.callCount).toEqual(1);
		});
	});
});