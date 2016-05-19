var data = {

    DEFAULT_TOKEN: 'token',
    DEFAULT_UNIT: 'megabyte',
    DEFAULT_HREF: 'http://example:8080/api',
    DEFAULT_PUBLIC_PATHS: ['/public1', '/public2'],
    DEFAULT_APP_IDS: ['appId1', 'appId2'],
    DEFAULT_URLS: ['http://example:8080/path1', 'http://example:8080/path2'],
    DEFAULT_ID_ADMIN: 'idAdmin',
    DEFAULT_USER: '0001',
    DEFAULT_API_KEYS: ['apiKey1', 'apiKey2'],
    DEFAULT_RECORD_TYPE: 'quantity',
    DEFAULT_SUBSCRIPTION_ID: 'subscriptionId',
    DEFAULT_NOTIFICATION_URL: 'http://notification/url',
    DEFAULT_ORDER_IDS: ['orderId1', 'orderId2'],
    DEFAULT_PRODUCT_IDS: ['productId1', 'productId2'],
    DEFAULT_HREF: 'http://localhost/DSUsageManagement/1'
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

data.DEFAULT_BUY_INFORMATION = {
     apiKey: data.DEFAULT_API_KEYS[0],
     publicPath: data.DEFAULT_PUBLIC_PATHS[0],
     orderId: data.DEFAULT_ORDER_IDS[0],
     productId: data.DEFAULT_PRODUCT_IDS[0],
     customer: data.DEFAULT_USER,
     unit: data.DEFAULT_UNIT,
     recordType: data.DEFAULT_RECORD_TYPE
};

module.exports = data;