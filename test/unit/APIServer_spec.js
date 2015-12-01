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
	}
}

var mock_req = http.request();
	mock_req.get = function(header){
		return this._headers[header];
	};
	mock_req.body = {};
	mock_req.on = function(event, callback){
		callback(this.body);
	};
	mock_req.setHeader = function(header, value){
		this._headers[header] = value;
	};
	mock_req.clearBody = function(){
		this.body = undefined;
	};
	mock_req.setEncoding = function(encoding){};

var mock_resp = {
	status: function(stat){
		return this;
	},
	send: function(){}
}

var request = {},
	response = {};

describe("Testing APIServer", function() {

	api.__set__("db", db_mock);

	describe("method run", function() {

		beforeEach(function() {
			spyOn(db_mock, "loadResources").andCallThrough();
			spyOn(db_mock, "loadUnits").andCallThrough();
		});

		it('no resources available', function() {
			data = {
				'field1': 'value1',
				'field2': 'value1'
			};
			api.run(data);
			expect(db_mock.loadResources.callCount).toEqual(1);
			expect(db_mock.loadUnits.callCount).toEqual(1);
		});
	});

	describe("post /resources", function() {

		beforeEach(function(){
			spyOn(mock_resp, 'status').andCallThrough();
		});

		it("incorrect Content-Type", function() {
			mock_req.setHeader('Content-Type', 'application/xml');
			api.resourcesHandler(mock_req, mock_resp);
			expect(mock_resp.status.callCount).toEqual(1);
			expect(mock_resp.status.calls[0].args[0]).toEqual(415);
		});
	});

	describe('post /resources', function() {

		beforeEach(function(){
			spyOn(mock_resp, 'status').andCallThrough();
		});

		afterEach(function() {
			mock_req.clearBody();
		});

		it('incorrect body', function() {
			mock_req.setHeader('Content-Type', 'application/json');
			mock_req.body.record_type = undefined; 
			api.resourcesHandler(mock_req, mock_resp);
			expect(mock_resp.status.callCount).toEqual(1);
			expect(mock_resp.status.calls[0].args[0]).toEqual(400);
		});
	});

});