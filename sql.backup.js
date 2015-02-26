/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last updated: 26 February 2015
 */

/* Requires */
var mysql = require('mysql');
var config = require('./config')

/* Create SQL connection */
var connection = mysql.createConnection(config.sql);

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
 * Load accounting info from DB
 * @param  {FUNCTION} setMap [Callback function to send the information loaded]
 */
exports.loadFromDB = function(setMap) {
    var toReturn = {};
    connection.query('SELECT * FROM users', function(err, results) {
        if (results !== undefined && results.length !== 0)
            for (i in results)
                toReturn[results[i].nickname] = {
                    requests:results[i].requests,
                    userID: results[i].userID
                }
        else
            console.log('[LOG] No data avaliable.');
        setMap(toReturn);
        delete toReturn;
   });
}

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
                     requests    INTEGER, \
                     PRIMARY KEY (userID) \
                     ) ENGINE=InnoDB');
}

/**
 * Add/Update number of request of a user.
 * @param  {OBJECT} userData   [user data]
 * @param  {STRING} user       [user name]
 */
exports.save = function(userData, user) {
    console.log('User: ' + user);
    console.log('Data: ' + userData);
    connection.query("UPDATE users SET requests=? WHERE nickname=? AND userID=?",
                     [userData.requests, user, userData.userID],function(err) {
        errorHandler(err, 'Query 1');
    });
}

/**
 * Disconnect from DB server.
 */
exports.close = function() {
    connection.end();
}