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
        * Por where the accounting proxied is listening the Store notifications
        */
        store_port: 9001

};

// Accouning Modules configuration
//--------------------------------------------------
// Configures the accounting modules used by the accounting proxy
config.modules = {

    accounting: [ 'call', 'megabyte']

};


// Resource configuration
//--------------------------------------------------
// Configures the resources accounted by the proxy
config.resources = {

    /* *
    * Enabled if the resource accounted is Orion Context Broker
    */
    contextBroker: true,

    /* *
    * Port where the accounting proxy server is listening to subscription notifications
    */
    notification_port: 9002,

    /** 
    * Host that is being accounted
    */
    host: '130.206.114.99'

};


// WStore sonfiguration
//--------------------------------------------------
// Configures the WStore address and port
config.WStore = {

    /** 
    * WStore host
    */
    accounting_host: 'localhost',

    /** 
    * WStore path for accounting notifications
    */
    accounting_path: '/api/contracting/',

    /** 
    * WStore port
    */
    accounting_port: 9010

};

module.exports = config;
