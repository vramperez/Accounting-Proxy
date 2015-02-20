# Accounting proxy
## Installation
#### Software Requirements:
- NodeJS with npm: [Homepage](http://nodejs.org/).
    + Express Framework: [Homepage](http://expressjs.com/).
    + MySQL for NodeJS: [GitHub](https://github.com/felixge/node-mysql).
- MySQL server.

#### Configuration:
To install NodeJS dependencies, execute in the accounting-proxy folder:
```
npm install
```

To configure it, open 'config' and complete the fields with your configuration:
```
config.app_host = 'google.com'; // Hostname to forward request
config.app_port = '80';         // Port where is running

config.sql = {
    user: 'user1',              // SQL Database user
    password: 'psswd',          // SQL Database password
    host: 'localhost',          // SQL Database server hostname
    port: '1234'                // SQL Database server pot
};
```

#### Running proxy server:
```
node server
```

---
Last updated: _19/02/2015_