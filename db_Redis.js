var redis = require('redis');
var db = redis.createClient();

db.on('connect', function(){
	console.log('connected');
});

db.on('error', function(err){
	console.log("Error" + err);
});

exports.init = function() {
	//Not necessary
};

exports.loadFromDB = function(setData) { 
	var data = {};

	db.smembers('API_KEYS', function(err, api_keys) {
		var counter = api_keys.length;
		if(api_keys.length !== 0)
			for(i in api_keys){
				db.hgetall(api_keys[i], function(err, api_key) {
					loadResourcesAux(api_key, data, function() {
						counter--;
						if(counter === 0)
							setData(null, data);
					});
				});
			}
		else
			setData(null, data);
	});
};

function loadResourcesAux(api_key, data, callback){

	db.smembers('resources', function(err, resources) {
		var counter = resources.length;
		for(i in resources)
			db.hgetall(resources[i], function(err, res) {
				if(api_key.organization === res.org && api_key.name === res.name && api_key.version === res.version){
					db.hgetall(api_key.actorID + api_key.API_KEY + res.publicPath, function(err, account) {
						db.hgetall(res.publicPath, function(err, serv) {

							if(counter === resources.length)
								data[api_key.API_KEY] = {
									actorID: api_key.actorID,
									organization: api_key.organization,
									name: api_key.name,
									version: api_key.version,
									accounting: {},
									reference: api_key.reference
								}

							data[api_key.API_KEY].accounting[res.publicPath]  = {
								privatePath: serv.privatePath,
								port: serv.port,
								num: account.num,
								correlation_number: account.correlation_number,
								unit: res.unit
							}
							counter--;
							if(counter === 0)
								callback();
						})
					})
				}
			})
	})
};


// CLI: deleteService [path]
exports.deleteService = function(path, callback) {
	
	db.del(path, function(err) {
		if(err)
			callback(err)
		else
			db.srem('public', path, function(err) {
				if(err)
					callback(err)
				else
					callback();
			});
	});
};

// CLI: getService [publicPath]
exports.getService = function(publicPath, callback) {

	db.hgetall(publicPath, function(err, obj) {
		if(obj === null)
			callback(undefined);
		else
			callback(obj);
	});
};

// CLI: addService [publicPath] [privatePath] [port]
exports.newService = function(publicPath, privatePath, port, callback){

	db.hgetall(publicPath, function(err, res) {
		if(err !== null)
				callback(err);
			else if (res !== null)
				callback('[ERROR] The service already exists.');
			else
				db.sadd('public', publicPath, function(err) {
					if(err)
						callback(err)
					else
						db.hmset(publicPath, {
							'privatePath': privatePath,
							'port': port
						}, function(err) {
							if(err)
								callback(err);
							else
								callback();
						});
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

	console.log(data);

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

exports.count = function(actorID, API_KEY, publicPath, amount, callback) {


    db.hget(actorID + API_KEY + publicPath, 'num', function(err, num) {
    	if(err)
    		console.log(err)
    	else{
    		db.hmset(actorID + API_KEY + publicPath, {
    			'num' : (parseFloat(num) + amount).toString()
    		}, function() {
    			callback();
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
    			'num' : '0'
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

exports.addCBSubscription = function( API_KEY, publicPath, subscriptionID, ref_host, ref_port, ref_path, unit, callback) {

	db.hmset(subscriptionID, {
		'API_KEY': API_KEY,
		'publicPath': publicPath,
		'ref_host': ref_host,
		'ref_port': ref_port,
		'ref_path': ref_path,
		'unit': unit
	}, function(err) {
		if(err)
			callback(err);
	});
};

exports.getCBSubscription = function(subscriptionID, callback) {

	db.hgetall(subscriptionID, function(err, res) {
		callback(res);
	});
};

exports.deleteCBSubscription = function(subscriptionID, callback) {

	db.del(subscriptionID, function(err) {
		if(err)
			callback(err);
	});
}