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
```
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

---
Last updated: _02/07/2015_
