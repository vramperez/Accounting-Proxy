var data = {

    DEFAULT_TOKEN: 'token',
    DEFAULT_UNIT: 'megabyte',
    DEFAULT_HREF: 'http://example:8080/api',
    DEFAULT_PUBLIC_PATHS: ['/public1', '/public2'],
    DEFAULT_APP_IDS: ['appId1', 'appId2'],
    DEFAULT_URLS: ['http://example:8080/path1', 'http://example:8080/path2'],
    DEFAULT_ID_ADMIN: 'idAdmin',
    DEFAULT_API_KEYS: ['apiKey1', 'apiKey2'],
    DEFAULT_RECORD_TYPE: 'quantity',
    DEFAULT_SUBSCRIPTION_ID: 'subscriptionId',
    DEFAULT_NOTIFICATION_URL: 'http://notification/url',
    DEFAULT_ORDER_IDS: ['orderId1', 'orderId2'],
    DEFAULT_PRODUCT_IDS: ['productId1', 'productId2'],
    DEFAULT_HREF: 'http://localhost/DSUsageManagement/1',
    DEFAULT_USER_ID: 'userId',
    DEFAULT_REQ_PATH: '/public/service',
    DEFAULT_PORT: 9000,
    DEFAULT_SUBS_PATH: '/subscription',
    DEFAULT_UNSUBS_PATH: '/unsubscription',
    DEFAULT_UPDATE_SUBS_PATH: '/updatesubscription',
    DEFAULT_SUBS_ID: 'subsId',
    DEFAULT_DURATION: 'P1M'
};

data.DEFAULT_SUBS_URLS = [
    ['DELETE', data.DEFAULT_UNSUBS_PATH, 'unsubscribe'],
    ['POST', data.DEFAULT_SUBS_PATH, 'subscribe'],
    ['POST', data.DEFAULT_UPDATE_SUBS_PATH, 'updateSubscription']
];

data.DEFAULT_SUBSCRIPTION = {
    apiKey: data.DEFAULT_API_KEYS[0],
    subscriptionId: data.DEFAULT_SUBS_ID,
    unit: data.DEFAULT_UNIT,
    notificationUrl: data.DEFAULT_URLS[0]
};

data.DEFAULT_SUBS_RESPONSE = {
    subscribeResponse: {
        subscriptionId: data.DEFAULT_SUBS_ID,
        duration: data.DEFAULT_DURATION
    }
};

data.DEFAULT_SERVICES = [{
     publicPath: data.DEFAULT_PUBLIC_PATHS[0],
     url: data.DEFAULT_URLS[0],
     appId: data.DEFAULT_APP_IDS[0]
}, {
     publicPath: data.DEFAULT_PUBLIC_PATHS[1],
     url: data.DEFAULT_URLS[1],
     appId: data.DEFAULT_APP_IDS[1]
}];

data.DEFAULT_NOTIFICATION_INFO = [{
    recordType: data.DEFAULT_RECORD_TYPE,
    unit: data.DEFAULT_UNIT,
    orderId: data.DEFAULT_ORDER_IDS[0],
    productId: data.DEFAULT_PRODUCT_IDS[0],
    correlationNumber: '0',
    value: '2'
}];

data.DEFAULT_ADMINISTRATION_PATHS = {
    keys: '/accounting_proxy/keys',
    units: '/accounting_proxy/units',
    newBuy: '/accounting_proxy/buys',
    checkURL: '/accounting_proxy/urls'
};

data.DEFAULT_ROLES = {
    admin: 'adminrole',
    customer: 'customerrole',
    seller: 'sellerrole'
};

data.DEFAULT_USER_PROFILE = {
    appId: data.DEFAULT_APP_IDS[0],
    id: data.DEFAULT_USER_ID,
    emails: [{value: 'user@eexample.com'}],
    displayName: 'user',
    roles: [{id: data.DEFAULT_ROLES.customer}]
};

data.DEFAULT_BUY_INFORMATION = [{
    apiKey: data.DEFAULT_API_KEYS[0],
    publicPath: data.DEFAULT_PUBLIC_PATHS[0],
    orderId: data.DEFAULT_ORDER_IDS[0],
    productId: data.DEFAULT_PRODUCT_IDS[0],
    customer: data.DEFAULT_USER_ID,
    unit: data.DEFAULT_UNIT,
    recordType: data.DEFAULT_RECORD_TYPE
}, {
    apiKey: data.DEFAULT_API_KEYS[1],
    publicPath: data.DEFAULT_PUBLIC_PATHS[1],
    orderId: data.DEFAULT_ORDER_IDS[1],
    productId: data.DEFAULT_PRODUCT_IDS[1],
    customer: data.DEFAULT_USER_ID,
    unit: data.DEFAULT_UNIT,
    recordType: data.DEFAULT_RECORD_TYPE
}];

module.exports = data;