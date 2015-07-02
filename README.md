# Accounting proxy
## Installation
#### Software Requirements:
- NodeJS: [Homepage](http://nodejs.org/).
    + Express Framework: [Homepage](http://expressjs.com/).
    + SQLite3 for NodeJS: [GitHub](https://github.com/mapbox/node-sqlite3).
    + Node Schedule: [GitHub](https://github.com/node-schedule/node-schedule).
    + Commander: [GitHub](https://github.com/tj/commander.js).


To install NodeJS dependencies, execute in the accounting-proxy folder:
```
npm install
```

## Configuration
To configure it, edit 'config.json':
```json
{
    // Endpoint for accounting notifications.
    "accounting_host": "localhost",
    "accounting_port": "9010",

    // Supported accounting units.
    "units": ["call"]
}
```

To manage servicies, use 'cli' tool. See more executing: `./cli -h`

## Running
```
node server
```

# Proxy API

Proxy's api is in port **9001** and root path **/api/..**.

## POST ../users

Use by the store to notify a offer purchase.

## POST ../resources

Use by the store to notify a new resource include in an offer.

## GET ../users/keys

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

# Development

## Accounting module

Accounting modules should be implemented following the next code:

```js
/** Accounting module for unit: XXXXXX */

exports.count = function(request, response, callback) {
    // Code to do the accounting goes here
    // .....

    callback(error, amount);
}
```

The function *count* receives three parameters:
- *request* object.
- *response* object.
- *callback* function, which is use to retrieve the amount to count or the error. The function has 2 parameters:
  + *error* string, with a description of the error if there is one. Otherwise, `undefined`.
  + *ammount* number, with the amount to add to the accounting.

## Database module

Database modules should be implemented following the next code:

```js
// Initialize database
exports.init = function() {...};

// Load all avaliable data from database
exports.loadFromDB = function(setData) {...};

// Update database accounting
exports.count = function(actorID, API_KEY, publicPath, amount) {...};

// Reset accounting to 0
exports.resetCount = function(actorID, API_KEY, publicPath) {...};

// Retrieve resources from an offer
exports.getResources = function(org, name, version, callback) {...};

// Retrieve all resources avaiable in the proxy
exports.loadResources = function(callback) {...};

// Get service from a resource public path
exports.getService = function(publicPath, callback) {...};

// Get API_KEY
exports.getApiKey = function(user, offer, callback) {...};

// Get get price component from a resource in an offer
exports.getAccountingInfo = function(publicPath, offer, callback) {...};

// Add new buy information
exports.addInfo = function(API_KEY, data, callback) {...};

// Get buying reference
exports.getReference = function(API_KEY, callback) {...};

// Get offer information
exports.getOffer = function(API_KEY, callback) {...};

// Get all accounting units information
exports.loadUnits = function(callback) {...};

// Add new resource from resource notification
exports.addResource = function(data, callback) {...};

// CLI: addService [path] [port]
// Add new service
exports.newService = function(path, port, callback) {...};

// CLI: deleteService [path] [port]
// Delete a service
exports.deleteService = function(path, port, callback) {...};

// CLI: getInfo [user]
// Get information about an user
exports.getInfo = function(user, callback) {...};

```

---
Last updated: _02/07/2015_
