# Accounting proxy
## Installation
#### Software Requirements:
- NodeJS: [Homepage](http://nodejs.org/).
    + Express Framework: [Homepage](http://expressjs.com/).
    + SQLite3 for NodeJS: [GitHub](https://github.com/felixge/node-mysql).
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

---
Last updated: _02/07/2015_
