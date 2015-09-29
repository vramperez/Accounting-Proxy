var redis = require('redis');
var db = redis.createClient();

db.on('connect', function(){
	console.log('connected');
});

db.on('error', function(err){
	console.log("Error" + err);
});

exports.init = function() {

};

exports.loadFromDB = function(setData) { 
	var data = {};

	db.smembers('resources', function(err, resources) {
		if(err || resources.length === 0)
			setData(err, null);
		else
			db.smembers('API_KEYS', function(err, api_keys) {
				if(api_keys.length !== 0){
					api_keys.forEach(function(api_key) {
						db.hgetall(api_key, function(err, acc){
							resources.forEach(function(resource) {
								db.hgetall(resource, function(err, res) {
									if(acc.organization === res.org &&
										acc.name === res.name &&
										acc.version === res.version){
											db.hgetall(acc.actorID + acc.API_KEY + res.publicPath, function(err, account) {
												db.hgetall(res.publicPath, function(err, serv) {
													data[acc.API_KEY] = {
														actorID: acc.actorID,
														organization: acc.organization,
														name: acc.name,
														version: acc.version,
														accounting: {},
														reference: acc.reference
													}
													console.log(acc)
												data[acc.API_KEY].accounting[res.publicPath] = {
													privatePath: serv.privatePath,
													port: serv.port,
													num: account.num,
													correlation_number: account.correlation_number,
													unit: res.unit
												}
												setData(null, data);
											});
										});
						
									}
								});
							});
						});
					});
				} else {
					setData(null, data);
				}
			});
	});
};


// CLI: newService [path] [port]
exports.newService = function(path, port, callback) {

	db.sadd(path, port, function(err, reply) {
		if(err)
			callback(err);
		callback();
	});
};

// CLI: deleteService [path] [port]
exports.deleteService = function(path, port, callback) {
	
	db.srem(path, port, function(err) {
		if(err)
			callback("[ERROR] Deleting service failed.");
		else {
			db.smembers(path, function(err, obj) {
				if(obj.length === 0)
					db.del(path, function(err) {
						if(err)
							callback("[ERROR] Deleting service failed.");
						else
							db.del(path);
					});
				db.smembers('public', function(err, publics) {
					if(publics.length !== 0)
					publics.forEach(function(entry) {
						db.hgetall(entry, function(err, service) {
							if(err)
								callback(err)
							else{
								if(service.privatePath === path &&
									service.port === port){
										db.del(entry);
										db.srem('public', entry);
								}
							}
						});
					});
				});
			});
		}
	});
};

// CLI: getService [publicPath]
exports.getService = function(publicPath, callback) {

	db.hgetall(publicPath, function(err, obj) {
		if(err)
			callback(err);
		else
			callback(obj);
	});
};

// CLI: mapService [publicPath] [privatePath] [port]
exports.mapService = function(publicPath, privatePath, port, callback){

	db.sadd('public', publicPath, function(err) {
		if(err)
			callback(err)
		else
			db.smembers(privatePath, function(err, reply) {
				if(err || reply.length === 0)
					callback(err);
				else {
					if (reply[reply.indexOf(port)] === undefined)
						callback(undefined)
					else
						db.hmset(publicPath, {
						'privatePath': privatePath,
						'port': port,
					}, function(err) {
						if(err)
							callback(err);
					});
				}
			});
		});
};


exports.addResource = function(data, callback) {


	db.sadd(['resources', data.publicPath + data.offering.organization + data.offering.name + data.offering.version], function(err) {
		if(err)
			callback(err);
		else{
			db.hmset(data.publicPath + data.offering.organization + data.offering.name + data.offering.version, {
					'publicPath': data.publicPath,
					'org': data.offering.organization,
					'name': data.offering.name,
					'version': data.offering.version,
					'record_type': data.record_type,
					'unit': data.unit,
					'component_label': data.component_label
				}, function(err){
					if(err)
						callback(err);
					else
						callback(undefined);
				});
		}
	});
};

exports.loadUnits = function(callback) {

	db.smembers('resources', function(err, resources) {
		if(err)
			callback(err);
		else {
			if(resources.length !== 0){
				var toReturn = {};
				resources.forEach(function(entry) {
					db.hgetall(entry, function(err, obj) {
						if(err)
							callback(err);
						else {
							toReturn[obj['publicPath']] = {
								publicPath: obj['publicPath'],
								organization: obj['organization'],
								name: obj['name'],
								version: obj['version'],
								unit: obj['unit']
							}
							callback(toReturn);
						}
					});
				});
			} else {
				callback(toReturn);
			}
		}
	});
};

exports.loadResources = function(callback) {
	var toReturn = {};

	db.smembers('public', function(err, resources) {
		if(resources.length !== 0){
			resources.forEach(function(entry) {
				db.hgetall(entry, function(err, res) {
					toReturn[entry] = {
						privatePath: res.privatePath,
						port: res.port
					}
					callback(toReturn);
				});
			});
		} else {
			callback(toReturn);
		}
	});
};


exports.addInfo = function(API_KEY, data, callback) {

	db.sadd(['API_KEYS', API_KEY], function(err) {
		if(err)
			callback(err);
		else
			db.hmset(API_KEY, {
				'organization': data.organization,
				'name': data.name,
				'version': data.version,
				'actorID': data.actorID,
				'API_KEY': API_KEY,
				'reference': data.reference
			}, function(err) {
				if(err) {
					callback(err);
				} else {
					db.sadd([data.actorID, API_KEY], function(err){
						if(err) {
							callback(err);
						} else {
							var acc;
							console.log(data)
							for (var p in data.accounting) {
								acc = data.accounting[p];
								db.hmset(data.actorID + API_KEY + p, {
									'actorID': data.actorID,
									'API_KEY': API_KEY,
									'num': acc.num,
									'publicPath': p,
									'correlation_number': acc.correlation_number
								}, function(err){
									if(err)
										callback(err);
									else
										callback();
								});
							};
						}
					});
				}
			});
	});
};


exports.getApiKey = function(user, offer, callback) {

	db.smembers(user, function(err, apiKey) {
		if(apiKey.length !== 0){
			apiKey.forEach(function(entry) {
				if(err)
					callback(err);
				else {
					db.hgetall(entry, function(err, offerAcc) {
						if (offerAcc['organization'] === offer['organization'] &&
							offerAcc['name'] === offer['name'] &&
							offerAcc['version'] === offer['version']) {
							callback(offerAcc['API_KEY']);
						} else {
							callback();
						}
					});
				}
			});
		} else {
			callback();
		}
	});

};


// CLI: getInfo [user]
exports.getInfo = function(user, callback) {
	
	db.smembers(user, function(err, acc) {
		if(err || acc.length === 0){
			callback(err, undefined);
		} else {
			acc.forEach(function(entry) {
				var toReturn = {};
				db.hgetall(entry, function(err, info) {
					if(err) {
						callback(err, undefined);
					} else {
						toReturn[entry] = {
							API_KEY: entry,
							organization: info['organization'],
							name: info['name'],
							version: info['version'],
						}
					callback(null, toReturn);
					}
				});
			});
		}
	});
};

exports.count = function(actorID, API_KEY, publicPath, amount) {
    db.hget(actorID + API_KEY + publicPath, 'num', function(err, num) {
    	if(err)
    		console.log(err)
    	else{
    		num = parseFloat(num) + amount;
    		db.hmset(actorID + API_KEY + publicPath, {
    			'num' : num
    		});
    	}
    });
};

exports.resetCount = function(actorID, API_KEY, publicPath) {
	db.hget(actorID + API_KEY + publicPath, 'correlation_number', function(err, correlation_number) {
    	if(err)
    		console.log(err)
    	else{
    		correlation_number = parseInt(correlation_number) + 1;
    		db.hmset(actorID + API_KEY + publicPath, {
    			'correlation_number' : correlation_number,
    			'num' : 0
    		});
    	}
    });
};

exports.getAccountingInfo = function(publicPath, offer, callback) {

	var toReturn = {};

	db.hgetall(publicPath + offer.organization + offer.name + offer.version, function(err, resource) {
		if(err)
			callback(err)
		else{
			toReturn = {
				recordType: resource.recordType,
				unit: resource.unit,
				component: resource.component
			}
			callback(toReturn);
		}
	});
};

exports.getOffer = function(API_KEY, callback) {
	db.hgetall(API_KEY, function(err, offer) {
		if(err || offer.length === 0)
			callback(undefined);
		else
			callback(offer);
	});
};

exports.getReference = function(API_KEY, callback) {
	db.hgetall(API_KEY, function(err, offer) {
		if(err || offer.length === 0)
			callback(undefined);
		else
			callback(offer.reference);
	});
};

exports.getResources = function(org, name, version, callback) {
	var data = [];
	db.members('public', function(err, publics) {
		publics.forEach(function(p) {
			db.hgetall(p + org + name + version, function(err, res) {
				if(res !== undefined)
					data[data.length-1] = p;
			});
		});
	});
};