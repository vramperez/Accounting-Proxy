var proxyquire = require('proxyquire'),
	assert = require('assert');

describe('Testing SQLITE database,', function() {

	describe('newService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('deleteService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback('Error');
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						run: function(query, params, callback){
							return callback(null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.newService('', '', '',function(err) {
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getService', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getService('',function(err, service) {
				assert.equal(err, 'Error');
				assert.equal(service, null);
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, [{port: '', url: ''}]);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getService('',function(err, service) {
				assert.equal(err, null);
				assert.deepEqual(service, {port: '', url: ''});
				done();
			});
		});
	});

	describe('getInfo', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback('Error', null);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, 'Error');
				assert.equal(info, null);
				done();
			});
		});

		it('no results', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, []);
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, {});
				done();
			});
		});

		it('correct', function(done) {
			var sqlite_stub = {
				verbose: function(){
					return this;
				},
				Database: function(name){
					return {
						all: function(query, params, callback){
							return callback(null, {info: 'info'});
						}
					};
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			db.getInfo('',function(err, info) {
				assert.equal(err, null);
				assert.deepEqual(info, {info: 'info'});
				done();
			});
		});
	});
	
	describe('addResource', function() {

		it('error', function(done) {
			var sqlite_stub = {
				verbose: function() {
					return this;
				},
				Database: function(name) {
					return {
						serialize: function(callback) {
							return callback();
						},
						run: function(query, params, callback) {
							return callback('Error');
						}
					}
				}
			}
			var db = proxyquire('../../db', {'sqlite3': sqlite_stub});
			var data = 
			{
				publicPath: '',
				offering: 
				{
					organization: '',
					name: '',
					version: ''
				},
				record_type: '',
				unit: '',
				component_label: ''
			};
			db.addResource(,function(err) {
				assert.equal(err, 'Error');
				done();
			});
		});
	});
});