var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async');

var mocker = function(implementations, callback) {
    var api_server;

    var mocks = {
        app: {
            set: function(prop, value) {},
            use: function(middleware) {} ,
            post: function(path, middleware, handler) {} ,
            get: function(path, handler) {}
        },
        db: {},
        req: {},
        res: {},
        config: {},
        validation: {},
        url: {},
        logger: {
                error: function(msg) {}
        },
        notifier: {}
    };
    var spies = {
        app: {},
        db: {},
        req: {},
        res: {},
        url: {},
        validation: {},
        logger: {
            error: sinon.spy(mocks.logger, 'error')
        },
        notifier: {}
    };
    // Complete app mock implementation and add spies.
    async.each(Object.keys(implementations), function(obj, task_callback1) {
        async.each(Object.keys(implementations[obj]), function(implem, task_callback2) {
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
        }, function() {
            return task_callback1();
        });
    }, function() {
        if (implementations.config == undefined) {
            mocks.config = {
                accounting_proxy: {
                    admin_port: 9001
                }
            };
        } else if (implementations.config.accounting_proxy == undefined) {
            mocks.config.accounting_proxy = {
                admin_port: 9001
            };
        }
        mocks.config.database = {
            type:'./db'
        };
        api_server = proxyquire('../../APIServer', {
            './config': mocks.config,
            './db': mocks.db,
            url: mocks.url,
            winston: mocks.logger,
            './validation': mocks.validation,
            './notifier': mocks.notifier
        });
        return callback(api_server, spies);
    });
};

describe('Testing APIServer', function() {

    describe('Function "getUnits"', function() {

        it('should return 200 when the response contains the accounting units supported', function() {
            var modules = ['cal', 'megabyte'];
            var implementations = {
                app: {
                    get: function(path, callback) {
                        if('/api/units' === path) {
                            return callback(implementations.req, implementations.res);
                        }
                    }
                },
                req: {},
                res: {
                    status: function(code) {
                        return this;
                    },
                    json: function(body) {}
                },
                config: {
                    modules: {
                        accounting: modules
                    }
                }
            };
            mocker(implementations, function(api, spies) {
                api.getUnits(implementations.req, implementations.res);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 200);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {units: modules});
            });
        });
    });

    describe('Function "getApiKeys"', function() {

        it('should return 500 when db fails getting the API keys', function(done) {
            var user = '0001';
            var implementations = {
                req: {
                    user: {
                        id: user
                    }
                },
                res: {
                    status: function(code) {
                        return this;
                    },
                    send: function() {}
                },
                db: {
                    getApiKeys: function(user, callback) {
                        return callback('Error', null)
                    }
                }

            }
            mocker(implementations, function(api, spies) {
                api.getApiKeys(implementations.req, implementations.res);
                assert.equal(spies.db.getApiKeys.callCount, 1);
                assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('should return 404 when there is not API keys for the user specified', function(done) {
            var user = '0001';
            var implementations = {
                req: {
                    user: {
                        id: user
                    }
                },
                res: {
                    status: function(code) {
                        return this;
                    },
                    json: function(msg) {}
                },
                db: {
                    getApiKeys: function(user, callback) {
                        return callback(null, null)
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.getApiKeys(implementations.req, implementations.res);
                assert.equal(spies.db.getApiKeys.callCount, 1);
                assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 404);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'No api-keys available for the user ' + user});
                done();
            });
        });

        it('should return 200 when the response contains the user API keys', function(done) {
            var user = '0001';
            var apiKeys = ['apiKey1', 'apiKey1'];
            var implementations = {
                req: {
                    user: {
                        id: user
                    }
                },
                res: {
                    status: function(code) {
                        return this;
                    },
                    json: function(body) {}
                },
                db: {
                    getApiKeys: function(user, callback) {
                        return callback(null, apiKeys);
                    }
                }

            }
            mocker(implementations, function(api, spies) {
                api.getApiKeys(implementations.req, implementations.res);
                assert.equal(spies.db.getApiKeys.callCount, 1);
                assert.equal(spies.db.getApiKeys.getCall(0).args[0], user);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 200);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], apiKeys);
                done();
            });
        });
    });

    describe('Function "checkUrl"', function() {

        it('should return 422 when the body is not valid', function(done) {
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    body: {}
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    json: function(json) {}
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkUrl(implementations.req, implementations.res);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0] , 422);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Url missing'});
                done();
            });
        });

        it('should return 500 when db fails checking the path', function(done) {
            var token = 'token';
            var path = '/path';
            var url = 'http://example.com' + path;
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    get: function(header) {
                        return token;
                    },
                    body: {
                        url: url
                    }
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    send: function() {}
                },
                db: {
                    addToken: function(token, callback) {
                        return callback('Error');
                    },
                    checkPath: function(path, callback) {
                        return callback('Error', false);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        }
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkUrl(implementations.req, implementations.res);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 500);
                assert.equal(spies.res.send.callCount, 1);
                assert.equal(spies.req.get.callCount, 2);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
                assert.equal(spies.db.addToken.callCount, 1);
                assert.equal(spies.db.addToken.getCall(0).args[0], token);
                assert.equal(spies.url.parse.callCount, 1);
                assert.equal(spies.url.parse.getCall(0).args[0], url);
                assert.equal(spies.db.checkPath.callCount, 1);
                assert.equal(spies.db.checkPath.getCall(0).args[0], path);
                done();
            });
        });

        it('should return 400 when the URL is not valid', function(done) {
            var token = 'token';
            var path = '/path';
            var url = 'http://example.com' + path;
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    get: function(header) {
                        return token;
                    },
                    body: {
                        url: url
                    }
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    json: function(msg) {}
                },
                db: {
                    addToken: function(token, callback) {
                        return callback(null);
                    },
                    checkPath: function(path, callback) {
                        return callback(null, false);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        }
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkUrl(implementations.req, implementations.res);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 400);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Incorrect url ' + url});
                assert.equal(spies.req.get.callCount, 2);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
                assert.equal(spies.db.addToken.callCount, 1);
                assert.equal(spies.db.addToken.getCall(0).args[0], token);
                assert.equal(spies.url.parse.callCount, 1);
                assert.equal(spies.url.parse.getCall(0).args[0], url);
                assert.equal(spies.db.checkPath.callCount, 1);
                assert.equal(spies.db.checkPath.getCall(0).args[0], path);
                done();
            });
        });

        it('should return 200 when the URL is valid', function(done) {
            var token = 'token';
            var path = '/path';
            var url = 'http://example.com' + path;
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    get: function(header) {
                        return token;
                    },
                    body: {
                        url: url
                    }
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    send: function() {}
                },
                db: {
                    addToken: function(token, callback) {
                        return callback('Error');
                    },
                    checkPath: function(url, callback) {
                        return callback(null, true);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        }
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkUrl(implementations.req, implementations.res);
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 200);
                assert.equal(spies.res.send.callCount, 1);
                assert.equal(spies.req.get.callCount, 2);
                assert.equal(spies.req.get.getCall(0).args[0], 'X-API-KEY');
                assert.equal(spies.req.get.getCall(1).args[0], 'X-API-KEY');
                assert.equal(spies.db.addToken.callCount, 1);
                assert.equal(spies.db.addToken.getCall(0).args[0], token);
                assert.equal(spies.url.parse.callCount, 1);
                assert.equal(spies.url.parse.getCall(0).args[0], url);
                assert.equal(spies.db.checkPath.callCount, 1);
                assert.equal(spies.db.checkPath.getCall(0).args[0], path);
                done();
            });
        });
    });

    describe('Function "newBuy"', function() {

        it('should return 400 when the JSON is not valid', function(done) {
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    body: {}
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    json: function(json) {}
                },
                validation: {
                    validate: function(schema, body, callback) {
                        return callback('Error');
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.newBuy(implementations.req, implementations.res);
                assert.equal(spies.validation.validate.callCount, 1);
                assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
                assert.deepEqual(spies.validation.validate.getCall(0).args[1] , {});
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0] , 400);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0] , {error: 'Invalid json. Error'});
                done();
            });
        });

        it('should return 400 when db fails adding the new buy', function(done) {
            var path = '/path';
            var body = {
                orderID: 'orderId',
                productId: 'productId',
                customer: '0001',
                productSpecification: {
                    unit: 'call',
                    recordType: 'callusage',
                    url: 'http://example.com' + path
                }
            }
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    body: body
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    send: function() {}
                },
                validation: {
                    validate: function(schema, body, callback) {
                        return callback(null);
                    }
                },
                db: {
                    newBuy: function(buy, callback) {
                        return callback('Error');
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        };
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.newBuy(implementations.req, implementations.res);
                assert.equal(spies.validation.validate.callCount, 1);
                assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
                assert.deepEqual(spies.validation.validate.getCall(0).args[1] , body);
                assert.equal(spies.db.newBuy.callCount, 1);
                assert.deepEqual(spies.db.newBuy.getCall(0).args[0], {
                    apiKey: 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb',
                    publicPath: path,
                    orderId: body.orderId,
                    productId: body.productId,
                    customer: body.customer,
                    unit: body.productSpecification.unit,
                    recordType: body.productSpecification.recordType
                });
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0] , 400);
                assert.equal(spies.res.send.callCount, 1);
                done();
            });
        });

        it('should return 201 when the new buy is correct', function(done) {
            var path = '/path';
            var body = {
                orderID: 'orderId',
                productId: 'productId',
                customer: '0001',
                productSpecification: {
                    unit: 'call',
                    recordType: 'callusage',
                    url: 'http://example.com' + path
                }
            }
            var implementations = {
                req: {
                    setEncoding: function(encoding) {},
                    body: body
                },
                res: {
                    status: function(status) {
                        return this;
                    },
                    json: function(msg) {}
                },
                validation: {
                    validate: function(schema, body, callback) {
                        return callback(null);
                    }
                },
                db: {
                    newBuy: function(buy, callback) {
                        return callback(null);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        };
                    }
                }
            }
            mocker(implementations, function(api, spies) {
                api.newBuy(implementations.req, implementations.res);
                assert.equal(spies.validation.validate.callCount, 1);
                assert.equal(spies.validation.validate.getCall(0).args[0] , 'product');
                assert.deepEqual(spies.validation.validate.getCall(0).args[1] , body);
                assert.equal(spies.db.newBuy.callCount, 1);
                assert.deepEqual(spies.db.newBuy.getCall(0).args[0], {
                    apiKey: 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb',
                    publicPath: path,
                    orderId: body.orderId,
                    productId: body.productId,
                    customer: body.customer,
                    unit: body.productSpecification.unit,
                    recordType: body.productSpecification.recordType
                });
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0] , 201);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {'API-KEY': 'c0fa755dca58ad3cd33970c16a61f95d6cb40edb'});
                done();
            });
        });
    });

    describe('Function "isJSON"', function() {

        it('should return 415 when the content-type is not "application/json"', function(done) {
            var implementations = {
                req: {
                    is: function(type) {
                        return false;
                    }
                },
                res: {
                    status: function(statusCode) {
                        return this;
                    },
                    json: function(msg) {}
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkIsJSON(implementations.req, implementations.res);
                assert.equal(spies.req.is.callCount, 1);
                assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                assert.equal(spies.res.status.callCount, 1);
                assert.equal(spies.res.status.getCall(0).args[0], 415);
                assert.equal(spies.res.json.callCount, 1);
                assert.deepEqual(spies.res.json.getCall(0).args[0], {error: 'Content-Type must be "application/json"'});
                done();
            });
        });

        it('should call the callback without error when the content-type is "application/json"', function(done) {
            var implementations = {
                req: {
                    is: function(type) {
                        return true;
                    }
                },
                res: {
                    status: function(statusCode) {
                        return this;
                    },
                    json: function(msg) {}
                }
            }
            mocker(implementations, function(api, spies) {
                api.checkIsJSON(implementations.req, implementations.res, function() {
                    assert.equal(spies.req.is.callCount, 1);
                    assert.equal(spies.req.is.getCall(0).args[0], 'application/json');
                    assert.equal(spies.res.status.callCount, 0);
                    assert.equal(spies.res.json.callCount, 0);
                    done();
                });
            });
        });
    });
});