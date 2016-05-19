var proxyquire = require('proxyquire').noCallThru(),
    assert = require('assert'),
    sinon = require('sinon'),
    async = require('async'),
    data = require('../data');

var mocker = function(implementations, callback) {

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

        var api_server = proxyquire('../../APIServer', {
            './config': config,
            './db': implementations.db ? implementations.db : {},
            url: implementations.url ? implementations.url : {},
            winston: implementations.logger ? implementations.logger : {},
            './validation': implementations.validation ? implementations.validation : {},
            './notifier': implementations.notifier ? implementations.notifier : {},
            'crypto': implementations.crypto ? implementations.crypto : {}
        });

        return callback(api_server, spies);
    });
};

describe('Testing APIServer', function() {

    describe('Function "getUnits"', function() {

        it('should return 200 when the response contains the accounting units supported', function(done) {

            var modules = ['cal', 'megabyte'];

            var implementations = {
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

            mocker(implementations, function (api, spies) {

                api.getUnits({}, implementations.res);

                assert(spies.res.status.calledWith(200));
                assert(spies.res.json.calledWith({units: modules}));

                done();
            });
        });
    });

    describe('Function "getApiKeys"', function() {

        var testGetApiKeys = function (error, apiKeysInfo, done) {

            var user = data.DEFAULT_USER;

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
                    send: function () {},
                    json: function (msg) {}
                },
                db: {
                    getApiKeys: function (user, callback) {
                        return callback(error, apiKeysInfo);
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.getApiKeys(implementations.req, implementations.res);

                assert(spies.db.getApiKeys.calledWith(user));

                if (error) {

                    assert(spies.res.status.calledWith(500));
                    assert(spies.res.send.calledOnce);

                } else if (!apiKeysInfo) {

                    assert(spies.res.status.calledWith(404));
                    assert(spies.res.json.calledWith({error: 'No api-keys available for the user ' + user}));

                } else {

                    assert(spies.res.status.calledWith(200));
                    assert(spies.res.json.calledWith(apiKeysInfo));

                }

                done();
            });
        };

        it('should return 500 when db fails getting the API keys', function(done) {
            testGetApiKeys(true, null, done);
        });

        it('should return 404 when there is not API keys for the user specified', function(done) {
            testGetApiKeys(false, null, done);
        });

        it('should return 200 when the response contains the user API keys', function(done) {
            testGetApiKeys(false, {}, done);
        });
    });

    describe('Function "checkUrl"', function() {

        var testCheckUrl = function (body, addTokenErr, checkPathErr, checkResult, done) {

            var token = data.DEFAULT_TOKEN;
            var path = '/path';
            var espias;

            var implementations = {
                req: {
                    setEncoding: function (encoding) {},
                    get: function (header) {
                        return token;
                    },
                    body: body
                },
                res: {
                    status: function (status) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                db: {
                    addToken: function (token, callback) {
                        return callback(addTokenErr);
                    },
                    checkPath: function (path, callback) {
                        return callback(checkPathErr, checkResult);
                    }
                },
                url: {
                    parse: function(url) {
                        return {
                            pathname: path
                        }
                    }
                },
                logger: {
                    error: function (msg) {}
                }
            };

            mocker(implementations, function (api, spies) {

                espias = spies;

                api.checkUrl(implementations.req, implementations.res);
                
                assert(spies.req.setEncoding.calledWith('utf-8'));

                if (!body.url) {

                    assert(spies.res.status.calledWith(422));
                    assert(spies.res.json.calledWith({error: 'Url missing'}));

                } else {

                    if (addTokenErr) {
                        assert(spies.logger.error.calledWith(addTokenErr));
                    }

                    assert(spies.db.checkPath.calledWith(path));

                    if (checkPathErr) {

                        assert(spies.res.status.calledWith(500));
                        assert(spies.res.send.calledOnce);

                    } else if (checkResult) {

                        assert(spies.res.status.calledWith(200));
                        assert(spies.res.send.calledOnce);

                    } else {

                        assert(spies.res.status.calledWith(400));
                        assert(spies.res.json.calledWith({error: 'Incorrect url ' + body.url}));

                    }
                }

                done();
            });

        };

        it('should return 422 when the body is not valid', function(done) {
            testCheckUrl({}, false, false, false, done);
        });

        it('should return 500 when db fails checking the path', function(done) {
            testCheckUrl({url: data.DEFAULT_URLS[0]}, true, true, false, done);
        });

        it('should return 400 when the URL is not valid', function(done) {
            testCheckUrl({url: data.DEFAULT_URLS[0]}, false, false, false, done);
        });

        it('should return 200 when the URL is valid', function(done) {
            testCheckUrl({url: data.DEFAULT_URLS[0]}, false, false, true, done);
        });
    });

    describe('Function "newBuy"', function() {

        var testNewBuy = function (validateErr, newBuyErr, done) {

            var apiKey = data.DEFAULT_API_KEYS[0];
            var body = data.DEFAULT_BUY_INFORMATION;
            var path = data.DEFAULT_PUBLIC_PATHS[0];
            body.productSpecification = {
                url: data.DEFAULT_URLS[0],
                recordType: data.DEFAULT_RECORD_TYPE
            };

            var implementations = {
                req: {
                    setEncoding: function (encoding) {},
                    body: body
                },
                res: {
                    status: function (status) {
                        return this;
                    },
                    json: function (msg) {},
                    send: function () {}
                },
                validation: {
                    validate: function (schema, body, callback) {
                        return callback(validateErr);
                    }
                },
                db: {
                    newBuy: function (buy, callback) {
                        return callback(newBuyErr);
                    }
                },
                url: {
                    parse: function (url) {
                        return {
                            pathname: path
                        };
                    }
                },
                crypto: {
                    createHash: function (type) {
                        return this;
                    },
                    update: function (seed) {},
                    digest: function (type) {
                        return apiKey
                    }
                }
            };

            mocker(implementations, function (api, spies) {

                api.newBuy(implementations.req, implementations.res);

                assert(spies.req.setEncoding.calledWith('utf-8'));

                if (validateErr) {

                    assert(spies.res.status.calledWith(400));
                    assert(spies.res.json.calledWith({error: 'Invalid json. ' + validateErr}));

                } else {
                
                    assert(spies.crypto.createHash.calledWith('sha1'));
                    assert(spies.crypto.update.calledWith(body.productId + body.orderId + body.customer));
                    assert(spies.crypto.digest.calledWith('hex'));

                    if (newBuyErr) {

                        assert(spies.res.status.calledWith(400));
                        assert(spies.res.send.calledOnce);

                    } else {

                        assert(spies.res.status.calledWith(201));
                        assert(spies.res.json.calledWith({'API-KEY': apiKey}));

                    }
                }

                done();
            });
        };

        it('should return 400 when the JSON is not valid', function(done) {
            testNewBuy(true, false, done);
        });

        it('should return 400 when db fails adding the new buy', function(done) {
            testNewBuy(false, true, done);
        });

        it('should return 201 when the new buy is correct', function(done) {
            testNewBuy(false, false, done);
        });
    });

    describe('Function "isJSON"', function() {

        var testCheckIsJSON = function (isJSON, done) {

            var implementations = {
                req: {
                    is: function(type) {
                        return isJSON;
                    }
                },
                res: {
                    status: function(statusCode) {
                        return this;
                    },
                    json: function(msg) {}
                }
            };

            var next = sinon.stub();

            mocker(implementations, function (api, spies) {

                api.checkIsJSON(implementations.req, implementations.res, next);

                if (!isJSON) {

                    assert(spies.res.status.calledWith(415));
                    assert(spies.res.json.calledWith({error: 'Content-Type must be "application/json"'}));

                } else {

                    assert(next.calledOnce);

                }

                done();
            });
        };

        it('should return 415 when the content-type is not "application/json"', function(done) {
            testCheckIsJSON(false, done);
        });

        it('should call the callback without error when the content-type is "application/json"', function(done) {
            testCheckIsJSON(true, done);
        });
    });
});