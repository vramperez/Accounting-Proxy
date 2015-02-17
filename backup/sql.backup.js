var mysql = require('mysql');

var HOST = 'localhost';
var PORT ='3306';
var MYSQL_USER = 'jesus';
var MYSQL_PASS = 'conwet';

var connection = mysql.createConnection({
    host: HOST,
    port: PORT,
    user: MYSQL_USER,
    password: MYSQL_PASS,
});

exports.init = function() {
    connection.connect();

    /* Create Database */
    connection.query('CREATE SCHEMA IF NOT EXISTS AccountingDDBB CHARACTER SET utf8 COLLATE utf8_general_ci');
    /* Stablish the database to be used */
    connection.query('USE AccountingDDBB')
    connection.query('DROP TABLE IF EXISTS counts');
    /* Add a new table */
    connection.query('CREATE TABLE IF NOT EXISTS counts ( \
                     nickname    VARCHAR(20), \
                     requests    INTEGER, \
                     PRIMARY KEY (nickname) \
                     ) ENGINE=InnoDB');
}

exports.saveUsers = function(counts) {
    for(user in counts) {
        if (counts[user] == 1) {
            connection.query("INSERT INTO counts VALUE (?,?)", [user,counts[user]]);
        }
        else {
            connection.query("UPDATE counts SET requests=? WHERE nickname=?",[counts[user], user]);
        }
    }
}

exports.close = function() {connection.end();}
/* Add info 
/*connection.query("INSERT INTO Sucursal_G1 \
                 VALUE ('S1','Paseo de la Castellana','916650765')"
                 );
connection.query("INSERT INTO Sucursal_G1 \
                 VALUE ('S2','Avenida de Boadilla','916650765')"
                 );
connection.query("INSERT INTO Sucursal_G1 \
                 VALUE ('S3','Paseo del Prado','916650765')"
                 );
connection.query("INSERT INTO Sucursal_G1 \
                 VALUE ('S4','Ronda de Valencia','916650765')"
                 );
connection.query("INSERT INTO Sucursal_G1 \
                 VALUE ('S5','Recoletos','916650765')"
                 );*/
// https://github.com/patriksimek/node-mssql
// https://github.com/felixge/node-mysql