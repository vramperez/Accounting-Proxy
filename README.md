# accounting-proxy
## Index
* [Deployment](#deployment)
	* [Software requiremnts](#softwarerequirements)
	* [Installation](#installation) 
* [Configuration](#configuration)
	* [Basic configuration](#basicconfiguration) 	
	* [Orion Context Broker Configuration](#orionconfiguration)
	* [Customizing Accounting Proxy for other components](#customizeconfiguration)
* [Running](#running)
* [Proxy API](#proxyapi)
* [Development](#development)
	* [Accounting module](#accountingmodule)

## <a name="deployment"/> Deployment
#### <a name="softwarerequirements"/> Software Requirements:
- NodeJS: [Homepage](http://nodejs.org/).
    + Express Framework: [Homepage](http://expressjs.com/).
    + Redis for NodeJs: [GitHub](https://github.com/NodeRedis/node_redis)
    + Node Schedule: [GitHub](https://github.com/node-schedule/node-schedule).
    + Commander: [GitHub](https://github.com/tj/commander.js).
    + Fiware PEP-Proxy: [GitHub](https://github.com/telefonicaid/fiware-pep-steelskin).
    + Orion Context Broker: [Homepage](http://fiware-orion.readthedocs.org/en/develop/index.html).

#### <a name="installation"/> Installation:


To install NodeJS dependencies, execute in the accounting-proxy folder:
```
npm install
```


## <a name="configuration"/> Configuration
### <a name="basicconfiguration"/> Basic configuration

All the Accounting Proxy configuration is stored in the `config.js` file in the root of the project folder.

In order to have the accounting proxy running there are some information to fill:

* `config.accounting_proxy`: the information of the accounting proxy itself.
 - `port`: port where the accounting proxy server is listening to client requests.
 - `store_port`:  port where the accounting proxy is listening to WStore notifications.
 
```js
{
        port: 9000,
        store_port: 9001
}
```
* `config.modules`:  an array of accounting modules for accounting in different ways.

```js
{
    accounting: [ 'call', 'megabyte']
}
```
* `config.WStore`: the information of the WStore server.
	- `accounting_host`: WStore host.
	- `accounting_path`: WStore path for accounting notifications.
	- `accounting_port`: Wstore port.

```js
config.WStore = {
    accounting_host: 'localhost',
    accounting_path: '/api/contracting/',
    accounting_port: 9010
}
```

### <a name="componentsconfiguration"/> Components configuration
-------------------------------
 The Accounting Proxy can proxied Orion Context Broker and other components by changing some configuration parameters.
#### <a name="orionconfiguration"/> Orion Context Broker configuration
In order to configure the Accounting Proxy working with Orion Context Broker there are some steps to follow:
* First, configure the `config.resources` section of `config.js` file in the root of the project folder.
	- `contextBroker`: set `true` this parameter.
	- `notification_port`: port where the accounting proxy server is listening to subscription notifications.
	- `host`: Context Broker host that is going to be proxied.
```js
{
    contextBroker: true,
    notification_port: 9002,
    host: 'localhost'
}
```

* After that, copy the `./pep-proxy/config.js` file into your PEP-Proxy folder and overwrite the existing `config.js` file.
* Then, copy the `./pep-proxy/accountingPlugin.js` file into your PEP-Proxy plugins folder (`fiware-pep-steelskin/lib/plugins`).
* Finally, configure the PEP-Proxy `config.js` file copied in the previous step:
	- `config.resource.original.host`: the Accounting Proxy host.
	- `port`: the Accounting Proxy port (the same previously configured in the Accounting Proxy `config.js` as `config.accounting_proxy.port`, 9000 by default).
	- `admin_port` : the Accounting Proxy port where administration accounting proxy is listening (the same previously configured in the Accounting Proxy `config.js` as `config.accounting_proxy.store_port`, 9001 by default).
	- `admin_paths`: the administration paths used by WStore to notify the Accounting Proxy. (Do not change it).
```js
{
        host: 'localhost',
        port: 9000,
        admin_port: 9001,
        admin_paths: ['/api/users', '/api/resources']
}
```


#### <a name="customizeconfiguration"/> Customizing Accounting Proxy for other components

In order to configure the Accounting Proxy working with other components follow this two steps:

* First, configure the `config.resources` section of `config.js` file in the root of the project folder.
	- `contextBroker`: set `false` this parameter to disable the Context Broker accounting.
	- The rest of information in `config.resources` is unnecessary in this case.

* Then, configure the PEP-Proxy `config.js` file for generic REST Middleware ( https://github.com/telefonicaid/fiware-pep-steelskin#generic-rest-middleware).




## <a name="running"/> Running
Before run the Accounting Proxy you must have the PEP-Proxy and the Orion Context Broker running.

Then, execute:
```
node server
```

## <a name="cli"/> CLI

In order to manage servicies, use 'cli' tool. There are four commands available:
* `./cli addService <publicPath> <privatePath> <port>`: binds the public path with the private path and port specified.
* `./cli getService <publicPath>`: returns the private path and port associated with the public path.
* `./cli deleteService <publicPath>`: delete the service associated with the public path.
* `./cli getInfo <userID>`: returns information associated with the userID.

To display brief information: `./cli -h`

## <a name="proxyapi"/> Proxy API

Proxy's api is in port **9001** and root path **/api/..**.

### POST ../users

Use by the store to notify a offer purchase. Format example:
```json
{
    "offering": {
        "organization": "...",
        "name": "...",
        "version": "..."
    },
    "provider": "...",
    "name": "...",
    "version": "...",
    "content_type":"...",
    "url": "http://...",
    "record_type": "...",
    "unit": "...",
    "component_label": "..."
}
```
* `unit`: accounting unit (`megabyte`, `call`, ...).

### POST ../resources

Use by the store to notify a new resource include in an offer. Format example:
```json
{
  "offering": {
    "organization": "...",
    "name": "...",
    "version": "..."
  },
  "reference": "...",
  "customer": "...",
  "customer_name": "...",
  "resources": 
 [
    {
      "provider": "...",
      "name": "...",
      "version": "...",
      "content_type":"...",
      "url": "http://..."
    },
    {
      "provider": "...",
      "name": "...",
      "version": "...",
      "content_type":"...",
      "url": "http://..."
    }
  ]
}
```

### GET ../users/keys

Retrieve the user's API_KEYs in a json:

```json
[
    {
        " offering": {
            "organization": "...",
            "name": "...",
            "version": "..."
        },
        "API_KEY": "..."
    },
    ...
]
```

## <a name="development"/> Development

### <a name="accountingmodule"/> Accounting module

Accounting modules should be implemented following the next code:

```js
/** Accounting module for unit: XXXXXX */

exports.count = function(response, callback) {
    // Code to do the accounting goes here
    // .....

    callback(error, amount);
}
```

The function *count* receives three parameters:
- `response` object.
- `callback` function, which is use to retrieve the amount to count or the error. The function has 2 parameters:
  + `error` string, with a description of the error if there is one. Otherwise, `undefined`.
  + `ammount` number, with the amount to add to the accounting.


---
Last updated: _06/11/2015_
