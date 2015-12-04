var rewire = require('rewire'),
	cb_handler = rewire('../../orion_context_broker/cb_handler');

var config_mock = {
	resources: {
		notification_port: 9000,
		host: 'host'
	}
}

var proxy_mock = {
	sendData: function(protocol, options, body, response, callback){
		if(options.host === 'err_notifying')
			callback(400, { statusMessage: 'Error notifying the subscriptor'}, ['header1'])
	}
}

var req_mock = {
	resetBody: function(){
		this.body =  {
			subscriptionId: ''
		}
	},
	on: function(event, callback){
		callback(JSON.stringify(this.body));
	}
}

var resp_mock = {
	message: undefined,
	payload: undefined,
	statusCode: undefined,
	status: function(stat){
		return this;
	},
	send: function(resp){},
	json: function(payload){
		this.payload = payload;
	},
	setHeader: function(header, value){}
}

var app_mock = {
	port: config_mock.resources.notification_port,
	get: function(option){
		if(option === 'port')
			return this.port;
	},
	set: function(option, value){
		this.option = value;
	},
	listen: function(port){}
}

var db_mock = {
	getCBSubscription: function(subscriptionId, callback){
		switch(subscriptionId){
			case 'err_getCBSubscription':
				callback(null);
				break;
			case 'err_count':
				callback({
					API_KEY: 'err_count',
					publicPath: '/public',
					unit: 'unit'
				});
				break;
			case 'err_notifying':
				callback({
					API_KEY: 'err_notifying',
					publicPath: '/public',
					unit: 'unit',
					ref_host: 'err_notifying',
					ref_port: 9000,
					ref_path: '/public'
				});
		}
	},
	addCBSubscription: function(api_key, path, subsId, host, port, path, unit, callback){

	}
}

var acc_proxy_mock = {
	count: function(api_key, path, unit, body, callback){
		switch(api_key){
			case 'err_count':
				callback('Error');
				break;
			case 'err_notifying':
				callback();
				break;
		}
	}
}

describe("Testing db_handler", function(){

	cb_handler.__set__('app', app_mock);
	cb_handler.__set__('db', db_mock);
	cb_handler.__set__('acc_proxy', acc_proxy_mock);
	cb_handler.__set__('proxy', proxy_mock);

	describe("run", function(){

		it('correct', function() {
			spyOn(app_mock, 'listen').andCallThrough();
			cb_handler.run();
			expect(app_mock.listen.callCount).toEqual(1);
			expect(app_mock.listen.calls[0].args).toEqual([config_mock.resources.notification_port])
		});
	});

	describe(";", function() {

		beforeEach(function() {
			req_mock.resetBody();
			callback = jasmine.createSpy('callback');
		});

		args = [ ['/wrong', {method: 'POST'}, undefined], 
				 ['/v1/subscribeContext', {method: 'POST'}, 'subscribe'],
				 ['/v1/registry/unsubscribeContextAvailability', {method: 'POST'}, 'unsubscribe'],
				 ['/v1/registry/unsubscribeContextAvailability', {method: 'POST'}, 'unsubscribe'], ];

		args.forEach(function(entry) {
			it("CBSubscriptionPath( " +  entry[0] + " , " + entry[1].method + ") , should return " + entry[2], function(){
				cb_handler.CBSubscriptionPath(entry[0], entry[1], callback);
				expect(callback.callCount).toEqual(1);
				expect(callback.calls[0].args).toEqual([entry[2]]);
			});
		});
	});

	describe("notification handler;", function() {

		beforeEach(function() {
			req_mock.resetBody();
			spyOn(db_mock, 'getCBSubscription').andCallThrough();
			spyOn(acc_proxy_mock, 'count').andCallThrough();
			spyOn(proxy_mock, 'sendData').andCallThrough();
			spyOn(resp_mock, 'send').andCallThrough();
		});

		it('error while obtaining the subscriptionId', function(){
			req_mock.body.subscriptionId = 'err_getCBSubscription';
			cb_handler.notificationHandler(req_mock, resp_mock);
				expect(db_mock.getCBSubscription.callCount).toEqual(1);
		});

		it('error while making the accounting', function(){
			req_mock.body.subscriptionId = 'err_count';
			cb_handler.notificationHandler(req_mock, resp_mock);
			expect(db_mock.getCBSubscription.callCount).toEqual(1);
			expect(acc_proxy_mock.count.callCount).toEqual(1);
		});

		it('error while notifying the subscriptor', function(){
			req_mock.body.subscriptionId = 'err_notifying';
			cb_handler.notificationHandler(req_mock, resp_mock);
			expect(db_mock.getCBSubscription.callCount).toEqual(1);
			expect(acc_proxy_mock.count.callCount).toEqual(1);
			expect(proxy_mock.sendData.callCount).toEqual(1);
			expect(resp_mock.send.callCount).toEqual(1);
		});

		it('correct notification to the subscriber', function(){
			req_mock.body.subscriptionId = 'err_notifying';
			cb_handler.notificationHandler(req_mock, resp_mock);
			expect(db_mock.getCBSubscription.callCount).toEqual(1);
			expect(acc_proxy_mock.count.callCount).toEqual(1);
			expect(proxy_mock.sendData.callCount).toEqual(1);
			expect(resp_mock.send.callCount).toEqual(1);
		});
	});

	describe("(un)subscribe request handler;", function() {

		beforeEach(function() {
			req_mock.resetBody();
			spyOn(proxy_mock, 'sendData').andCallThrough();
		});

		it('[subscription] response to the client or CB fail', function() {
			this.accounting = {
				port: 9000,
				privatePath: 'err_response_subs'
			}
		})
	});
});