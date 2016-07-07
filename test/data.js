var data = {

    DEFAULT_TOKEN: 'token',
    DEFAULT_UNIT: 'megabyte',
    DEFAULT_HREFS: ['http://localhost:9040/usageSpecification/1', 'http://localhost:9040/usageSpecification/2'],
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
    DEFAULT_USER_ID: 'userId',
    DEFAULT_REQ_PATH: '/public/service',
    DEFAULT_PORT: 9000,
    DEFAULT_SUBS_PATH: '/subscription',
    DEFAULT_UNSUBS_PATH: '/unsubscription',
    DEFAULT_UPDATE_SUBS_PATH: '/updatesubscription',
    DEFAULT_SUBS_ID: 'subsId',
    DEFAULT_DURATION: 'P1M',
    DEFAULT_EXPIRES: '2016-10-10T14:00:00.00Z',
    DEFAULT_IS_CB_SERVICE: true,
    DEFAULT_IS_NOT_CB_SERVICE: false,
    DEFAULT_HTTP_METHODS_LIST: ['GET', 'POST', 'PUT', 'DELETE']
};

data.DEFAULT_HTTP_METHODS_STRING = data.DEFAULT_HTTP_METHODS_LIST.join(',');

data.DEFAULT_SUBS_URLS = [
    ['DELETE', data.DEFAULT_UNSUBS_PATH, 'delete'],
    ['POST', data.DEFAULT_SUBS_PATH, 'create'],
    ['POST', data.DEFAULT_UPDATE_SUBS_PATH, 'update']
];

data.DEFAULT_SUBSCRIPTION_v1 = {
    apiKey: data.DEFAULT_API_KEYS[0],
    subscriptionId: data.DEFAULT_SUBS_ID,
    unit: data.DEFAULT_UNIT,
    notificationUrl: data.DEFAULT_URLS[0],
    expires: null,
    version: 'v1'
};

data.DEFAULT_SUBSCRIPTION_v2 = {
    apiKey: data.DEFAULT_API_KEYS[0],
    subscriptionId: data.DEFAULT_SUBS_ID,
    unit: data.DEFAULT_UNIT,
    notificationUrl: data.DEFAULT_URLS[0],
    expires: data.DEFAULT_EXPIRES,
    version: 'v2'
};

data.DEFAULT_SUBS_RESPONSE = {
    subscribeResponse: {
        subscriptionId: data.DEFAULT_SUBS_ID,
        duration: data.DEFAULT_DURATION
    }
};

data.DEFAULT_SERVICES_LIST = [{
    publicPath: data.DEFAULT_PUBLIC_PATHS[0],
    url: data.DEFAULT_URLS[0],
    appId: data.DEFAULT_APP_IDS[0],
    isCBService: false,
    methods: data.DEFAULT_HTTP_METHODS_LIST
}, {
    publicPath: data.DEFAULT_PUBLIC_PATHS[1],
    url: data.DEFAULT_URLS[1],
    appId: data.DEFAULT_APP_IDS[1],
    isCBService: true,
    methods: data.DEFAULT_HTTP_METHODS_LIST
}];

data.DEFAULT_SERVICES_STRING = [{
    publicPath: data.DEFAULT_PUBLIC_PATHS[0],
    url: data.DEFAULT_URLS[0],
    appId: data.DEFAULT_APP_IDS[0],
    isCBService: '0',
    methods: data.DEFAULT_HTTP_METHODS_STRING
}, {
    publicPath: data.DEFAULT_PUBLIC_PATHS[1],
    url: data.DEFAULT_URLS[1],
    appId: data.DEFAULT_APP_IDS[1],
    isCBService: '1',
    methods: data.DEFAULT_HTTP_METHODS_STRING
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
    newBuy: '/accounting_proxy/newBuy',
    checkURL: '/accounting_proxy/urls',
    deleteBuy: '/accounting_proxy/deleteBuy'
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

data.DEFAULT_DELETE_BUY_INFORMATION = [{
    orderId: data.DEFAULT_ORDER_IDS[0],
    productId: data.DEFAULT_PRODUCT_IDS[0],
    customer: data.DEFAULT_USER_ID
}, {
    orderId: data.DEFAULT_ORDER_IDS[1],
    productId: data.DEFAULT_PRODUCT_IDS[1],
    customer: data.DEFAULT_USER_ID
}];

data.room1 = {
    contextElement: {
        attributes: [
        {
            name: "temperature",
            type: "float",
            value: "23"
        },
        {
            name: "pressure",
            type: "integer",
            value: "720"
        }
        ],
        id: "Room1",
        isPattern: "false",
        type: "Room"
    },
    statusCode: {
        code: "200",
        reasonPhrase: "OK"
    }
};

data.allEntities = {
    contextResponses: [
    {
        contextElement: {
            attributes: [
            {
                name: "temperature",
                type: "float",
                value: "23"
            },
            {
                name: "pressure",
                type: "integer",
                value: "720"
            }
            ],
            id: "Room1",
            isPattern: "false",
            type: ""
        },
        statusCode: {
            code: "200",
            reasonPhrase: "OK"
        }
    },
    {
        contextElement: {
            attributes: [
            {
                name: "temperature",
                type: "float",
                value: "21"
            },
            {
                name: "pressure",
                type: "integer",
                value: "711"
            }
            ],
            id: "Room2",
            isPattern: "false",
            type: ""
        },
        statusCode: {
            code: "200",
            reasonPhrase: "OK"
        }
    }
    ]
};

data.newEntityReq = {
    "attributes": [
        {
            "name": "temperature",
            "type": "float",
            "value": "23"
        },
        {
            "name": "pressure",
            "type": "integer",
            "value": "720"
        }
    ]
};

data.newEntityResp = {
    "contextResponses": [
        {
            "attributes": [
                {
                    "name": "temperature",
                    "type": "float",
                    "value": ""
                },
                {
                    "name": "pressure",
                    "type": "integer",
                    "value": ""
                }
            ],
            "statusCode": {
                "code": "200",
                "reasonPhrase": "OK"
            }
        }
    ],
    "id": "Room1",
    "isPattern": "false",
    "type": ""
};

data.createSubscriptionReqV1 = {
    "entities": [
    {
        "type": "Room",
        "isPattern": "false",
        "id": "Room1"
    }
    ],
    "attributes": [
    "temperature"
    ],
    "reference": "http://localhost:1028/accumulate",
    "duration": "P1M",
    "notifyConditions": [
    {
        "type": "ONCHANGE",
        "condValues": [
        "pressure"
        ]
    }
    ],
    "throttling": "PT5S"
};

data.createSubscriptionRespV1 = {
    "subscribeResponse": {
        "duration": "P1M",
        "subscriptionId": data.DEFAULT_SUBS_ID
    }
};

data.updateSubscriptionReq = {
    "subscriptionId": data.DEFAULT_SUBS_ID,
    "duration": "P2M"
};

data.updateSubscriptionResp = {
    "subscribeResponse": {
        "subscriptionId": data.DEFAULT_SUBS_ID,
        "duration": "P2M"
    }
};

data.updateExpirationDateAfter = {
    "expires": "2100-04-05T14:00:00.00Z"
};

data.updateExpirationDateBefore = {
    "expires": "1990-04-05T14:00:00.00Z"
};

data.updateNotificationUrl = {
    "notification": {
        "http": {
            "url": "http://localhost:1236"
        }
    }
};

data.cancelSubscriptionReq = {
    "subscriptionId": data.DEFAULT_SUBS_ID
};

data.cancelSubscriptionResp = {
    "statusCode": {
        "code": "200",
        "reasonPhrase": "OK"
    },
    "subscriptionId": data.DEFAULT_SUBS_ID
};

data.createSubscriptionReqV2 = {
  "description": "One subscription to rule them all",
  "subject": {
    "entities": [
      {
        "idPattern": ".*",
        "type": "Room"
      }
    ],
    "condition": {
      "attrs": [
        "temperature"
      ],
      "expression": {
        "q": "temperature>40"
      }
    }
  },
  "notification": {
    "http": {
      "url": "http://localhost:1234"
    },
    "attrs": [
      "temperature",
      "humidity"
    ]
  },
  "expires": data.DEFAULT_EXPIRES,
  "throttling": 5
};

module.exports = data;