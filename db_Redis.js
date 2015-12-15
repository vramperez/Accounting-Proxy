var redis = require('redis'),
	async = require('async');
var db;

db = redis.createClient();

db.on('error', function(err){
	console.log("Error" + err);
});

exports.loadFromDB = function(callback) { 
	var data = {};

	db.smembers('API_KEYS', function(err, api_keys) {
		if (err) {
			return callback(err, null);
		} else {
			var counter = api_keys.length;
			if (api_keys.length !== 0) {
				async.each(api_keys, function(api_key, callback) {
					db.hgetall(api_key, function(err, api_key) {
						if (api_key !== null) {
							loadResourcesAux(api_key, data, function(err) {
								if (err) {
									callback(err, null);
								} else {
									callback(null, data);
								}
							});
						} else {
								callback(null, data);
						}
					});
				});
				// To delete
				/*for (i in api_keys) {
					db.hgetall(api_keys[i], function(err, api_key) {
						if (api_key !== null) {
							loadResourcesAux(api_key, data, function() {
								counter--;
								if (counter === 0) {
									setData(undefined, data);
								}
							});
						} else {
							counter--;
							if (counter === 0) {
								setData(undefined, data);
							}
						}
					});
				}*/
			} else {
				return callback(null, data);
			}
		}
	});
};

loadResourcesAux = function(api_key, data, callback){
	db.smembers('resources', function(err, resources) {
		if (! err) { // mal deberia comprobar el err y sino lanzarlo
			var counter = resources.length;
			for (i in resources) {
				db.hgetall(resources[i], function(err, res) { 
					if (res !== null && api_key.organization === res.org && api_key.name === res.name && api_key.version === res.version) {
						db.hgetall(api_key.actorID + api_key.API_KEY + res.publicPath, function(err, account) {
							db.hgetall(res.publicPath, function(err, serv) {
								if (account !== null && serv !== null) {
									if (counter === resources.length) {
										data[api_key.API_KEY] = {
											actorID: api_key.actorID,
											organization: api_key.organization,
											name: api_key.name,
											version: api_key.version,
											accounting: {},
											reference: api_key.reference
										}
									}

									data[api_key.API_KEY].accounting[res.publicPath]  = {
										url: serv.url,
										port: serv.port,
										num: account.num,
										correlation_number: account.correlation_number,
										unit: res.unit
									}
								}
								counter--;
								if (counter === 0) {
									callback();
								}
							});
						});
					} else {
						counter--;
						if (counter === 0) {
							callback();
						}
					}
				});
			}
		} else {
			callback();
		}
	});
};

// CLI: deleteService [path]
exports.deleteService = function(path, callback) {
	db.del(path, function(err) {
		if (err) {
			return callback(err)
		} else {
			db.srem('public', path, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
			});
		}
	});
};

// CLI: getService [publicPath]
exports.getService = function(publicPath, callback) {
	db.hgetall(publicPath, function(err, obj) {
		if (err) {
			return callback(err, null);
		} else {
			return callback(null, obj);
		}
	});
};

// CLI: addService [publicPath] [url] [port]
exports.newService = function(publicPath, url, port, callback){
	db.exists(publicPath, function(err, res) {
		if (err) {
			return callback(err);
		} else if (res !== 0) {
			callback('[ERROR] The service already exists.');
		} else {
			db.sadd(['public', publicPath], function(err) {
				if (err) {
					return callback(err)
				} else {
					db.hmset(publicPath, {
						'url': url,
						'port': port
					}, function(err) {
						if (err) {
							return callback(err);
						} else {
							return callback(null);
						}
					});
				}
			});
		}
	});
};


exports.addResource = function(data, callback) {
	db.sadd(['resources', data.publicPath + data.offering.organization + data.offering.name + data.offering.version], function(err) {
		if (err) {
			return callback(err)
		} else {
			db.hmset(data.publicPath + data.offering.organization + data.offering.name + data.offering.version, {
				'publicPath': data.publicPath,
				'org': data.offering.organization,
				'name': data.offering.name,
				'version': data.offering.version,
				'record_type': data.record_type,
				'unit': data.unit,
				'component_label': data.component_label
			}, function(err){
				if (err) {
					return callback(err)
				} else {
					return callback(null);
				}
			});
		}
	});
};

exports.loadUnits = function(callback) {
	var toReturn = {};

	db.smembers('resources', function(err, resources) {
		if (err) {
			return callback(err, null);
		} else if (resources.length !== 0) {
			count = 0;
			resources.forEach(function(entry) {
				db.hgetall(entry, function(err, obj) {
					if (err) {
						return callback(err, null);
					} else if (obj != null) {
						toReturn[obj['publicPath']] = {
							publicPath: obj['publicPath'],
							organization: obj['organization'],
							name: obj['name'],
							version: obj['version'],
							unit: obj['unit']
						}
					}
					count++;
					if (count == resources.length) {
						return callback(null, toReturn);
					}
				});
			});
		} else {
			return callback(null, toReturn);
		}
	});
};

exports.loadResources = function(callback) {
	var toReturn = {};

	db.smembers('public', function(err, resources) {
		if (err) {
			return callback(err, null);
		} else if (resources.length !== 0) {
			var count = 0;
			resources.forEach(function(entry) {
				db.hgetall(entry, function(err, res) {
					if (res != null && ! err) {
						toReturn[entry] = {
							url: res.url,
							port: res.port
						}
					}
					count ++;
					if (count == resources.length) {
						return callback(null, toReturn);
					}
				});
			});
		} else {
			return callback(null, toReturn);
		}
	});
};


exports.addInfo = function(API_KEY, data, callback) {
	db.sadd(['API_KEYS', API_KEY], function(err) {
		if (err) {
			return callback(err)
		} else {
			db.hmset(API_KEY, {
				'organization': data.organization,
				'name': data.name,
				'version': data.version,
				'actorID': data.actorID,
				'API_KEY': API_KEY,
				'reference': data.reference
			}, function(err) {
				if (err) {
					return callback(err)
				} else {
					db.sadd([data.actorID, API_KEY], function(err){
						if (err) {
							return callback(err)
						} else {
							var acc,
								count = 0;
							for (var p in data.accounting) {
								acc = data.accounting[p];
								db.hmset(data.actorID + API_KEY + p, {
									'actorID': data.actorID,
									'API_KEY': API_KEY,
									'num': acc.num,
									'publicPath': p,
									'correlation_number': acc.correlation_number
								}, function(err){
									count ++;
									if (err) {
										return callback(err);
									} else if (count == Object.keys(data.accounting).length) {
										return callback(null);
									}
								});
							};
						}
					});
				}
			});
		}
	});
};

exports.getApiKey = function(user, offer, callback) {
	db.smembers(user, function(err, apiKey) {
		if (err) {
			return callback(err, null);
		} else if (apiKey.length !== 0) {
			var count = 0;
			apiKey.forEach(function(entry) {
				db.hgetall(entry, function(err, offerAcc) {
					if (offerAcc['organization'] === offer['organization'] &&
						offerAcc['name'] === offer['name'] &&
						offerAcc['version'] === offer['version']) {
							return callback(null, offerAcc['API_KEY']);
					}
				});
			});
		}
		return callback(null, null);
	});
};


// CLI: getInfo [user]
exports.getInfo = function(user, callback) {
	var toReturn = {};

	db.smembers(user, function(err, acc) {
		if (err) {
			return callback(err, null);
		} else if (acc.length !== 0) {
			var count = 0;
			acc.forEach(function(entry) {
				db.hgetall(entry, function(err, info) {
					toReturn[entry] = {
						API_KEY: entry,
						organization: info['organization'],
						name: info['name'],
						version: info['version']
					}
					count++;
					if (acc.length == count) {
						return callback(null, toReturn);
					}
				});
			});
		} else {
			return callback(null, toReturn);
		}
	});
};

exports.count = function(actorID, API_KEY, publicPath, amount, callback) {
	if (amount < 0 ) {
		return callback('[ERROR] The aomunt must be greater than 0', null)
	} else {
		db.exists(actorID + API_KEY + publicPath, function(err, reply){
			if (err) {
				return callback(err, null)
			} else if (reply === 0) {
				return callback('[ERROR] The specified resource doesn\'t exist', null)
			} else {
				db.hget(actorID + API_KEY + publicPath, 'num', function(err, num) {
					if (err) {
						return callback(err, null);
					} else {
						db.hmset(actorID + API_KEY + publicPath, {
							'num' : (parseFloat(num) + amount).toString()
						}, function(err) {
							if (err) {
								return callback(err, null);
							} else {
								return callback(null, num + amount);
							}
						});
					}
	    		});
			}
		});
	}
};

exports.resetCount = function(actorID, API_KEY, publicPath, callback) {
	db.hget(actorID + API_KEY + publicPath, 'correlation_number', function(err, correlation_number) {
		if (err) {
			return callback(err);
		} else if (correlation_number !== null) {
			correlation_number = parseInt(correlation_number) + 1;
			db.hmset(actorID + API_KEY + publicPath, {
				'correlation_number' : correlation_number,
				'num' : '0'
			}, function(err) {
				if (err) {
					return callback(err);
				} else {
					return callback(null);
				}
			});
		} else  {
			return callback(null);
		}
	});
};

exports.getAccountingInfo = function(publicPath, offer, callback) {
	var toReturn = {};

	db.hgetall(publicPath + offer.organization + offer.name + offer.version, function(err, resource) {
		if (err) {
			return callback(err, null);
		} else if (resource !== null) {
			toReturn = {
				recordType: resource.recordType,
				unit: resource.unit,
				component: resource.component
			}
			return callback(null, toReturn);
		} else {
			return callback(null, null);
		}
	});
};

exports.getOffer = function(API_KEY, callback) {
	db.hgetall(API_KEY, function(err, offer) {
		if (err) {
			return callback(err, null);
		} else if (offer === null) {
			return callback(null, null);
		} else {
			return callback(null, offer);
		}
	});
};

exports.getReference = function(API_KEY, callback) {
	db.hgetall(API_KEY, function(err, offer) {
		if (err) {
			return callback(err, null);
		} else if (offer === null) {
			return callback(null, null);
		} else {
			return callback(null, offer.reference);
		}
	});
};

exports.addCBSubscription = function( API_KEY, publicPath, subscriptionID, ref_host, ref_port, ref_path, unit, callback) {
	db.hmset(subscriptionID, {
		'API_KEY': API_KEY,
		'publicPath': publicPath,
		'ref_host': ref_host,
		'ref_port': ref_port,
		'ref_path': ref_path,
		'unit': unit
	}, function(err) {
		if(err){
			return callback(err);
		} else {
			return callback(null);
		}
	});
};

exports.getCBSubscription = function(subscriptionID, callback) {
	db.hgetall(subscriptionID, function(err, res) {
		if (err) {
			return callback(err, null)
		} else {
			return callback(null, res);
		}
	});
};

exports.deleteCBSubscription = function(subscriptionID, callback) {
	db.del(subscriptionID, function(err) {
		if (err) {
			return callback(err);
		} else {
			return callback(null);
		}
	});
};