/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last updated: 03 March 2015
 */

/* Requires */
var mysql = require('mysql');
var config = require('./config');
var info = require('./lib/info.json');

/* Create SQL connection */
var connection = mysql.createConnection(config.sql);

/**
 * Connect to database server and create everything if it is necessary.
 */
exports.init = function() {
    connection.connect(function(err) {
        errorHandler(err, 'Connection');
    });
    // Create Database if not exists
    connection.query('CREATE SCHEMA IF NOT EXISTS AccountingDDBB CHARACTER SET utf8 COLLATE utf8_general_ci');
    // Stablish the database to be used
    connection.query('USE AccountingDDBB');
    // Add new table of users that can use the service.
    connection.query('CREATE TABLE IF NOT EXISTS users ( \
                     userID     VARCHAR(30), \
                     nickname   VARCHAR(20), \
                     reference  VARCHAR(50), \
                     requests   INTEGER, \
                     PRIMARY KEY (userID) \
                     ) ENGINE=InnoDB');
    // Add new table of offers avaliable in use.
    connection.query('CREATE TABLE IF NOT EXISTS offers ( \
                     reference      VARCHAR(50), \
                     organization   VARCHAR(50), \
                     name           VARCHAR(50), \
                     version        VARCHAR(10), \
                     PRIMARY KEY (reference) \
                     ) ENGINE=InnoDB');
}

/**
 * Handle errors. Exist if it is a fatal error.
 * @param  {OBJECT} err  [error objet]
 * @param  {STRING} type [describe error's type]
 */
var errorHandler = function(err, type) {
    if (err) {
        console.log('[LOG] SQL ' + type + ' Query Error: ' + err.code);
        if (err.fatal)
            process.exit(1);
    }
}

/**
 * Send a request to WStore with accounting information of user.
 * @param  {OBJECT} user [user object information]
 * TODO: Implement method, xD
 */
var notify = function(user) {
    console.log("User with pending request: " + user.nickname);
    resetRequest(user.userID);
}

/**
 * Load accounting info from DB
 * @param  {FUNCTION} setMap [Callback function to send the information loaded]
 */
exports.loadFromDB = function(setMap) {
    var toReturn = {};
    connection.query('SELECT * FROM users', function(err, results) {
        if (results !== undefined && results.length !== 0)
            for (i in results) {
                if (results[i].requests > 0)
                    notify(results[i]);
                toReturn[results[i].nickname] = {
                    requests:0,
                    userID: results[i].userID,
                    reference: results[i].reference
                }
            }
        else
            console.log('[LOG] No data avaliable.');
        setMap(toReturn);
        delete toReturn;
   });
}

/**
 * Add/Update number of request of a user.
 * @param  {OBJECT} userData   [user data]
 * @param  {STRING} user       [user name]
 */
exports.save = function(userData, user) {
    connection.query("UPDATE users SET requests=? WHERE nickname=? AND userID=?",
                     [userData.requests, user, userData.userID],function(err) {
        errorHandler(err, 'Query');
    });
}

/**
 * Insert new user in DB.
 * @param  {STRING} userID [user ID]
 * @param  {STRING} user   [user's nickname]
 */
exports.newUser = function(userID, user, reference) {
    connection.query("INSERT INTO users VALUE (?,?,?,?)", [userID,user,reference,0], function(err) {
        errorHandler(err, 'Query');
    });
}

/**
 * Update purchase reference in DB and set to 0 the number of requests.
 * @param  {STRING} userID       [user ID]
 * @param  {STRING} newReference [purchase reference]
 */
exports.updateReference = function(userID, newReference) {
    connection.query("UPDATE users SET requests=?, reference=? WHERE userID=?",
                     [0, newReference, userID],function(err) {
        errorHandler(err, 'Query');
    });
}

exports.getUserInfo = function(userID, retrieveInfo) {
    connection.query("SELECT * FROM users WHERE userID=?", [userID],function(err, data) {
        if (err)
            errorHandler(err, 'Query');
        else
            retrieveInfo(data);
    });
}

/**
 * Reset request counter in DB.
 * @param  {STRING} userID [user ID]
 */
var resetRequest = function(userID) {
    connection.query("UPDATE users SET requests=? WHERE userID=?", [0,userID],
                     function(err) {
        errorHandler(err, 'Query');
    });
}
/**
 * Disconnect from DB server.
 */
exports.close = function() {
    connection.end();
}