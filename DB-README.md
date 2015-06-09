## Database Module ##

The database module should implement the next functions:

#### getResource(organization, name, version, callback) ####

Returns all the resources from the organization through the callback. Put all of then in an array of objets, like:

```
[
    {
        provider: "provider1",
        name: "name1",
        version: "version1"
    },
    {
        provider: "provider2",
        name: "name2",
        version: "version2"
    }
]
```

#### getApiKey(user, offer, reference, callback) ####

Returns the API_KEY through the callbak.

#### addUser(user, reference, resources, offer, API_KEY) ####

Add user to database. Grants access to all resources in 'resources' parameter. The offer parameter looks like:

```
{
    organization: "organization1",
    name: "name1",
    version: "version1"
}
```

#### getPublicPaths(resources, callback) ####

Returns all public paths related with the resources parameter. 'resources' parameter looks like:

```
[
    {
        publicPath: "/path1"
    },
    {
        publicPath: "/path2"
    }
]
```

#### count(user, API_KEY) ####

Add +1 in accounting table for 'user' with this 'API_KEY'.

#### init() ####

Create and connect to database.

#### loadFromDB(callback) ####

Load all database information and returns two objects in the callback function. 'callback' looks like:

```
function(err, data, users) {...}
```

'data' looks like:

```
{
    "/publicPath1": {
        path: "/privatePath1",
        port: "8080",
        users: [...]
    },
    "/publicPath1": {
        path: "/privatePath2",
        port: "8080",
        users: [...]
    }
}
```
The users's array refers to the other 'user' object, that looks like:

```
{
    "1111": {
        API_KEY: "1111",
        id: "user1",
        num: 0
    },
    "1112": {
        API_KEY: "1112",
        id: "user2",
        num: 0
    }
}
```

The users's array refers to the other 'user' object, that looks like:

```
{
    "1111": {
        API_KEY: "1111",
        id: "user1",
        num: 0
    },
    "1112": {
        API_KEY: "1112",
        id: "user2",
        num: 0
    }
}
```

#### newService(private_path, port, callback) ####

Method used by the CLI tool. Add a new service (private_path, port) to DB.

#### deleteService(private_path, port, callback) ####

Method used by the CLI tool. Delete the service (private_path, port) from DB.

#### getInfo(user, callback) ####

Method used by the CLI tools. Retrieve all user information (organization, name, verison, API_KEY). The callback method looks like:

```
function(err, data) {...}
```

If everything goes well in DB, set `err = null`.
If the theres is no info, set `data = undefined`.
If there is data, it must be:

```
[
    {
        organization: "organization1",
        name: "name1",
        version: "version1",
        API_KEY: "1a2b3c"
    },
    {
        organization: "organization2",
        name: "name2",
        version: "version2",
        API_KEY: "1a2b3c"
    }
]
```
