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
                    PRIMARY KEY (organization, name, version, actorID), \
                    FOREIGN KEY (organization, name, version) REFERENCES offers (organization, name, version), \
                    FOREIGN KEY (actorID) REFERENCES accounts (actorID) \
               )');
        db.run('CREATE TABLE IF NOT EXISTS accounting ( \
                    actorID         TEXT, \
                    provider        TEXT, \
                    resourceName    TEXT, \
                    resourceVersion TEXT, \
                    organization    TEXT, \
                    offerName       TEXT, \
                    offerVersion    TEXT, \
                    num             INT,  \
                    PRIMARY KEY (actorID, provider, resourceName, resourceVersion, organization, offerName, offerVersion), \
                    FOREIGN KEY (provider, resourceName, resourceVersion) REFERENCES resources (provider, name, version), \
                    FOREIGN KEY (organization, offerName, offerVersion) REFERENCES offers (organization, name, version) \
               )');
        });
}

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
                callback(row[0].privatePath, row[0].port);
            else
                console.log("[ERROR] Invalid query.")
    });
}