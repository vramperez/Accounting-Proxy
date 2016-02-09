var request = require('supertest'),
	assert = require('assert'),
	proxyquire = require('proxyquire'),
	redis_mock = require('fakeredis'),
	test_endpoint = require('./test_endpoint'),
	config_tests = require('../config_tests'),
	async = require('async'),
	databases = require('../config_tests').integration.databases,
	fs = require('fs');

var server, db_mock, cb_handler_mock;
var mock_config = {};

var logger_mock = { // Avoid display server information while running the tests
	Logger: function(transports) {
		return {
			log: function(level, msg) {},
			info: function(msg) {},
			warn: function(msg) {},
			error: function(msg) {}
		} 
	}
}

var loadServices = function(services, callback) {
	if (services.length != 0) {
		async.each(services, function(service, task_callback) {
			db_mock.newService(service.path, service.url, service.port, function(err) {
				if (err) {
					task_callback(err);
				} else {
					task_callback(null);
				}
			});
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
		})
	} else {	
		return callback();
	}
}

var loadResources = function(resources, callback) {
	if (resources.length != 0) {
		async.each(resources, function(resource, task_callback) {
			db_mock.addResource(resource, function(err) {
				if (err) {
					task_callback(err);
				} else {
					task_callback();
				}
			})
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
		})
	} else {	
		return callback();
	}
}

var loadAccountingInfo = function(accountingInfo, callback) {
	if (accountingInfo.length != 0) {
		async.each(accountingInfo, function(accounting, task_callback) {
			db_mock.addInfo(accounting.api_key, accounting.info, function(err) {
				if (err) {
					task_callback(err);
				} else {
					task_callback();
				}
			})
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
		})
	} else {	
		return callback();
	}
}

var loadSubscriptions = function(subscriptions, callback) {
	if (subscriptions.length != 0) {
		async.each(subscriptions, function(subs, task_callback) {
			db_mock.addCBSubscription(subs.api_key, subs.publicPath, subs.id, subs.host, 
				subs.port, subs.path, subs.unit, function(err) {
				if (err) {
					task_callback(err);
				} else {
					task_callback();
				}
			})
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
		})
	} else {	
		return callback();
	}
}

var prepareDatabase = function(services, resources, accounting, subscriptions, callback) {
	loadServices(services, function(err) {
		if (err) {
			return callback(err);
		} else {
			loadResources(resources, function(err) {
				if (err) {
					return callback(err)
				} else {
					loadAccountingInfo(accounting, function(err) {
						if (err) {
							return callback(err);
						} else {
							loadSubscriptions(subscriptions, function(err) {
								if (err) {
									return callback(err);
								} else {
									return callback(null);
								}
							});
						}
					});
				}
			})
		}
	});
}

var api_mock = {
	run: function(){}
}
var notifier_mock = {
	notify: function(info) {}
}

var prepare_tests = function(database) {
	switch (database) {
		case 'sql':
			mock_config = {
				database: './db',
				database_name: 'testDB_accounting.sqlite',
				resources: {
					contextBroker: true
				}
			}
			db_mock = proxyquire('../../db', {
				'./config': mock_config
			});
			cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
				'../config': mock_config,
				'./db': db_mock
			});
			server = proxyquire('../../server', {
				'./config': mock_config,
				'./db': db_mock,
				'./APIServer': api_mock,
				'./notifier': notifier_mock,
				'./orion_context_broker/cb_handler': cb_handler_mock,
				'winston': logger_mock
			});

			db_mock.init();
			break;
		case 'redis':
			mock_config = {
				database: './db_Redis',
				resources: {
					contextBroker: true
				}
			}
			db_mock = proxyquire('../../db_Redis', {
				'redis': require('fakeredis'),
				'./config': mock_config
			});
			cb_handler_mock = proxyquire('../../orion_context_broker/cb_handler', {
				'../config': mock_config,
				'./db_Redis': db_mock
			});
			server = proxyquire('../../server', {
				'./config': mock_config,
				'./db_Redis': db_mock,
				'./APIServer': api_mock,
				'./notifier': notifier_mock,
				'./orion_context_broker/cb_handler': cb_handler_mock,
				'winston': logger_mock
			});
			break;
	}
}

console.log('[LOG]: starting an endpoint for testing...');
test_endpoint.run();

describe('Testing the accounting API', function() { 

	describe('orion Context-Broker requests', function() {

		async.each(databases, function(database, task_callback) {  

			describe('with database ' + database, function() { 

				beforeEach(function() {
					prepare_tests(database);
				});

				afterEach(function() {
					// Remove the database for testing
					fs.access('./testDB_accounting.sqlite', fs.F_OK, function(err) {
						if (!err) {
							fs.unlinkSync('./testDB_accounting.sqlite');
						}
					});
				});

				it('correct entity creation', function(done) {
					var services = [{
						path: '/v1/updateContext',
						url: 'http://localhost/v1/updateContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/updateContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/updateContext': {
									url: 'http://localhost/v1/updateContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    contextElements: [
					        {
					            type: "Room",
					            isPattern: "false",
					            id: "Room1",
					            attributes: [
					                {
					                    name: "temperature",
					                    type: "float",
					                    value: "23"
					                },
					                {
					                    name: "pressure",
					                    type: "integer",
					                    value: "720"
					                }
					            ]
					        }
					    ],
					    updateAction: "APPEND"
					} 
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/updateContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {
									    "contextResponses": [
									        {
									            "contextElement": {
									                "attributes": [
									                    {
									                        "name": "temperature",
									                        "type": "float",
									                        "value": ""
									                    },
									                    {
									                        "name": "pressure",
									                        "type": "integer",
									                        "value": ""
									                    }
									                ],
									                "id": "Room1",
									                "isPattern": "false",
									                "type": "Room"
									            },
									            "statusCode": {
									                "code": "200",
									                "reasonPhrase": "OK"
									            }
									        }
									    ]
									});
									db_mock.getNotificationInfo('api_key1', '/v1/updateContext', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									});
								});
						}
					});
				});

				it('error entity creation', function(done) {
					var services = [{
						path: '/v1/updateContext',
						url: 'http://localhost/v1/updateContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/updateContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/updateContext': {
									url: 'http://localhost/v1/updateContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    correct: 'wrong'
					} 
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/updateContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {});
									db_mock.getNotificationInfo('api_key1', '/v1/updateContext', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									});
								});
						}
					});
				});

				it('correct query context operation', function(done) {
					var services = [{
						path: '/v1/queryContext',
						url: 'http://localhost/v1/queryContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/queryContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/queryContext': {
									url: 'http://localhost/v1/queryContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    entities: [
				        {
				            type: "Room",
				            isPattern: "false",
				            id: "Room1"
				        }
				    	]
					}
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/queryContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {
									    "contextResponses": [
									        {
									            "contextElement": {
									                "attributes": [
									                    {
									                        "name": "temperature",
									                        "type": "float",
									                        "value": "23"
									                    },
									                    {
									                        "name": "pressure",
									                        "type": "integer",
									                        "value": "720"
									                    }
									                ],
									                "id": "Room1",
									                "isPattern": "false",
									                "type": "Room"
									            },
									            "statusCode": {
									                "code": "200",
									                "reasonPhrase": "OK"
									            }
									        }
									    ]
									});
									db_mock.getNotificationInfo('api_key1', '/v1/queryContext', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									});
								});
						}
					});
				});

				it('error query context operation (entity invalid entity)', function(done) {
					var services = [{
						path: '/v1/queryContext',
						url: 'http://localhost/v1/queryContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/queryContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/queryContext': {
									url: 'http://localhost/v1/queryContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    correct: 'wrong'
					}
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/queryContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, { errorCode: { code: '404', reasonPhrase: 'No context elements found' } });
									db_mock.getNotificationInfo('api_key1', '/v1/queryContext', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									});
								});
						}
					});
				});

				it('update context elements', function(done) {
					var services = [{
						path: '/v1/updateContext',
						url: 'http://localhost/v1/updateContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/updateContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/updateContext': {
									url: 'http://localhost/v1/updateContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    contextElements: [
					        {
					            type: "Room",
					            isPattern: "false",
					            id: "Room1",
					            attributes: [
					                {
					                    name: "temperature",
					                    type: "float",
					                    value: "26.5"
					                },
					                {
					                    name: "pressure",
					                    type: "integer",
					                    value: "763"
					                }
					            ]
					        }
					    ],
					    updateAction: "UPDATE"
					}
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/updateContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {
									    "contextResponses": [
									        {
									            "contextElement": {
									                "attributes": [
									                    {
									                        "name": "temperature",
									                        "type": "float",
									                        "value": ""
									                    },
									                    {
									                        "name": "pressure",
									                        "type": "integer",
									                        "value": ""
									                    }
									                ],
									                "id": "Room1",
									                "isPattern": "false",
									                "type": "Room"
									            },
									            "statusCode": {
									                "code": "200",
									                "reasonPhrase": "OK"
									            }
									        }
									    ]
									});
									db_mock.getNotificationInfo('api_key1', '/v1/updateContext', function(err, info) {
										if (err) {
											console.log('Error checking the accounting');
											process.exit(1);
										} else {
											assert.equal(info['num'], 1);
											done();
										}
									});
								});
						}
					});
				});
				
				it('correct context unsubscription', function(done) {
					var services = [{
						path: '/v1/unsubscribeContext',
						url: 'http://localhost/v1/unsubscribeContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/unsubscribeContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/unsubscribeContext': {
									url: 'http://localhost/v1/unsubscribeContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    "subscriptionId": "51c0ac9ed714fb3b37d7d5a8"
					}
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/unsubscribeContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {
									    "statusCode": {
									        "code": "200",
									        "reasonPhrase": "OK"
									    },
									    "subscriptionId": "51c0ac9ed714fb3b37d7d5a8"
									});
									db_mock.getCBSubscription('51c0ac9ed714fb3b37d7d5a8', function(err, subscription_info) {
										if (err) {
											console.log('Error checking the subscription');
											process.exit(1);
										} else {
											assert.deepEqual(subscription_info, null);
											done();
										}
									});
								});
						}
					});
				});

				it('correct context subscription', function(done) {
					var services = [{
						path: '/v1/subscribeContext',
						url: 'http://localhost/v1/subscribeContext',
						port: 9020
					}];
					var resources = [{
						offering: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0'
						},
						publicPath: '/v1/subscribeContext',
						record_type: 'rec_type',
						unit: 'call',
						component_label: 'callusage'
					}];
					var info = [{
						api_key: 'api_key1',
						info: {
							organization: 'test_org',
							name: 'test_name',
							version: '1.0',
							reference: '000000000000002',
							actorID: '0001',
							accounting: {
								'/v1/subscribeContext': {
									url: 'http://localhost/v1/subscribeContext',
									port: 9020,
									num: 0,
									unit: 'call',
									correlation_number: '0002'
								}
							}
						}
					}];
					var payload = {
					    "entities": [
					        {
					            "type": "Room",
					            "isPattern": "false",
					            "id": "Room1"
					        }
					    ],
					    "attributes": [
					        "temperature"
					    ],
					    "reference": "http://localhost:1028/accumulate",
					    "duration": "P1M",
					    "notifyConditions": [
					        {
					            "type": "ONCHANGE",
					            "condValues": [
					                "pressure"
					            ]
					        }
					    ],
					    "throttling": "PT5S"
					}
					prepareDatabase(services, resources, info, [], function(err) {
						if (err) {
							console.log('Error preparing the database');
							process.exit(1);
						} else {
							request(server.app)
								.post('/v1/subscribeContext')
								.set('content-type', 'appliaction/json')
								.set('X-Actor-ID', '0001')
								.set('X-API-KEY', 'api_key1')
								.type('json')
								.send(JSON.stringify(payload))
								.expect(200)
								.end(function(err, res) {
									assert.deepEqual(res.body, {
									    "subscribeResponse": {
									        "duration": "P1M",
									        "subscriptionId": "51c0ac9ed714fb3b37d7d5a8"
									    }
									});
									done();
									/*db_mock.getCBSubscription('51c0ac9ed714fb3b37d7d5a8', function(err, subscription_info) {
										if (err) {
											console.log('Error checking the subscription');
											process.exit(1);
										} else {
											assert.deepEqual(subscription_info, 
											{
												API_KEY: 'api_key1',
												publicPath: '/v1/subscribeContext',
												ref_host: 'localhost:1028',
												ref_port: '1028',
												ref_path: '/accumulate',
												unit: 'call' 
											});
											done();
										}
									});*/
								});
						}
					});
				});
			});
		});
	});
});