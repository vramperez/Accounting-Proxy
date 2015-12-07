var rewire = require('rewire'),
	server = rewire('../../server');


var db_mock = {
	err: false,
	map: {},
	count: function(actoriId, api_key, path, amount, callback){

	},
	loadFromDB: function(callback){
		if(this.err)
			return callback('Error', undefined);
		else
			return callback(undefined, map);
	},
	reset: function(){
		this.err = false;
		map = {};
	}
}

var api_mock = {
	run: function(map){}
}

var notifier_mock = {
	err: false,
	notify: function(info, callback){

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

describe('Testing accounting-proxy server', function() {

	server.__set__('db', db_mock);
	server.__set__('api', api_mock);
	server.__set__('notifier', notifier_mock);
	server.__set__('contextBroker', contextBroker_mock);

	describe('auxiliar functions', function() {

		beforeEach(function() {
			spyOn(server, 'newBuy').andCallThrough();
		})

		afterEach(function() {
			db_mock.reset();
		})

		it('new buy', function() {
			server.newBuy('api_key1', {'field1': 'value1'});
			expect(server.newBuy.callCount).toEqual(1);
			expect(server.newBuy.calls[0].args).toEqual(['api_key1', {'field1': 'value1'} ] );
		});

		/*it('get map', function(done) {
			server.getMap(function(data) {
				console.log(data)
				expect(data).toEqual(db_mock.map);
				done();
			});
		});*/
	});
});