var sqlite = require('sqlite3').verbose(), // Debug enable
    async = require('async');

var db = new sqlite.Database('accountingDB.sqlite');

exports.init = function() {

    db.serialize(function() {
        db.run('PRAGMA encoding = "UTF-8";');
        db.run('PRAGMA foreign_keys = 1;');

        db.run('CREATE TABLE IF NOT EXISTS public ( \
                    publicPath      TEXT, \
                    url             TEXT, \
                    port            TEXT, \
                    PRIMARY KEY (publicPath) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerResource ( \
                    publicPath      TEXT, \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    record_type     TEXT, \
                    unit            TEXT, \
                    component_label TEXT, \
                    PRIMARY KEY (publicPath, organization, name, version)\
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerAccount ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    actorID         TEXT, \
                    API_KEY         TEXT, \
                    reference       TEXT, \
                    PRIMARY KEY (API_KEY), \
                    FOREIGN KEY (actorID) REFERENCES accounts (actorID) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    actorID             TEXT, \
                    API_KEY             TEXT, \
                    num                 INT,  \
                    publicPath          TEXT, \
                    correlation_number  INT,  \
                    PRIMARY KEY (actorID, API_KEY, publicPath), \
                    FOREIGN KEY (actorID) REFERENCES accounts(actorID), \
                    FOREIGN KEY (API_KEY) REFERENCES offerAccount(API_KEY) \
               )');
        });
};

exports.checkInfo = function(user, api_key, publicPath, callback) {
    db.all('SELECT res.unit\
            FROM accounting as acc AND offerAccount as offer AND offerResource as res \
            WHERE API_KEY=$api_key AND acc.API_KEY=offer.API_KEY',
            {
                $api_key: api_key
            }, function(err, unit) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, unit);
                }
            })
}

// CLI: addService [path] [url] [port]
exports.newService = function(publicPath, url, port, callback) {
    db.run('INSERT OR REPLACE INTO public \
            VALUES ($path, $url, $port)',
        {
            $path: publicPath,
            $url: url,
            $port: port
        }, function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null)
        }
    });
};

// CLI: deleteService [publicPath]
exports.deleteService = function(path, callback) {
    db.run('DELETE FROM public \
            WHERE publicPath=$path',
        {
         $path: path
        }, function(err) {
        if (err) {
            return callback(err);
        } else {
            return callback(null);
        }
    });
};

// CLI: getService [publicPath]
exports.getService = function(path, callback) {
    db.all('SELECT url, port \
            FROM public \
            WHERE publicPath=$path', {
                $path: path
            }, function(err, service) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, service);
                }
            });
}

// CLI: getInfo [user]
exports.getInfo = function(user, callback) {
    db.all('SELECT organization, name, version, API_KEY \
            FROM offerAccount \
            WHERE actorID=$user', {
                $user: user
            }, function(err, row) {
                if (err) {
                    return callback(err, null);
                } else if (row.length === 0) {
                    return callback(null, {});
                } else {
                    return callback(null, row);
                }
    });
};

exports.addResource = function(data, callback) {
    db.serialize(function() {
        db.run("INSERT OR REPLACE INTO offerResource \
            VALUES ($publicPath, $org, $name, $version, $record_type, $unit, $component_label)",
            {
                $publicPath: data.publicPath,
                $org: data.offering.organization,
                $name: data.offering.name,
                $version: data.offering.version,
                $record_type: data.record_type,
                $unit: data.unit,
                $component_label: data.component_label
            }, function (err) {
            if (err) {
                return callback(err);
            } else {
                return callback(null);
            }
         });
    });
};

exports.getUnit = function(path, organization, name, version, callback) {
    db.all('SELECT unit \
            FROM offerResource \
            WHERE publicPath=$path AND organization=$org AND name=$name AND version=$version',
            {
                $path: path,
                $org: organization,
                $name: name,
                $version: version
            }, function(err, unit) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, unit[0].unit);
                }
            });
}

exports.getApiKeys = function(callback) {
    var toReturn = [];

    db.all('SELECT API_KEY \
            FROM offerAccount', 
            function(err, apiKeys) {
                if (err) {
                    return callback(err, null);
                } else if (apiKeys === undefined){
                    return callback(null, []);
                } else {
                    async.each(apiKeys, function(api_key_obj, task_callback) {
                        toReturn.push(api_key_obj.API_KEY);
                        task_callback(null);
                    }, function(err) {
                        if (err) {
                            return callback(err, null);
                        } else {
                            return callback(null, toReturn);
                        }
                    });
                }
    });
}

exports.getResources = function(api_key, callback) {
    db.all('SELECT publicPath \
            FROM accounting \
            WHERE API_KEY=$api_key',
            {
                $api_key: api_key
            }, function(err, resources) {
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, resources[0]);
                }
            });
}

exports.getNotificationInfo = function(api_key, path, callback) {
    db.all('SELECT acc.API_KEY, acc.actorID as acotrID, acc.num as num, \
                acc.publicPath as publicPath, acc.correlation_number as correlation_number, \
                offer.organization as organization, offer.name as name, offer.version as version \
            FROM accounting as acc , offerAccount as offer \
            WHERE acc.API_KEY=offer.API_KEY AND acc.API_KEY=$api_key AND offer.API_KEY=$api_key', {
                $api_key: api_key
            }, function(err, notification_info) {
                console.log(notification_info)
                if (err) {
                    return callback(err, null);
                } else {
                    return callback(null, notification_info[0]);
                }
    });
}

exports.checkBuy = function(api_key, path, callback) {
    db.all('SELECT publicPath \
            FROM accounting \
            WHERE API_KEY=$api_key', {
                $api_key: api_key
            }, function(err, path) {
                if (err ) {
                    return callback(err, null);
                } else if (path.length != 0 ){
                    return callback(null, true);
                } else {
                    return callback(null, false);
                }
    });
}           

exports.count = function(actorID, API_KEY, publicPath, amount, callback) {
    db.run('UPDATE accounting \
        SET num=num+$amount \
        WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath',
        {
            $actorID: actorID,
            $API_KEY: API_KEY,
            $publicPath: publicPath,
            $amount: amount
        }, function(err) {
            if (err) {
                return callback(err);
            } else {
                return callback(null);
            }
        });
};

exports.resetCount = function(actorID, API_KEY, publicPath, callback) {
    db.run('UPDATE accounting \
        SET num=0, correlation_number=correlation_number+1 \
        WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath',
        {
            $actorID: actorID,
            $API_KEY: API_KEY,
            $publicPath: publicPath
        }, function(err) {
            if (err) {
                return callback(err);
            } else {
                return callback(null);
            }
        });
};

exports.getApiKey = function(user, offer, callback) {
    db.all('SELECT API_KEY \
        FROM offerAccount \
        WHERE organization=$org AND name=$name AND version=$version AND actorID=$actorID AND reference=$ref',
        {
            $org: offer.organization,
            $name: offer.name,
            $version: offer.version,
            $actorID: user
        },
        function(err, row_list) {
            if (err) {
                return callback(err, null);
            } else if (row_list[0] === undefined){
                return callback(null, null);
            } else {
                return callback(null, row_list[0].API_KEY);
            }
    });
};

exports.getAccountingInfo = function(publicPath, offer, callback) {
    db.all('SELECT record_type, unit, component_label \
        FROM offerResource \
        WHERE publicPath=$publicPath AND organization=$org AND name=$name AND version=$v',
        {
            $publicPath: publicPath,
            $org: offer.organization,
            $name: offer.name,
            $v: offer.version
        },
        function(err, row_list) {
            if (err) {
                return callback(err, null);
            } else if (row_list.length === 0) {
                return callback(null, null);
            } else {
                return callback(null, row_list[0]);
            }
    });
};

exports.addInfo = function(API_KEY, data, callback) {
    var acc;

    db.serialize(function() {
        for (var p in data.accounting) {
            acc = data.accounting[p];
            db.run('INSERT OR REPLACE INTO offerAccount \
                VALUES ($org, $name, $version, $actorID, $API_KEY, $ref)',
                {
                 $org: data.organization,
                 $name: data.name,
                 $version: data.version,
                 $actorID: data.actorID,
                 $API_KEY: API_KEY,
                 $ref: data.reference
                },
                function(err) { 
                    if (err) {
                        return callback(err);
                    } 
                });
                // Add accounting
                db.run('INSERT OR REPLACE INTO accounting \
                    VALUES ($actorID, $API_KEY, $num, $publicPath, $correlation_number)',
                    {
                        $actorID: data.actorID,
                        $API_KEY: API_KEY,
                        $num: acc.num,
                        $publicPath: p,
                        $correlation_number: acc.correlation_number
                    },
                    function(err) { 
                        if (err) {
                            return callback(err);
                        } else {
                            return callback(null);
                        } 
            });
        }
    });
};