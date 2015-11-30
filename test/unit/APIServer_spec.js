var rewire = require('rewire'),
	api = rewire('../../APIServer');

var request = {

}
var response = {
	status: function(status){}
}

describe("Testing APIServer", function() {

	describe("method run", function() {

		it('no resources available', function() {
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
							version: '1'
						},
						'/public2': {
							publicPath: '/public2',
							organization: 'org2',
							name: 'name2',
							version: '2'
						}
					}
					callback(data)
				}
			}
			spyOn(db_mock, "loadResources").andCallThrough();
			spyOn(db_mock, "loadUnits").andCallThrough();
			var map = {};
			api.__set__("db", db_mock);
			api.run(map);
			expect(db_mock.loadResources.callCount).toEqual(1);
			expect(db_mock.loadUnits.callCount).toEqual(1);
		});
	});
});