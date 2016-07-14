var proxyquire = require('proxyquire'),
	assert = require('assert'),
	sinon = require('sinon'),
	data = require('../data');

describe('Testing util', function () {

	describe('Function administrationPath', function () {

		var testAdministrationPath = function (path, isAdminPath, done) {

			var configMock = {
				api: {
					administration_paths: data.DEFAULT_ADMINISTRATION_PATHS
				}
			};

			var util = proxyquire('../../util', {
				'./config': configMock
			});

			util.administrationPath(path, function (res) {
				assert.equal(res, isAdminPath);
				done();
			});
		};


		it('should return call the callback with true when the path passed is an administration path', function (done) {
			testAdministrationPath('/accounting_proxy/units', true, done);
		});

		it('should return call the callback with false when the path passed is not an administration path', function (done) {
			testAdministrationPath('/noAdminPath', false, done);
		});
	});

	describe('Function getBody', function () {

		it('should read the data stream and stores in the request object', function (done) {

			var reqMock = {
				on: function (eventType, callback) {
					if (eventType === 'data') {
						return callback('chunk');
					} else {
						return callback();
					}
				}
			};

			var onSpy = sinon.spy(reqMock, 'on');

			var util = require('../../util');

			util.getBody(reqMock, {}, function () {
				assert(onSpy.calledWith('data'));
				assert(onSpy.calledWith('end'));
				assert.equal(reqMock.body, 'chunk');
				done();
			});
		});

	});

	describe('Function validCert', function () {

		var testValidateCert = function (enableHttps, authorized, done) {

			var configMock = {
				accounting_proxy: {
					https: enableHttps ? {enabled: true} : {}
				}
			};

			var req = {
				client: {
					authorized: authorized,
					authorizationError: 'authorization error'
				}
			};

			var res = {
				status: function (statusCode) {
					return this;
				},
				json: function (json) {}
			};

			var statusSpy = sinon.spy(res, 'status');
			var jsonSpy = sinon.spy(res, 'json');
			var next = sinon.stub();

			var util = proxyquire('../../util', {
				'./config': configMock
			});

			util.validateCert(req, res, next);

			if (enableHttps && !authorized) {
				assert(statusSpy.calledWith(401));
				assert(jsonSpy.calledWith({error: 'Unauthorized: Client certificate required ' + req.client.authorizationError}));
			} else {
				assert(next.calledOnce);
			}

			done();
		};

		it('should call the callback when the https is disabled', function (done) {
			testValidateCert(false, true, done);
		});

		it('should return 401 when the request cert is not valid and https is enabled', function (done) {
			testValidateCert(true, false, done);
		});
	});
});