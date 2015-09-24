var redis = require('redis');
var db = redis.createClient();

db.on('connect', function(){
	console.log('connected');
});

db.on('error', function(err){
	console.log("Error" + err);
});

exports.loadFromDB = function(setData) { 

};


exports.newService = function(path, port, callback) {

	db.sadd(path, port, function(err, reply) {
		if(err)
			callback(err);
	});
};

exports.getService = function(publicPath, callback) {

	db.hgetall(publicPath, function(err, obj) {
		if(err)
			callback(err);
		else
			callback(obj);
	})
};

exports.mapService = function(publicPath, privatePath, port, callback){

	db.smembers(privatePath, function(err, reply) {
		if(err)
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
				});
		}
	});
};

exports.loadUnits = function(callback) {

	db.smembers('resources', function(err, resources) {
		if(err)
			callback(err);
		else {
			var toReturn = {};
			resources.forEach(function(entry) {
				db.hgetall(entry, function(err, obj) {
					if(err)
						callback(err);
					else {
						toReturn[obj['publicPath']] = {
							publicPath: obj['publicPath'],
							organization: obj['org'],
							name: obj['name'],
							version: obj['version'],
							unit: obj['unit']
						}
						callback(toReturn);
					}
				});
			});
		}
	})
};

exports.loadResources = function(callback) {

	db.smembers('resources', function(err, resources) {

		var toReturn = {};
		var fields = ['privatePath', 'port'];
		resources.forEach(function(entry) {
			db.hget(entry, 'publicPath', function(err, obj) {
				if(err)
					callback(err)
				else{
					db.hgetall(obj, function(err, obj) {
						if(err)
							callback(err)
						else {
							toReturn = {
								privatePath: obj['privatePath'],
								port: obj['port']
							};
							callback(toReturn);
						}
					});
				}
			});
		});
	});
};


exports.addInfo = function(API_KEY, data, callback) {

	db.hmset(API_KEY, {
		'organization': data.organization,
		'name': name: data.name,
		'version': version: data.version,
		'actorID': actorID: data.actorID,
		'API_KEY': API_KEY,
		'ref': ref: data.reference
	}, function(err) {
		if(err)
			callback(err);
		else{
			//Añadir a accoun ting
		}
	});

};