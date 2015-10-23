var config = {};

// Accounting proxy configuration
//--------------------------------------------------
// Configures the address and ports for the accounting proxy
config.accounting_proxy = {
        /**
         * Accounting proxy host.
         */
        host: 'localhost',

        /**
         * Port where the accounting proxy server is listening.
         */
        port: 9000

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


// Resource sonfiguration
//--------------------------------------------------
// Configures the resources accounted by the proxy
config.resources = {

    // Enabled if the resource accounted is Orion Context Broker
    contextBroker: true

}
