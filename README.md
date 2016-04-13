# accounting-proxy
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
* [Running](#running)
* [Proxy API](#proxyapi)
* [Development](#development)
	* [Accounting module](#accountingmodule)
	* [Testing](#tests)

## <a name="deployment"/> Deployment
### <a name="softwarerequirements"/> Software Requirements:
- NodeJS: [Homepage](http://nodejs.org/).
    + Express Framework: [Homepage](http://expressjs.com/).
    + Redis for NodeJs: [GitHub](https://github.com/NodeRedis/node_redis)
    + Node Schedule: [GitHub](https://github.com/node-schedule/node-schedule).
    + Commander: [GitHub](https://github.com/tj/commander.js).
    + Orion Context Broker: [Homepage](http://fiware-orion.readthedocs.org/en/develop/index.html).

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

* `config.database`: database configuration used by the proxy. Possible options:
 - `type`: database type. Two possible options: `./db` (slite database) or `./db_Redis` (redis database).
 - `name`: database name. If the database type select is redis, then this field select the database (0 to 14; 15 is reserved for testing).
```
{
		type: './db',
    	name: 'accountingDB.sqlite'
}
```

* `config.modules`:  an array of supported accounting modules for accounting in different ways. Possible options are:
	- `call`: accounting incremented in one unit each time the user send a request.
	- `megabyte`: count the response amount of data  (in megabytes) and add to the actual accounting.
```
{
		accounting: [ 'call', 'megabyte']
}
```
Other accounting modules can be implemented and added here (see  [Accounting module](#accountingmodule) ).


* `config.usageAPI`: the information of the usage management API where the usage specifications and the accounting information will be snet.
	- `host`: API host.
	- `port`: API port.
	- `path`: path for the usage management API.
```
{
        host: 'localhost',
        port: 8080,
        path: '/DSUsageManagement/api/usageManagement/v2'
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

* `config.api.administration_paths`: configuration of the administration paths.
* `config.oauth2.roles`: configuration of the OAuth2 roles.

### <a name="componentsconfiguration"/> Components configuration
-------------------------------
 The Accounting Proxy can proxied Orion Context Broker and other components by changing some configuration parameters.
#### <a name="orionconfiguration"/> Orion Context Broker configuration
In order to configure the Accounting Proxy working with Orion Context Broker there are some steps to follow:
* First, configure the `config.resources` section of `config.js` file in the root of the project folder.
	- `contextBroker`: set `true` this parameter.
	- `notification_port`: port where the accounting proxy server is listening to subscription notifications.
```
{
		contextBroker: true,
		notification_port: 9002
}
```

#### <a name="customizeconfiguration"/> Customizing Accounting Proxy for other components

In order to configure the Accounting Proxy working with other components follow this two steps:

* First, configure the `config.resources` section of `config.js` file in the root of the project folder.
	- `contextBroker`: set `false` this parameter to disable the Context Broker accounting.
	- The rest of information in `config.resources` is unnecessary in this case.


## <a name="authentication"/> Authentication
The authentication process is based on OAuth2 v2 tokens. The Accounting-Proxy expects that all the requests have a header `x-auth-token` containing a valid access token from the IDM or a `authorization` header containing `bearer "token"` where token is a valid access token from the IDM.

## <a name="authorization"/> Authorization
If the authentication process success, the Accounting-Proxy check the authorization. The Accounting-Proxy expects that all the requests have a header `X-API-KEY` containing a valid API-KEY corresponding to the requested service.

### <a name="administrators"/> Administrators
If the user is an administrator of the service, the administrator request must omit the "X-API-KEY" header. After the administrator request is authenticated, the request will be redirected to the service and no accounting will be made.

## <a name="running"/> Running
Just execute:
```
node accounting-proxy
```

## <a name="cli"/> CLI

In order to manage servicies, use 'cli' tool. The available commands are:
* `./cli addService <publicPath> <url> <appId>`: binds the public path with the url specified.
* `./cli getService <publicPath>`: returns the url and appID associated with the public path.
* `./cli getAllServices`: display all the registered services (public path, URL and appId).
* `./cli deleteService <publicPath>`: delete the service associated with the public path.
* `./cli addAdmin <userId>: add a new administrator.
* `./cli deleteAdmin <userId>`: delete the specified admin.
* `./bindAdmin <userId> <publicPath>`: add the specified administrator to the service specified by the public path.
* `./cli unbindAdmin <userId> <publicPath>`: delete the specified administrator for the specified service by its public path.
* `./cli unbindAdmin <userId> <publicPath>`: delete the specified administrator for the specified service by its public path.
* `./getAdmins <publicPath>`: display all the administrator for the specified service.

To display brief information: `./cli -h` or `./cli --help`.

## <a name="proxyapi"/> Proxy API

Proxy's api is in port **9000** by default and root path **/accounting_proxy/..**.

### POST ../buys

Use by the store to notify a new buy:
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
* `unit`: accounting unit (`megabyte`, `call`, ...).

### POST ../urls

Use by the store to check an URL:
```json
{
 "url": "..."
}
```

### GET ../keys

Retrieve the user's API_KEYs in a json:

```json
[
	{
    	"apiKey": "...",
        "productId": "...",
        "orderId": "..."
    }
]
```

### GET /units

Retrieve the supported accounting units by the accounting proxy in a JSON:
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

var count = function (response, callback) {
    // Code to do the accounting goes here
    // .....

    return callback(error, amount);
}

var getSpecification = function (callback) {
	return callback(specification);
}
```

The function `count` receives three parameters:
- `response` object.
- `callback` function, which is use to retrieve the amount to count or the error. The function has 2 parameters:
  + `error` string, with a description of the error if there is one. Otherwise, `undefined`.
  + `ammount` number, with the amount to add to the accounting.

The function `getSpecification` should return a javascript object with the usage specification for the accounting unit according to the TMF635 usage management API ([TMF635 usage Management API](https://www.tmforum.org/resources/standard/tmf635-usage-management-api-rest-specification-r14-5-0/)).

### <a name="tests"/> Testing
To run tests type:
```
npm test
```
Test reporter generates a directory `./coverage` with all the coverage information (coverage reporter is generated by Istanbul).

---
Last updated: _01/04/2016
