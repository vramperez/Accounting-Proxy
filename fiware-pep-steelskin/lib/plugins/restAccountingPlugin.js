var config = require('../../config');


'use strict';

/**
 * Determines what is the requested action based on the request methods.
 *
 * @param {Object}   req           Incoming request.
 * @param {Object}   res           Outgoing response.
 * @param {Function} next          Callback for calling the next middleware. This callback should adhere to the
 *                                 following signature: next(error, req, res) where req and res are the received
 *                                 parameters and error is an Error object in case the request should be rejected
 *                                 or null otherwise.
 */
function extractAction(req, res, next) {

    // Check if the request is an administration request
    for(var i = 0; i < config.resource.original.admin_paths.length; i++) {
        if(config.resource.original.admin_paths[i] == req.path){
            req.action = 'Administration';
        }
    }

    if (req.action != 'Administration') {
        switch (req.method) {
            case 'POST':
                req.action = 'create';
                break;
            case 'DELETE':
                req.action = 'delete';
                break;
            case 'PUT':
                req.action = 'update';
                break;
            case 'GET':
                req.action = 'read';
                break;
            default:
                req.action = null;
        }
    }

    req.resourceUrl = req.path;

    next(null, req, res);
}

exports.extractAction = extractAction;