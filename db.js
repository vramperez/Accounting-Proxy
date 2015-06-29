var sqlite = require('sqlite3').verbose(); // Debug enable

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
                    record_type     TEXT, \
                    unit            TEXT, \
                    component_label TEXT, \
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
                       loadResourcesAux(data, row[i], function() {
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

function loadResourcesAux(data, offer, callback) {
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
    db.all('SELECT p.publicPath as publicPath, privatePath, port, record_type, unit, component_label \
            FROM public as p, resources as r \
            WHERE p.publicPath=r.publicPath',
           function(err, row) {
               var l = row.length;
               var toReturn = {};

               for (var i=0; i<l; i++) {
                   toReturn[row[i].publicPath] = {
                       privatePath: row[i].privatePath,
                       port: row[i].port,
                       record_type: row[i].record_type,
                       unit: row[i].unit,
                       component_label: row[i].component_label
                   };
               }
               callback(toReturn);
    });
};

exports.getService = function(publicPath, callback) {
    db.all('SELECT privatePath, port \
            FROM public \
            WHERE publicPath=$publiPath',
           { $publicPath: publicPath },
           function(err, row) {
               if (err || row.length === 0)
                   callback(undefined);
               else
                   callback(row[0]);
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
           function(err, row) {
               if (row.length === 1)
                   callback(row[0].API_KEY);
               else
                    callback();
           });
};

exports.getAccountingInfo = function(publicPath, callback) {
    console.log(publicPath);
    db.all('SELECT record_type, unit, component_label \
            FROM resources \
            WHERE publicPath=$publicPath',
           { $publicPath: publicPath },
           function(err, row) {
               if (err || row.length === 0)
                   callback(undefined);
               else
                   callback(row[0]);
           });
};

exports.addInfo = function(API_KEY, data, callback) {
    var acc;

    db.serialize(function() {

        for (var p in data.accounting) {
        acc = data.accounting[p];

            // Add user if not exists
            db.run('INSERT OR REPLACE INTO accounts \
                    VALUES ($actorID)',
                   { $actorID: data.actorID });

            // Add offer it not existes
            db.run('INSERT OR REPLACE INTO offers \
                    VALUES ($org, $name, $version)',
                   {
                       $org: data.organization,
                       $name: data.name,
                       $version: data.version
                   });

            // Add reference: OVERWRITE REFERENCE!!
            db.run('INSERT OR REPLACE INTO offerAccount \
                    VALUES ($org, $name, $version, $actorID, $API_KEY, $ref)',
                   {
                       $org: data.organization,
                       $name: data.name,
                       $version: data.version,
                       $actorID: data.actorID,
                       $API_KEY: API_KEY,
                       $ref: data.reference
                   });

            // Add resource link to offer
            db.run('INSERT OR REPLACE INTO offerResource \
                    VALUES ($publicPath, $org, $offerName, $offerVersion)',
                   {
                       $publicPath: p,
                       $org: data.organization,
                       $offerName: data.name,
                       $offerVersion: data.version
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
                   });
        }
    });
};

// TODO: Is it necessary??
// TODO: Update for new information structure
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

exports.addResource = function(data, callback) {
    db.run('INSERT OR REPLACE INTO resources \
            VALUES ($p, $r, $u, $c)',
           {
               $p: data.publicPath,
               $r: data.record_type,
               $u: data.unit,
               $c: data.component_label
           }, function (err) {
               callback(err);
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
               // console.log(row);
               if (err)
                   callback(err, undefined);
               else if (row.length === 0)
                   callback(null, undefined);
               else
                   callback(null,row);
           });
};
