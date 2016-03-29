var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    async = require('async'),
    sinon = require('sinon');

var mocker = function (implementations, callback) {
    var mocks = {
        passport: {
            OAuth2Strategy: function (options, callback) {
                return callback('', '', {}, function (){});
            }
        },
        config: {},
        db: {},
        req: {},
        res: {},
        logger: {
            warn: function (msg) {},
            error: function (msg) {}
        }
    };

    var spies = {
        passport: {},
        db: {},
        req: {},
        res: {},
        logger: {
            warn: sinon.spy(mocks.logger, 'warn'),
            error: sinon.spy(mocks.logger, 'error')
        }
    };

    mocks.config.database = {
        type: './db'
    };

    async.each(Object.keys(implementations), function (obj, task_callback1) {
        async.each(Object.keys(implementations[obj]), function (implem, task_callback2) {
            mocks[obj][implem.toString()] = implementations[obj][implem.toString()];
            if ( typeof implementations[obj][implem] == 'function' && implementations[obj][implem] != undefined) {
                if (obj == 'req' || obj == 'res') {
                    spies[obj][implem.toString()] = sinon.spy(implementations[obj], implem.toString());
                } else {
                    spies[obj][implem.toString()] = sinon.spy(mocks[obj], implem.toString());
                }
                task_callback2();
            } else {
                task_callback2();
            }
        }, function () {
            return task_callback1();
        });
    }, function () {
        var authentication = proxyquire('../../OAuth2_authentication', {
            './config': mocks.config,
            winston: mocks.logger,
            './db': mocks.db,
            'passport-fiware-oauth': mocks.passport
        });
        return callback(authentication, spies);
    });
};

describe('Testing "OAuth2_authentication"', function () {

    describe('Function "getAuthToken"', function () {
        var tokenType = 'bearer';
        var token = 'token';
        var userProfile = {
            appId: 'appId',
            id: 'user',
            emails: [{value: 'user@gmail.com'}],
            displayName: 'userName',
            roles: [{id: 'admin'}]
        };
        var path = '/request/path';

        it('error, no authorization header (should throw an exception)', function (done) {
            var implementations = {
                req: {
                    headers: {}
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Auth-token not found in request headers'});
                done();
            });
        });

        it('error, invalid Auth-Token type', function (done) {
            var implementations = {
                req: {
                    headers: {
                        authorization:  'wrong' + ' ' + 'token'
                    }
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Invalid Auth-Token type (wrong)'});
                done();
            });
        });

        it('error, creating the user profile', function (done) {
            var implementations = {
                req: {
                    headers: {
                        authorization:  tokenType + ' ' + token
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
                        return {
                            userProfile: function (authToken, callback) {
                                return callback('Error', null);
                            }
                        }
                    }
                },
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Invalid Auth-Token'});
                assert.equal(spies.logger.warn.callCount, 1);
                assert.equal(spies.logger.warn.getCall(0).args[0], 'Token ' + token + ' invalid');
                done();
            });
        });

        it('error verifying the appId (short publicPath)', function (done) {
            var implementations = {
                req: {
                    headers: {
                        'authorization':  tokenType + ' ' + token
                    },
                    path: path
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    send: function () {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return {
                            userProfile: function (authToken, callback) {
                                return callback(null, userProfile);
                            }
                        }
                    }
                },
                db: {
                    getAppId: function (path, callback) {
                        return callback('Error', null);
                    }
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.db.getAppId.callCount, 1);
                assert.equal(spies.db.getAppId.getCall(0).args[0], path);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                assert.equal(spies.logger.error.callCount, 1);
                assert.equal(spies.logger.error.getCall(0).args[0], 'Error in database getting the appId');
                done();
            });
        });

        it('error verifying the appId (whole publicPath)', function (done) {
            var implementations = {
                req: {
                    headers: {
                        'authorization':  tokenType + ' ' + token
                    },
                    path: path
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    send: function () {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return {
                            userProfile: function (authToken, callback) {
                                return callback(null, userProfile);
                            }
                        }
                    }
                },
                db: {
                    getAppId: function (reqPath, callback) {
                        if (reqPath === path) {
                            return callback(null, 'wrongAppId');
                        } else {
                            return callback('Error', null);
                        }
                    }
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.db.getAppId.callCount, 2);
                assert.equal(spies.db.getAppId.getCall(0).args[0], path);
                assert.equal(spies.db.getAppId.getCall(1).args[0], '/' + path.split('/')[1]);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                assert.equal(spies.logger.error.callCount, 1);
                assert.equal(spies.logger.error.getCall(0).args[0], 'Error in database getting the appId');
                done();
            });
        });

        it('authToken from a different app', function (done) {
            var implementations = {
                req: {
                    headers: {
                        'authorization':  tokenType + ' ' + token
                    },
                    path: path
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return {
                            userProfile: function (authToken, callback) {
                                return callback(null, userProfile);
                            }
                        }
                    }
                },
                db: {
                    getAppId: function (reqPath, callback) {
                        if (reqPath === path) {
                            return callback(null, 'wrongAppId');
                        } else {
                            return callback(null, 'wrongAppId');
                        }
                    }
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function (){});
                assert.equal(spies.db.getAppId.callCount, 2);
                assert.equal(spies.db.getAppId.getCall(0).args[0], path);
                assert.equal(spies.db.getAppId.getCall(1).args[0], '/' + path.split('/')[1]);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 401);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'The auth-token scope is not valid for the current application'});
                assert.equal(spies.logger.warn.callCount, 1);
                assert.equal(spies.logger.warn.getCall(0).args[0], 'Token ' + token + ' is from a different app');
                done();
            });
        });

        it('correct authentication (short path)', function (done) {
            var implementations = {
                req: {
                    headers: {
                        'authorization':  tokenType + ' ' + token
                    },
                    path: path
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return {
                            userProfile: function (authToken, callback) {
                                return callback(null, userProfile);
                            }
                        }
                    }
                },
                db: {
                    getAppId: function (reqPath, callback) {
                        return callback(null, userProfile.appId)
                    }
                },
                config: {
                    oauth2: {
                        roles: {
                            admin: 'admin',
                            customer: '',
                            seller: ''
                        }
                    }
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function () {});
                assert.equal(spies.db.getAppId.callCount, 1);
                assert.equal(spies.db.getAppId.getCall(0).args[0], path);
                assert.deepEqual(implementations.req.headers, { authorization: 'bearer token',
                    'Authorization': 'Bearer token',
                    'X-Nick-Name': 'user',
                    'X-Email': 'user@gmail.com',
                    'X-Display-Name': 'userName',
                    'X-Roles': 'admin,'
                });
                done();
            });
        });

        it('correct authentication (whole path)', function (done) {
            var implementations = {
                req: {
                    headers: {
                        'authorization':  tokenType + ' ' + token
                    },
                    path: path
                },
                res: {
                    status: function (code) {
                        return this;
                    },
                    json: function (msg) {}
                },
                passport: {
                    OAuth2Strategy: function (options, callback) {
                        return {
                            userProfile: function (authToken, callback) {
                                return callback(null, userProfile);
                            }
                        }
                    }
                },
                db: {
                    getAppId: function (reqPath, callback) {
                        if (reqPath === path) {
                            return callback(null, 'wrongAppId');
                        } else {
                            return callback(null, userProfile.appId);
                        }
                    }
                },
                config: {
                    oauth2: {
                        roles: {
                            admin: 'admin',
                            customer: '',
                            seller: ''
                        }
                    }
                }
            };
            mocker(implementations, function (auth, spies) {
                auth.headerAuthentication(implementations.req, implementations.res, function () {});
                assert.equal(spies.db.getAppId.callCount, 2);
                assert.equal(spies.db.getAppId.getCall(0).args[0], path);
                assert.equal(spies.db.getAppId.getCall(1).args[0], '/' + path.split('/')[1]);
                assert.deepEqual(implementations.req.headers, { authorization: 'bearer token',
                    'Authorization': 'Bearer token',
                    'X-Nick-Name': 'user',
                    'X-Email': 'user@gmail.com',
                    'X-Display-Name': 'userName',
                    'X-Roles': 'admin,'
                });
                done();
            });
        });
    });
});