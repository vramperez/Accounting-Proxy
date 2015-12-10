var proxyquire = require('proxyquire');


var db_mock = {
	err: false,
	map: {},
	count: function(actoriId, api_key, path, amount, callback){
		if(this.err)
			callback('Error')
		else
			callback(undefined, undefined);
	},
	loadFromDB: function(callback){
		if(this.err)
			return callback('Error', undefined);
		else
			return callback(undefined, this.map);
	},
	reset: function(){
		this.err = false;
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
	DBSubscriptionPath: function(url, request, callback){

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

var app_mock = {
	set: function(prop, value){},
	listen: function(port){},
	get: function(prop){
		return 0;
	},
	use: function(callback){
		return callback(this.req, this.resp);
	}
}

var req_mock = {
	on: function(){},
	get: function(header){
		
	}
}

var resp_mock = {

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
			db_mock.err = true;
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
				'fielf1': 'value1'
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

		});

		afterEach(function() {

		});

		it('userID not defined, should return 400', function() {
			app_mock.req.userID = undefined;
			var server = proxyquire('../../server', { 
				express:  function(){
					return app_mock;
				} 
			});
		});
	});
});
