var redis = require('redis');
var db = redis.createClient();

db.on('connect', function(){
	console.log('connected');
});

db.on('error', function(err){
	console.log("Error" + err);
});


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


/*exports.addResource = function(data, callback) {

	db.sadd('resources', data.publicPath, function(err, reply){
		console.log(reply);
	});

	db.hmset(data.publicPath, { //Similar to offerResource
		'organization': data.offering.organization,
		'name': data.offering.name,
		'version': data.offering.version,
		'record_type': data.record_type,
		'unit': data.unit,
		'component_label': data.component_label
	}, function(err){
		console.log(err);
	});
};*/
