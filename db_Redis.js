var redis = require('redis');
var client = redis.createClient();

client.on('connect', function(){
	console.log('connected');
});

client.on('error', function(err){
	console.log("Error" + err);
});


exports.newService = function(path, port, callback) {

	client.sadd(path, port, function(err, reply) {
		if(err)
			callback(err);
	});
};

exports.getService = function(publicPath, callback) {

	client.smembers(publicPath, function(err, obj) {
		if(err)
			callback(err);
		else
			callback(obj);
	});
};


exports.addResource = function(data, callback) {

	client.sadd('resources', data.publicPath, function(err, reply){
		console.log(reply);
	});

	client.hmset(data.publicPath, { //Similar to offerResource
		'organization': data.offering.organization,
		'name': data.offering.name,
		'version': data.offering.version,
		'record_type': data.record_type,
		'unit': data.unit,
		'component_label': data.component_label
	}, function(err){
		console.log(err);
	});
};
