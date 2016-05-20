var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon'),
    data = require('../data');

var mocker = function (implementations, callback) {

    var defaultPassport = {
        OAuth2Strategy: function (options, callback) {
            return callback('', '', {}, function (){});
        }
    };

    var spies = {};

    // Create spies for the mock functions
    async.forEachOf(implementations, function (value, key, task_callback1) {

        spies[key] = {};

        async.forEachOf(value, function (functionImpl, functionName, task_callback2) {

            if (typeof implementations[key][functionName] == 'function') {
                spies[key][functionName] = sinon.spy(implementations[key], functionName);
            }

            task_callback2();

        }, task_callback1);
    }, function () { 

        var config = implementations.config ? implementations.config : {};
        config.database = {
            type: './db'
        };

        var authentication = proxyquire('../../OAuth2_authentication', {
            './config': config,
            winston: implementations.logger ? implementations.logger : {},
            './db': implementations.db ? implementations.db : {},
            'passport-fiware-oauth': implementations.passport ? implementations.passport : defaultPassport 
        });

        return callback(authentication, spies);
    });
};

describe('Testing "OAuth2_authentication"', function () {

    describe('Function "headerAuthentication"', function () {

        var tokenType = 'Bearer';
        var token = 'token';
        var userProfile = {
            appId: 'appId',
            id: 'user',
            emails: [{value: 'user@gmail.com'}],
            displayName: 'userName',
            roles: [{id: 'admin'}]
        };
        var path = '/request/path';

        var testGetAuthToken = function (headers, tokenType, done) {

            var implementations = {
                req: {
                    headers: headers
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                },
                logger: {
                    warn: function (msg) {}
                }
            };

            mocker(implementations, function (auth, spies) {

                auth.headerAuthentication(implementations.req, implementations.res, function () {});

                if (!tokenType) {

                    assert(spies.res.status.calledWith(401));
                    assert(spies.res.json.calledWith({error: 'Auth-token not found in request headers'}));

                } else if (tokenType !== 'bearer') {

                    assert(spies.logger.warn.calledWith('Invalid Auth-Token type (' + tokenType.toLowerCase() + ')'));
                    assert(spies.res.status.calledWith(401));
                    assert(spies.res.json.calledWith({error: 'Invalid Auth-Token type (' + tokenType.toLowerCase() + ')'}));

                }

                done();       
            });
        };

        it('error, no authorization header (should throw an exception)', function (done) {
            testGetAuthToken({}, undefined, done);
        });

        it('error, invalid Auth-Token type', function (done) {
            var tokenType = 'wrongType';

            var headers = {
                'authorization': tokenType + ' ' + data.DEFAULT_TOKEN
            };

           testGetAuthToken(headers, tokenType, done);
        });

        it('error, creating the user profile', function (done) {

            var token = data.DEFAULT_TOKEN;

            var aux = {
                userProfile: function (token, callback) {
                    return callback('Error', null);
                }
            };

            var implementations = {
                req: {
                    headers: {
                        'authorization':  'bearer ' + token
                    }
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return aux;
                    },
                    userProfile: aux.userProfile
                },
                logger: {
                    warn: function (msg) {}
                }
            };

            var userProfileSpy = sinon.spy(aux, 'userProfile');

            mocker(implementations, function (auth, spies) {

                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                
                assert(userProfileSpy.calledWith(token));
                assert(spies.res.status.calledWith(401));
                assert(spies.res.json.calledWith({error: 'Invalid Auth-Token'}));
                assert(spies.logger.warn.calledWith('Token ' + token + ' invalid'))

                done();
            });
        });

        var validRequestAssertions = function (req) {

            assert.deepEqual(req.headers, {
                'x-auth-token': data.DEFAULT_TOKEN,
                Authorization: 'Bearer ' + data.DEFAULT_TOKEN,
                'X-Nick-Name': data.DEFAULT_USER_ID,
                'X-Email': data.DEFAULT_USER_PROFILE.emails[0].value,
                'X-Display-Name': data.DEFAULT_USER_PROFILE.displayName,
                'X-Roles': data.DEFAULT_ROLES.customer + ','
            });

            var userInfoExpected = data.DEFAULT_USER_PROFILE;
            userInfoExpected.accessToken = data.DEFAULT_TOKEN;

            assert.deepEqual(req.user, userInfoExpected);
        };

        var errorGettingAppIdAssertions = function (spies, error) {

            assert(spies.res.status.calledWith(500));
            assert(spies.res.send.calledOnce);
            assert(spies.logger.error.calledWith(error));
        };

        var testVerifyAppId = function (getAppIdErr1, getAppIdErr2, appId1, appId2, reqPath, done) {

            var token = data.DEFAULT_TOKEN;
            var getAppIdCall = 0;

            var aux = {
                userProfile: function (token, callback) {
                    return callback(null, data.DEFAULT_USER_PROFILE);
                }
            };

            var implementations = {
                req: {
                    headers: {
                        'x-auth-token':  token
                    },
                    path: reqPath
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return aux;
                    },
                    userProfile: aux.userProfile
                },
                logger: {
                    error: function (msg) {},
                    warn: function (msg) {}
                },
                db: {
                    getAppId: function (path, callback) {

                        getAppIdCall += 1;

                        if (getAppIdCall == 1) {
                            return callback(getAppIdErr1, appId1);
                        } else {
                            return callback(getAppIdErr2, appId2);
                        }
                    }
                },
                config: {
                    api: {
                        administration_paths: {
                            keys: data.DEFAULT_ADMINISTRATION_PATHS.keys
                        }
                    },
                    oauth2: {
                        roles: data.DEFAULT_ROLES
                    }
                }
            };

            var userProfileSpy = sinon.spy(aux, 'userProfile');
            var next = sinon.stub();

            mocker(implementations, function (auth, spies) {

                auth.headerAuthentication(implementations.req, implementations.res, next);

                assert(userProfileSpy.calledWith(token));

                if (reqPath === data.DEFAULT_ADMINISTRATION_PATHS.keys) {

                    assert(next.calledOnce);
                    validRequestAssertions(implementations.req);

                } else {

                    assert(spies.db.getAppId.calledWith(reqPath));

                    if (getAppIdErr1) {

                        errorGettingAppIdAssertions(spies, getAppIdErr1);

                    } else {

                        if (appId1 === data.DEFAULT_APP_IDS[0]) {

                            validRequestAssertions(implementations.req);
                            assert(next.calledOnce);

                        } else {

                            assert(spies.db.getAppId.calledWith('/' + reqPath.split('/')[1]));

                            if (appId2 === data.DEFAULT_APP_IDS[0]) {

                                validRequestAssertions(implementations.req);
                                assert(next.calledOnce);

                            } else  if (getAppIdErr2) {

                                errorGettingAppIdAssertions(spies, getAppIdErr2);

                            } else if (appId1 !== data.DEFAULT_APP_IDS[0] && appId2 !== data.DEFAULT_APP_IDS[0]) {

                                assert(spies.res.status.calledWith(401));
                                assert(spies.res.json.calledWith({error: 'The auth-token scope is not valid for the current application'}));
                                assert(spies.logger.warn.calledWith('Token ' + token + ' is from a different app'));

                            }
                        }
                    }
                }

                done();
            });
        }

        it('error verifying the appId (short publicPath)', function (done) {
            testVerifyAppId(true, false, null, null, data.DEFAULT_REQ_PATH, done);
        });

        it('error verifying the appId (whole publicPath)', function (done) {
           testVerifyAppId(false, true, null, null, data.DEFAULT_REQ_PATH, done);
        });

        it('authToken from a different app', function (done) {
           testVerifyAppId(false, false, 'wrong', 'wrong', data.DEFAULT_REQ_PATH, done); 
        });

        it('should permit requests for retreive  API Keys', function (done) {
            testVerifyAppId(false, false, data.DEFAULT_APP_IDS[0], null, data.DEFAULT_ADMINISTRATION_PATHS.keys, done);
        });

        it('correct authentication (short path)', function (done) {
            testVerifyAppId(false, false, data.DEFAULT_APP_IDS[0], null, data.DEFAULT_REQ_PATH, done);
        });

        it('correct authentication (whole path)', function (done) {
            testVerifyAppId(false, false, 'wrong', data.DEFAULT_APP_IDS[0], data.DEFAULT_REQ_PATH, done);
        });
    });
});