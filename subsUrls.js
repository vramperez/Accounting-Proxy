

/**
 * Operation identification table. Each row of the table contains a Context Broker subscribe or unsubscribe operations with two fields:
 * the method of the operation and a regular expression to identify the URL.
 */
module.exports = [

/* Standard NGSI operations */
  ['POST', /\/(v1\/registry|ngsi9)\/subscribecontextavailability$/, 'subscribe'],
  ['POST', /\/(v1\/registry|ngsi9)\/unsubscribecontextavailability$/, 'unsubscribe'],
  ['POST', /\/(v1|ngsi10)\/subscribecontext$/, 'subscribe'],
  ['POST', /\/(v1|ngsi10)\/unsubscribecontext$/, 'unsubscribe'],

/* "Classic" NGSI9 operations */
  ['POST', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions$/, 'subscribe'],
  ['DELETE', /^\/(ngsi9|v1\/registry)\/contextavailabilitysubscriptions\/.+/, 'unsubscribe'],

/* "Classic" NGSI10 operations */
  ['POST', /^\/(ngsi10|v1)\/contextsubscriptions$/, 'subscribe'],
  ['DELETE', /^\/(ngsi10|v1)\/contextsubscriptions\/.+/, 'unsubscribe'],
];