/**
 * Author: Jesús Martínez-Barquero Herrada
 * Last edit: 19 February 2015
 */

/* Requires */
var mysql = require('mysql');
var config = require('./config')

/* Create SQL connection */
var connection = mysql.createConnection(config.sql);

/**
 * Load accounting info from DB
 * @param  {FUNCTION} setMap [Callback function to send the information loaded]
 */
exports.loadFromDB = function(setMap) {
    var toReturn = {};
    connection.query('SELECT * FROM counts', function(err, results) {
        if (results !== undefined && results.length !== 0)
            for (i in results)
                toReturn[results[i].nickname] = results[i].requests;
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
    connection.connect();
    // Create Database if not exists
    connection.query('CREATE SCHEMA IF NOT EXISTS AccountingDDBB CHARACTER SET utf8 COLLATE utf8_general_ci');
    // Stablish the database to be used
    connection.query('USE AccountingDDBB');
    // Add a new table
    connection.query('CREATE TABLE IF NOT EXISTS counts ( \
                     nickname    VARCHAR(20), \
                     requests    INTEGER, \
                     PRIMARY KEY (nickname) \
                     ) ENGINE=InnoDB');
}

/**
 * Add/Update number of request of a user.
 * @param  {INTEGER}    numReq [number of requests]
 * @param  {STRING}     user   [user name]
 */
exports.save = function(numReq, user) {
    if (numReq == 1) {
        connection.query("INSERT INTO counts VALUE (?,?)", [user,numReq]);
    }
    else {
        connection.query("UPDATE counts SET requests=? WHERE nickname=?",[numReq, user]);
    }
}

/**
 * Disconnect from DB server.
 */
exports.close = function() {
    connection.end();
}