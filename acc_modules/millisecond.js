/** Accounting module for unit: millisecond */
var moment = require('moment');

var specification = {
    name: 'millisecond',
    description: 'Spec for time usage',
    usageSpecCharacteristic: [{
        name: 'orderId',
        description: 'Order identifier',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: false,
            value: '',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'productId',
        description: 'Product identifier',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: false,
            value: '',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'correlationNumber',
        description: 'Accounting correlation number',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'number',
            default: false,
            value: '',
            valueFrom: '0',
            valueTo: ''
        }]
    }, {
        name: 'unit',
        description: 'Accounting unit',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'string',
            default: true,
            value: 'millisecond',
            valueFrom: '',
            valueTo: ''
        }]
    }, {
        name: 'value',
        description: 'Accounting value',
        configurable: false,
        usageSpecCharacteristicValue: [{
            valueType: 'number',
            default: false,
            value: '',
            valueFrom: '0',
            valueTo: ''
        }]
    }]
};

var count = function (countInfo, callback) {
    if (countInfo.request.time === undefined || countInfo.response.time === undefined) {
        return callback(null, 0);
    } else {
        return callback(null, countInfo.response.time - countInfo.request.time);
    }
};

var subscriptionCount = function (countInfo, callback) {
    return callback(null, moment.duration(countInfo.request.duration).asMilliseconds());
};

var getSpecification = function (callback) {
    return callback(specification);
};

exports.count = count;
exports.getSpecification = getSpecification;
exports.subscriptionCount = subscriptionCount;