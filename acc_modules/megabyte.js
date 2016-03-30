/** Accounting module for unit: MEGABYTE */

var specification = {
    name: 'megabyte',
    description: 'Spec for amount of data usage',
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
            value: 'megabyte',
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

var count = function (response, callback) {
    return callback(null, Buffer.byteLength(response, 'utf8') / Math.pow(1024, 2));
};

var getSpecification = function (callback) {
    return callback(specification);
};

exports.count = count;
exports.getSpecification = getSpecification;