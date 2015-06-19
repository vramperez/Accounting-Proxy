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
                    publicPath      TEXT, \
                    privatePath     TEXT, \
                    port            TEXT, \
                    PRIMARY KEY (publicPath), \
                    FOREIGN KEY (privatePath, port) REFERENCES servicies (privatePath, port) ON UPDATE CASCADE \
               )');

        db.run('CREATE TABLE IF NOT EXISTS resources ( \
                    publicPath      TEXT, \
                    recorde_type    TEXT, \
                    unit            TEXT, \
                    component_label TEXT, \
                    PRIMARY KEY (publicPath), \
                    FOREIGN KEY (publicPath) REFERENCES public (publicPath) ON UPDATE CASCADE \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offers ( \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    PRIMARY KEY (organization, name, version) \
               )');

        db.run('CREATE TABLE IF NOT EXISTS offerResource ( \
                    publicPath      TEXT, \
                    organization    TEXT, \
                    name            TEXT, \
                    version         TEXT, \
                    PRIMARY KEY (publicPath, organization, name, version), \
                    FOREIGN KEY (publicPath) REFERENCES resources (publicPath), \
                    FOREIGN KEY (organization, name, version) REFERENCES offers (organization, name, version) \
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
                    actorID             TEXT, \
                    API_KEY             TEXT, \
                    num                 INT,  \
                    publicPath          TEXT, \
                    correlation_number  INT,  \
                    PRIMARY KEY (actorID, API_KEY, publicPath), \
                    FOREIGN KEY (actorID) REFERENCES accounts(actorID), \
                    FOREIGN KEY (API_KEY) REFERENCES offerAccount(API_KEY) \
                    FOREIGN KEY (publicPath) REFERENCES resources(publicPath) \
               )');
        });
};

exports.loadFromDB = function(setData) {
    var data  = {};
    db.all('SELECT * \
            FROM offerAccount',
           function(err, row) {
               // console.log(row);
               var counter = row.length;
               if (row.length !== 0)
                   for (i in row) {
                       loadResources(data, row[i], function() {
                           counter--;
                           if (counter === 0)
                               setData(null, data);
                       });
                   }
               else
                   setData(null, data);
           }
          );
};

function loadResources(data, offer, callback) {
    db.all('SELECT accounting.num as num, accounting.correlation_number as correlation_number, accounting.publicPath as publicPath, public.privatePath as privatePath, public.port as port, resources.unit as unit \
            FROM accounting, public, resources \
            WHERE API_KEY=$api_key AND accounting.publicPath=public.publicPath AND accounting.publicPath=resources.publicPath',
           { $api_key: offer.API_KEY },
           function(err, row) {
               // console.log(offer.API_KEY ,row);
               var id = offer.API_KEY;

               if (data[id] === undefined) {
                   data[id] =  {
                       actorID: offer.actorID,
                       organization: offer.organization,
                       name: offer.name,
                       version: offer.version,
                       accounting: {},
                       reference: offer.reference
                   };
               }

               for (var i in row) {
                   var res = row[i];
                   data[id].accounting[res.publicPath] = {
                       privatePath: res.privatePath,
                       port: res.port,
                       num: res.num,
                       correlation_number: res.correlation_number,
                       unit: res.unit
                   };
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

exports.count = function(actorID, API_KEY, publicPath, amount) {
    db.run('UPDATE accounting \
            SET num=num+$amount \
            WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath',
        {
            $actorID: actorID,
            $API_KEY: API_KEY,
            $publicPath: publicPath,
            $amount: amount
        });
};

exports.resetCount = function(actorID, API_KEY, publicPath) {
    db.run('UPDATE accounting \
            SET num=0, correlation_number=correlation_number+1 \
            WHERE actorID=$actorID AND API_KEY=$API_KEY AND publicPath=$publicPath',
           {
            $actorID: actorID,
            $API_KEY: API_KEY,
            $publicPath: publicPath
           });
};

exports.getResources = function(org, name, version, callback) {
    db.all('SELECT publicPath \
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
    db.all('SELECT publicPath  FROM resources', function(err, row) {
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
