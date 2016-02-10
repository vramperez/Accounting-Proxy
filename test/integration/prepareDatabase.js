var async = require('async');

var db_mock;

var loadServices = function(services, callback) {
	if (services.length != 0) {
		async.each(services, function(service, task_callback) {
			db_mock.newService(service.path, service.url, function(err) {
				if (err) {
					task_callback(err);
				} else {
					task_callback(null);
				}
			});
		}, callback);
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
					task_callback(null);
				}
			})
		}, callback);
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
					task_callback(null);
				}
			})
		}, callback)
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
					task_callback(null);
				}
			})
		}, callback);
	} else {	
		return callback();
	}
}


exports.addToDatabase = function(db, services, resources, accounting, subscriptions, callback) {
	db_mock = db;

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