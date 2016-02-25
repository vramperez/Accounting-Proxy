var config = {};

// Accounting proxy configuration
//--------------------------------------------------
// Configures the address and ports for the accounting proxy
config.accounting_proxy = {

        /**
         * Port where the accounting proxy server is listening.
         */
        port: 9000,

        /**
         * Port where the accounting proxy is listening the Store notifications
         */
        admin_port: 9001

};

// Accounting database configuration
//--------------------------------------------------
config.database = {
    
    /**
     * Select the database. Possible optrions are: 
     *     './db_Redis': redis database.
     *     './db': sqlite database.
     */
    type: "./db",

    /**
     * Database name. If the database type selected is './db_Redis', 
     *  then name must be a number (0 by default, and 15 is reserved to test by default).
     */
    name: 'accountingDB.sqlite',

}

// Accouning Modules configuration
//--------------------------------------------------
// Configures the accounting modules used by the accounting proxy
config.modules = {

    accounting: [ 'call', 'megabyte']

};


// WStore sonfiguration
//--------------------------------------------------
// Configures the WStore address and port
config.WStore = {

    /**
     * WStore url for accounting notification
     */
    url: 'http://localhost:9010/charging/orderingManagement/accounting/'
};

// Resource configuration
//--------------------------------------------------
// Configures the resources accounted by the proxy
config.resources = {

    /**
     * Enabled if the resource accounted is Orion Context Broker
     */
    contextBroker: true,

    /**
     * Port where the accounting proxy server is listening to subscription notifications
     */
    notification_port: 9002

};

module.exports = config;