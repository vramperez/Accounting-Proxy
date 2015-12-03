var rewire = require('rewire'),
	notifier = rewire('../../notifier');

var db_mock = {
	getAccountingInfo: function(path, data, callback){
		if(path === 'no_accounting')
			callback(undefined);
		else
			callback({
				record_type: 'record_type',
				component_label: 'component_label'
			})
	},
	resetCount: function(user, api_key, path){}
}

var info_mock = {};

var http_mock = {
	write: function(body){},
	end: function(){},
	request: function(options, callback){
		var res = {};
		if(options.host === 'err_request'){
			res.statusCode = 400;
			callback(res);
		} else{
			res.statusCode = 200;
			callback(res);
		}
		return this;
	}
}

describe("Testing notifier", function() {

	beforeEach(function() {
		this.data ={
			num: 1,
			API_KEY: 'api_key',
			publicPath: '/public',
			organization: 'organization',
			name: 'name',
			version: 'version',
			actorID: 'actorID',
			correlation_number: 'correlation_number',
			record_type: 'record_type',
			component_label: 'component_label'
		}
		this.config_mock = {
			WStore: {
				accounting_host: 'host',
				accounting_port: 'port',
				accounting_path: '/public',
			}
		}
		notifier.__set__('db', db_mock);
		notifier.__set__('info', info_mock);
		notifier.__set__('http', http_mock);
		notifier.__set__('config', this.config_mock);
		callback = jasmine.createSpy('callback');
	});

	it('no request needed', function() {
		this.data.num = 0;
		notifier.notify(this.data, callback);
		expect(callback.callCount).toEqual(1);
		expect(callback.calls[0].args).toEqual(['api_key', '/public', 0]);
	});

	it('no accounting info', function() {
		this.data.publicPath = 'no_accounting';
		notifier.notify(this.data, callback);
		expect(callback.callCount).toEqual(1);
		expect(callback.calls[0].args).toEqual(['api_key', 'no_accounting', 1]);
	});

	it('request failed', function(){
		this.config_mock.WStore.accounting_host = 'err_request'
		notifier.notify(this.data, callback);
		expect(callback.callCount).toEqual(1);
		expect(callback.calls[0].args).toEqual(['api_key', '/public', 1]);
	});

	it('request worked', function(){
		notifier.notify(this.data, callback);
		expect(callback.callCount).toEqual(1);
		expect(callback.calls[0].args).toEqual(['api_key', '/public', 0]);
	});
});