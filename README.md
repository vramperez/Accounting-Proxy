# Accounting-Proxy
## Index
* [Deployment](#deployment)
	* [Software requiremnts](#softwarerequirements)
	* [Installation](#installation)
* [Configuration](#configuration)
	* [Basic configuration](#basicconfiguration)
	* [Orion Context Broker Configuration](#orionconfiguration)
	* [Customizing Accounting Proxy for other components](#customizeconfiguration)
* [Authentication](#authentication)
* [Authorization](#authorization)
	* [Administrators](#administrators)
* [Accounting](#accounting)
* [Running](#running)
* [Proxy API](#proxyapi)
* [Development](#development)
	* [Accounting module](#accountingmodule)
	* [Testing](#tests)

## <a name="deployment"/> Deployment

### <a name="softwarerequirements"/> Software Requirements:
 - NodeJS: [Homepage](http://nodejs.org/).
 - Redis: [Homepage](http://redis.io/).

### <a name="installation"/> Installation:


To install NodeJS dependencies, execute in the accounting-proxy folder:
```
npm install
```


## <a name="configuration"/> Configuration
### <a name="basicconfiguration"/> Basic configuration

All the Accounting Proxy configuration is stored in the `config.js` file in the root of the project folder.

In order to have the accounting proxy running there are some information to fill:
* `config.accounting_proxy`: the information of the accounting proxy itself.
 - `port`: port where the accounting proxy server is listening.
```
{
	port: 9000
}
```

* `config.database`: database configuration used by the proxy.
 - `type`: database type. Two possible options: `./db` (sqlite database) or `./db_Redis` (redis database).
 - `name`: database name. If the database type select is redis, then this field select the database (0 to 14; 15 is reserved for testing).
 - `redis_host`: redis database host.
 - `redis_port`: redis database port.
```
{
	type: './db',
    name: 'accountingDB.sqlite',
    redis_host: 'localhost',
    redis_port: 6379
}
```

* `config.modules`:  an array of supported accounting modules for accounting in different ways. Possible options are:
	- `call`: accounting incremented in one unit each time the user send a request.
	- `megabyte`: count the response amount of data  (in megabytes) and add to the actual accounting.
	- `millisecond`: count the request duration (in milliseconds) between the request sending and the response receiving from the service.
```
{
	accounting: [ 'call', 'megabyte', 'millisecond']
}
```
Other accounting modules can be implemented and added here (see  [Accounting module](#accountingmodule) ).


* `config.usageAPI`: the information of the usage management API where the usage specifications and the accounting information will be snet.
	- `host`: API host.
	- `port`: API port.
	- `path`: path for the usage management API.
	- `schedule`: defines the daemon service schedule to notify the usage accounting info. The format is similar to the cron tab format:  "MINUTE HOUR DAY_OF_MONTH MONTH_OF_YEAR DAY_OF_WEEK YEAR (optional)". By the default, the usage notifications will be sent every day at 00:00.
```
{
	host: 'localhost',
    port: 8080,
    path: '/DSUsageManagement/api/usageManagement/v2',
    schedule: '00 00 * * *'
}
```

* `config.resources`: configuration of the resources accounted by the proxy.
	- `contextBroker`: set this option to `true` if the resource accounted is an Orion Context Broker. Otherwise set this option to `false` (default value).
	- `notification_port`: port where the accounting proxy is listening to subscription notifications from the Orion Context Broker (port 9002 by default).
```
{
	contextBroker: false,
	notification_port: 9002
}
```

* `config.api.administration_paths`: configuration of the administration paths. Default accounting paths are:
```
{
	api: {
    	administration_paths: {
            keys: '/accounting_proxy/keys',
            units: '/accounting_proxy/units',
            newBuy: '/accounting_proxy/newBuy',
            checkURL: '/accounting_proxy/urls',
            deleteBuy: '/accounting_proxy/deleteBuy'
    	}
    }
}
```
* `config.oauth2.roles`: configuration of the OAuth2 roles. Default roles are:
```
{
	oauth2: {
    	roles: {
            admin: '106',
            customer: '',
            seller: ''
        }
    }
}
```

### <a name="componentsconfiguration"/> Components configuration
-------------------------------
 The Accounting Proxy can proxied Orion Context Broker and other components by changing some configuration parameters.
 
#### <a name="orionconfiguration"/> Orion Context Broker configuration

The Accounting Proxy supports Context Broker monitoring ([API v1](https://fiware-orion.readthedocs.io/en/develop/index.html) and [API v2](https://fiware-orion.readthedocs.io/en/develop/index.html)). In order to configure the Accounting Proxy working with Orion Context Broker, configure the `resources` section of `config.js` file in the root of the project folder.

* `contextBroker`: set `true` this parameter.
* `notification_port`: port where the accounting proxy server is listening to subscription notifications.
```
{
		contextBroker: true,
		notification_port: 9002
}
```

#### <a name="customizeconfiguration"/> Customizing Accounting Proxy for other components

In order to configure the Accounting Proxy working with other components just set to `false` the contextBroker option in the`config.js`:

* `contextBroker`: set `false` this parameter to disable the Context Broker accounting.
* The rest of information in `config.resources` is unnecessary in this case.


## <a name="authentication"/> Authentication
The authentication process is based on OAuth2 v2 tokens. The Accounting-Proxy expects that all the requests have a header `x-auth-token` containing a valid access token from the IDM or a `authorization` header containing `bearer "token"` where token is a valid access token from the IDM.

## <a name="authorization"/> Authorization
If the authentication process success, the Accounting-Proxy check the authorization. The Accounting-Proxy expects that all the requests have a header `X-API-KEY` containing a valid API-KEY corresponding to the requested service.

### <a name="administrators"/> Administrators
If the user is an administrator of the service, the administrator request must omit the "X-API-KEY" header. After the administrator request is authenticated, the request will be redirected to the service and no accounting will be made.

## <a name="accounting"/> Accounting
The accounting proxy supports accounting based on different units and there is a module for each accounting unit. Developers can implement their own accounting modules (see section [Development](#development)). By default, all Accounting Proxy instances have three accounting modules:
* `call`: accounting value incremented in one for each call to the service.
* `megabyte`: accounting value incremented based on the amount of data retrieved from the service (in megabytes).
* `millisecond`: accounting value incremented based on the request time (in milliseconds).

## <a name="running"/> Running
After [installation](#installation), just execute:
```
node accounting-proxy
```

## <a name="cli"/> CLI

In order to manage servicies, use 'cli' tool. The available commands are:

* `./cli addService [-c] <publicPath> <url> <appId> <httpMethod> [otherHttpMethods...]`: binds the public path with the url specified, the application ID (all request with an access token from a different application will be rejected) and the http method(s) specified. The public path valid patterns are the following:
	-	`/publicPath`: only the first part of the path.
	-	`/this/is/the/final/resource/path?color=Blue&shape=rectangular`: the complete resource path (absolute path). In this case, the proxy will use this path to make the request. Use this type of public paths to register URLs with query strings.
For instance, a public path such as `/public/path` is not valid.

	- Options:
		- `-c, --context-broker`: the service is an Orion Context broker service (`config.contextBroker` must be set to `true` in `config.js`).

* `./cli getService [-p <publicPath>]`: returns the URL, the application ID and the type (Context Broker or not) of all registered services.
	- Options:
		- `-p, --publicPath <path>`: only displays the information of the service specified.

* `./cli deleteService <publicPath>`: deletes the service associated with the public path.
* `./cli addAdmin <userId>`: adds a new administrator.
* `./cli deleteAdmin <userId>`: deletes the specified admin.
* `./cli bindAdmin <userId> <publicPath>`: adds the specified administrator to the service specified by the public path.
* `./cli unbindAdmin <userId> <publicPath>`: deletes the specified administrator for the specified service by its public path.
* `./cli unbindAdmin <userId> <publicPath>`: deletes the specified administrator for the specified service by its public path.
* `./cli getAdmins <publicPath>`: displays all the administrators for the specified service.

To display brief information: `./cli -h` or `./cli --help`. In order to get information for a specific command type: `./cli help [cmd]`.

## <a name="proxyapi"/> Proxy API

Proxy's api is in port **9000** by default and root path **/accounting_proxy/..**.

### POST .../newBuy

Used by the store to notify a new buy:
```json
{
 "orderId": "...",
 "productId": "...",
 "customer": "...",
 "productSpecification": {
	"url": "...",
	"unit": "...",
	"recordType": "..."
 }
}
```
* `orderId`: order identifier.
* `productId`: product identifier.
* `customer`: the userId os the customer.
* `url`: base url of the service.
* `unit`: accounting unit (`megabyte`, `call`, ...).
* `recordType`: type of accounting.

### POST .../deleteBuy

Used by the store to notify a deleted buy:
```json
{
 "orderId": "...",
 "productId": "...",
 "customer": "..."
}
```
* `orderId`: order identifier.
* `productId`: product identifier.
* `customer`: the userId os the customer.

### POST .../urls

Used by the store to check if an URL is valid. This requests require the "authorization" header with a valid access token from the IdM and the user must be an administrator of the service.
```json
{
 "url": "..."
}
```

### GET .../keys

Retrieve the user's API_KEYs in a json. This requests require the "authorization" header with a valid access token from the IdM.

```json
[
	{
    	"apiKey": "...",
        "productId": "...",
        "orderId": "..."
    },
    {
    	"apiKey": "...",
        "productId": "...",
        "orderId": "..."
    }
]
```

### GET .../units

Retrieve the supported accounting units by the accounting proxy in a JSON. This requests require the "authorization" header with a valid access token from the IdM.
```json
{
	"units": ["..."]
}
```

## <a name="development"/> Development

### <a name="accountingmodule"/> Accounting module

Accounting modules in the *acc_modules* folder should be implemented following the next code:

```javascript
/** Accounting module for unit: XXXXXX */

var count = function (countInfo, callback) {
    // Code to do the accounting goes here
    // .....

    return callback(error, amount);
}

// This funciton is optional and only used whith the Context Broker
var subscriptionCount = function (countInfo, callback) {
	// Code to do the Context Broker subscription accounting

	return callback(error, amount);
}

var getSpecification = function () {
	return specification;
}
```

The function `count` receives two parameters:
- `countInfo`: object with the following information:
```
{
	request: { // Request object used by the proxy to make the request to the service.
    	headers: {
        
        },
        body: {
        
        },
        time: ,
        ...
    
    },
    response: { // Response object received from the service.
    	headers: {
        
        },
        body: {
        
        },
        time: ,
        ...
    }
}
```
- `callback`: function, which is use to retrieve the accounting value or the error message. The function has 2 parameters:
  + `error`: string with a description of the error if there is one. Otherwise, `null`.
  + `ammount`: number with the amount to add to the accounting.

The function `subscriptionCount` is an optional count function that only will be called when the proxy receives a valid Context Broker subscription. The arguments are the same as in the `count` function, but in this case the field `time` will be `undefined` in the `countInfo` argument.

The function `getSpecification` should return a javascript object with the usage specification for the accounting unit according to the TMF635 usage management API ([TMF635 usage Management API](https://www.tmforum.org/resources/standard/tmf635-usage-management-api-rest-specification-r14-5-0/)).

Finally, add the name of the developed accounting module to the `config.modules` array in the `config.js` file (the accounting module name is the name of the file, e.g. `megabyte` and `megabyte.js`) and restart the Accounting Proxy.

### <a name="tests"/> Testing
To run tests type:
```
npm test
```
File `test/config_tests.js` contains the configuration for the integration tests:
* `databases`: defines databases used by integration tests. Possible options are: `redis` and `sql`.
* `redis_database`: by default integration tests use 15.
* `redis_host`: redis host for testing.
* `redis_port`: redis port for testing.
* `accounting_proxy_port`: port where the accounting proxy will run for testing.
* `test_endpoint_port`: port where the mock services will run for testing.

```
{
	databases: ['sql', 'redis'],
    redis_database: 15,
    redis_host: 'local_host',
    redis_port: 6379,
    
    accounting_proxy_port: 9010,
    
    test_endpoint_port: 9020
}
```

Test reporter generates a directory `./coverage` with all the coverage information (coverage reporter is generated by Istanbul) and a xunit.xml file in the root directory of the project.

---
Last updated: _07/07/2016
