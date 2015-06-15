var sqlite = require('sqlite3').verbose(); // Debug enable
var async = require('async');

var db = new sqlite.Database('accountingDB.sqlite');

exports.init = function() {

    db.serialize(function() {
        db.run('PRAGMA encoding = "UTF-8";');
        db.run('PRAGMA foreign_keys = 1;');
        db.run('CREATE TABLE IF NOT EXISTS servicies ( \
                    privatePath     TEXT, \
                    port            TEXT, \
                    PRIMARY KEY(privatePath, port) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS public ( \
                    publicPath     TEXT, \
                    privatePath    TEXT, \
                    port           TEXT, \
                    PRIMARY KEY (publicPath), \
                    FOREIGN KEY (privatePath, port) REFERENCES servicies (privatePath, port) ON UPDATE CASCADE \
               )');

        db.run('CREATE TABLE IF NOT EXISTS resources ( \
                    provider        TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    content_type    TEXT, \
                    privatePath     TEXT, \
                    port            TEXT, \
                    PRIMARY KEY (provider, name, version), \
                    FOREIGN KEY (privatePath, port) REFERENCES servicies (privatePath, port) ON UPDATE CASCADE \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offers ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    PRIMARY KEY (organization, name, version) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerResource ( \
                    provider        TEXT, \
                    resourceName    TEXT, \
                    resourceVersion TEXT, \
                    organization    TEXT, \
                    offerName       TEXT, \
                    offerVersion    TEXT, \
                    PRIMARY KEY (provider, resourceName, resourceVersion, organization, offerName, offerVersion), \
                    FOREIGN KEY (provider, resourceName, resourceVersion) REFERENCES resources (provider, name, version), \
                    FOREIGN KEY (organization, offerName, offerVersion) REFERENCES offers (organization, name, version) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS accounts ( \
                    actorID         TEXT, \
                    PRIMARY KEY (actorID) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerAccount ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    actorID         TEXT, \
                    API_KEY         TEXT, \
                    reference       TEXT, \
                    PRIMARY KEY (API_KEY), \
                    FOREIGN KEY (organization, name, version) REFERENCES offers (organization, name, version), \
                    FOREIGN KEY (actorID) REFERENCES accounts (actorID) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    actorID         TEXT, \
                    API_KEY         TEXT, \
                    num             INT,  \
                    PRIMARY KEY (actorID, API_KEY), \
                    FOREIGN KEY (actorID) REFERENCES accounts(actorID), \
                    FOREIGN KEY (API_KEY) REFERENCES offerAccount(API_KEY) \
               )');
        });
};

exports.loadFromDB = function(setData) {
    var data  = {},
        users = {};
    db.all('SELECT servicies.privatePath, servicies.port, public.publicPath \
            FROM servicies \
            INNER JOIN public \
            WHERE public.privatePath=servicies.privatePath AND public.port=servicies.port',
            function(err, row) {
                var counter = row.length;
                if (row.length !== 0)
                    for (i in row) {
                        loadUsers(data, users, row[i], function() {
                            counter--;
                            if (counter === 0)
                                setData(null, data, users);
                        });
                    }
                else
                    setData(null, data, users);
            }
    );
};

function loadUsers(data, users, row, callback) {
    db.all('SELECT accounting.actorID, accounting.API_KEY, accounting.num \
            FROM accounting \
            INNER JOIN \
            (SELECT offerAccount.actorID, offerAccount.API_KEY \
              FROM offerAccount \
              WHERE EXISTS ( \
                SELECT organization, offerName, offerVersion \
                FROM offerResource \
                WHERE offerAccount.organization=offerResource.organization AND offerAccount.name=offerResource.offerName AND \
                      offerAccount.version=offerResource.offerVersion AND EXISTS ( \
                      SELECT provider, name, version \
                      FROM resources \
                      WHERE offerResource.provider=provider AND offerResource.resourceName=name AND \
                            offerResource.resourceVersion=version AND privatePath=$privatePath AND port=$port \
                ) \
              ) \
            ) t \
            ON t.actorID=accounting.actorID AND t.API_KEY=accounting.API_KEY',
            { $privatePath: row.privatePath, $port: row.port },
            function(err, row2) {
                var id = row.publicPath;
                if (data[id] === undefined) {
                    data[id] =  {
                        path: row.privatePath,
                        port: row.port,
                        users: []
                    };
                }
                for (j in row2) {
                    if (users[row2[j]["accounting.API_KEY"]] === undefined) {
                        users[row2[j]["accounting.API_KEY"]] = {
                            API_KEY: row2[j]["accounting.API_KEY"],
                            id: row2[j]["accounting.actorID"],
                            num: row2[j]["accounting.num"]
                        };
                    }
                    data[id].users.push(users[row2[j]["accounting.API_KEY"]]);
                }
                callback();
            }
    );
}

// UNUSED
exports.checkRequest = function(actorID, publicPath, callback) {
    db.all('SELECT privatePath, port \
            FROM public \
            WHERE publicPath=$publicPath AND EXISTS ( \
              SELECT privatePath, port \
              FROM resources \
              WHERE public.privatePath=privatePath AND public.port=port AND EXISTS ( \
                SELECT provider, resourceName, resourceVersion, organization, offerName, offerVersion \
                FROM offerResource \
                WHERE resources.provider=provider AND resources.name=resourceName AND resources.version=resourceVersion AND EXISTS ( \
                  SELECT organization, name, version \
                  FROM offerAccount \
                  WHERE actorID=$actorID AND offerResource.organization=organization AND offerResource.offerName=name AND offerResource.offerVersion=version)))',
        {$actorID: actorID, $publicPath: publicPath}, function(error, row) {
            if (row.length === 1)
                callback(null, row[0].privatePath, row[0].port);
            else
                callback("User doesn't have access", null, null);
    });
};

exports.count = function(actorID, API_KEY) {
    db.run('UPDATE accounting \
            SET num=num+1 \
            WHERE actorID=$actorID AND API_KEY=$API_KEY',
        {
            $actorID: actorID,
            $API_KEY: API_KEY
        });
};

exports.resetCount = function(actorID, API_KEY) {
    db.run('UPDATE accounting \
            SET num=0 \
            WHERE actorID=$actorID AND API_KEY=$API_KEY',
           {
               $actorID: actorID,
               $API_KEY: API_KEY
           });
};

exports.getResources = function(org, name, version, callback) {
    db.all('SELECT provider, resourceName as name, resourceVersion as version \
           FROM offerResource \
           WHERE organization=$org AND offerName=$name AND offerVersion=$version',
           {
               $org: org,
               $name: name,
               $version: version
           }, function(err, row) {
               if (row.length !== 0)
                   callback(row);
               else
                   callback(null);
           });
};

exports.loadResources = function(callback) {
    db.all('SELECT provider, name, version FROM resources', function(err, row) {
        callback(row);
    });
};

exports.getApiKey = function(user, offer, reference, callback) {

    db.all('SELECT API_KEY \
            FROM offerAccount \
            WHERE organization=$org AND name=$name AND version=$version AND actorID=$actorID AND reference=$ref',
           {
               $org: offer.organization,
               $name: offer.name,
               $version: offer.version,
               $actorID: user,
               $ref: reference
           },
           function(err, row) {
               if (row.length === 1)
                   callback(row[0].API_KEY);
               else
                    callback();
           });
};

exports.addUser = function(user, reference, resource, offer, api, callback) {
    var res;
    for (var i in resource) {
        res = resource[i];

        db.serialize(function() {
            // Add user if not exists
            db.run('INSERT OR REPLACE INTO accounts \
                VALUES ($user)',
                   {$user: user});

            // Add offer it not existes
            db.run('INSERT OR REPLACE INTO offers \
                    VALUES ($org, $name, $version)',
                   {
                       $org: offer.organization,
                       $name: offer.name,
                       $version: offer.version
                   });

            // Add reference: OVERWRITE REFERENCE!!
            db.run('INSERT OR REPLACE INTO offerAccount \
                    VALUES ($org, $name, $version, $actorID, $API_KEY, $ref)',
                   {
                       $org: offer.organization,
                       $name: offer.name,
                       $version: offer.version,
                       $actorID: user,
                       $API_KEY: api,
                       $ref: reference
                   });

            // Add resource link to offer
            db.run('INSERT OR REPLACE INTO offerResource \
                    VALUES ($pro, $resName, $resVersion, $org, $offerName, $offerVersion)',
                   {
                       $pro: res.provider,
                       $resName: res.name,
                       $resVersion: res.version,
                       $org: offer.organization,
                       $offerName: offer.name,
                       $offerVersion: offer.version
                   });
            // Add accounting
            // TODO: What if it exists?
            db.run('INSERT OR REPLACE INTO accounting \
                    VALUES ($actorID, $API_KEY, 0)',
                   {
                       $actorID: user,
                       $API_KEY: api
                   });
        });
    }
};

exports.getPublicPaths = function(resource, callback) {
    db.all('SELECT publicPath \
            FROM public \
            WHERE EXISTS ( \
              SELECT privatePath, port \
              FROM resources \
              WHERE resources.provider=$prov AND resources.name=$name AND resources.version=$version AND public.privatePath=resources.privatePath AND public.port=resources.port)',
           {
               $prov: resource.provider,
               $name: resource.name,
               $version: resource.version
           }, function(err, row) {
               callback(row);
           });
};

exports.getReference = function(API_KEY, callback) {
    db.all('SELECT reference \
            FROM offerAccount \
            WHERE API_KEY=$api',
           { $api: API_KEY},
           function(err, row) {
               if (err || row.length === 0)
                   callback(undefined);
               else
                   callback(row[0].reference);
           });
};

exports.getOffer = function(API_KEY, callback) {
    db.all('SELECT organization, name, version \
            FROM offerAccount \
            WHERE API_KEY=$api',
           { $api: API_KEY },
           function(err, row) {
               if (err || row.length === 0)
                   callback(undefined);
               else
                   callback(row[0]);
           });
};

// CLI: addService [path] [port]
exports.newService = function(path, port, callback) {
    db.run('INSERT OR REPLACE INTO servicies \
            VALUES ($path, $port)',
           {
               $path: path,
               $port: port
           }, function(err) {
               if (err)
                   callback("[ERROR] Adding new service failed.");
               callback();
           });
};

// CLI: deleteService [path] [port]
exports.deleteService = function(path, port, callback) {
    db.run('DELETE FROM servicies \
            WHERE privatePath=$path AND port=$port',
           {
               $path: path,
               $port: port
           }, function(err) {
               if (err)
                   callback("[ERROR] Deleting service failed.");
               callback();
           });
};

// CLI: getInfo [user]
exports.getInfo = function(user, callback) {
    db.all('SELECT organization, name, version, API_KEY \
            FROM offerAccount \
            WHERE actorID=$user',
           {
               $user: user
           }, function(err, row) {
               console.log(row);
               if (err)
                   callback(err, undefined);
               else if (row.length === 0)
                   callback(null, undefined);
               else
                   callback(null,row);
           });
};
