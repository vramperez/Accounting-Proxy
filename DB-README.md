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
