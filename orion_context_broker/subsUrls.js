/**
 * Operation identification table. Each row of the table contains a Context Broker subscribe or delete operations with two fields:
 * the method of the operation and a regular expression to identify the URL.
 */
 module.exports = [

    /* Standard NGSI operations */
    ['POST', /\/(v1\/registry|ngsi9)\/subscribecontextavailability$/, 'create'],
    ['POST', /\/(v1\/registry|ngsi9)\/deletecontextavailability$/, 'delete'],
    ['POST', /\/(v1|ngsi10)\/subscribecontext$/, 'create'],
    ['POST', /\/(v1|ngsi10)\/unsubscribecontext$/, 'delete'],
    ['POST', /\/(v1\/registry|ngsi9)\/updatecontextavailabilitysubscription$/, 'update'],
    ['POST', /\/(v1|ngsi10)\/updatecontextsubscription$/, 'update'],

    /* "Classic" NGSI9 operations */
    ['POST', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions$/, 'create'],
    ['DELETE', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions\/.+/, 'delete'],

    /* "Classic" NGSI10 operations */
    ['POST', /^\/(ngsi10|v1)\/contextsubscriptions$/, 'create'],
    ['DELETE', /^\/(ngsi10|v1)\/contextsubscriptions\/.+/, 'delete'],

    /* V2 Operations */
    ['POST', /^\/v2\/subscriptions$/, 'create'],
    ['PATCH', /^\/v2\/subscriptions\/.+/, 'update'],
    ['DELETE', /^\/v2\/subscriptions\/.+/, 'delete']
];