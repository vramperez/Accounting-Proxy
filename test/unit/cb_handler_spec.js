var rewire = require('rewire'),
	cb_handler = rewire('../../orion_context_broker/cb_handler');

var config_mock = {
	resources: {
		notification_port: 9000,
		host: 'host'
	}
}

var proxy_mock = {
	sendData: function(protocol, option, body, response, callback){

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
					api_key: 'err_count',
					publicPath: '/public',
					unit: 'unit'
				});
				break;
		}
	}
}

var acc_proxy_mock = {
	count: function(api_key, path, unit, body, callback){
		console.log(api_key)
		if(api_key === 'err_count')
			callback('Error');
	}
}

describe("Testing db_handler", function(){

	cb_handler.__set__('app', app_mock);
	cb_handler.__set__('db', db_mock);
	cb_handler.__set__('acc_proxy', acc_proxy_mock);

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
		});

		it('error while obtaining the subscriptionId', function(){
			req_mock.body.subscriptionId = 'err_getCBSubscription';
			cb_handler.notificationHandler(req_mock, resp_mock);
				expect(db_mock.getCBSubscription.callCount).toEqual(1);
		});

		it('error while making the accounting', function(){
			req_mock.body.subscriptionId = 'subscriptionId';
			cb_handler.notificationHandler(req_mock, resp_mock);
			expect(db_mock.getCBSubscription.callCount).toEqual(1);
			expect(acc_proxy_mock.count.callCount).toEqual(1);
		});
	});
});