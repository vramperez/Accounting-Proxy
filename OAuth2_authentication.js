var FIWAREStrategy = require('passport-fiware-oauth').OAuth2Strategy,
    config = require('./config'),
    logger = require('winston');

var db = require(config.database.type);
var FIWARE_STRATEGY = new FIWAREStrategy({
        clientID: ' ',
        clientSecret: ' ',
        callbackURL: ' '
    },

    function (accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        done(null, profile);
    }
);

/**
 * Return the authorization token ['x-auth-token'] or ['authorization']
 *
 * @param  {Object} headers Request headers.
 */
var getAuthToken = function (headers) {

    var authToken = headers['x-auth-token'];

    // Get access token
    if (authToken === undefined) {

        var authHeader = headers['authorization'];

        if (authHeader !== undefined) {
            var spToken = authHeader.split(' ');
            var tokenType = spToken[0].toLowerCase();

            // Token is only set when the header type is Bearer
            // Basic Authorization tokens are NOT allowed
            var VALID_TOKEN_TYPE = 'bearer';

            if (tokenType === VALID_TOKEN_TYPE) {
                authToken = spToken[1];
            } else {
                throw {
                    name: 'InvalidAuthorizationTokenException',
                    message: 'Invalid Auth-Token type (' + tokenType + ')'
                };
            }

        } else {
            throw {
                name: 'AuthorizationTokenNotFound',
                message: 'Auth-token not found in request headers'
            };
        }
    }

    return authToken;
};

/**
 * Return true if the appId of the service is the same that the request appId.
 *
 * @param  {string}   reqAppId Request appId.
 * @param  {Object}   req      Incoming request.
 */
var verifyAppId = function (reqAppId, req, callback) {
    db.getAppId(req.path, function (err, appId) { // Check with the whole path
        if (err) {
            return callback(err, false);
        } else if (appId === reqAppId) {
            req.restPath = '';
            // Public path is the whole path
            req.publicPath = req.path;
            return callback(null, true);
        } else {

            var splitPath = req.path.split('/');
            db.getAppId('/' + splitPath[1], function (err, appId) { // Check with the first part of the path
                if (err) {
                    return callback(err, false);
                } else if (appId === reqAppId) {
                    // Save the path to the endpoint
                    req.restPath = '/' + req.path.substring(splitPath[1].length + 2);
                    // Public path is only the first part of the request path
                    req.publicPath =  '/' + splitPath[1];
                    return callback(null, true);
                } else {
                    return callback(null, false);
                }
            });
        }
    });
};

/**
 * Attach the headers with the user information.
 *
 * @param  {Object} headers  Request headers.
 * @param  {Object} userInfo User information from the IdM.
 */
var attachUserHeaders = function (headers, userInfo) {
    headers.Authorization = 'Bearer ' + userInfo.accessToken;
    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Email'] = userInfo.emails[0].value;
    headers['X-Display-Name'] = userInfo.displayName;
    headers['X-Roles'] = '';

    var roles = [
        config.oauth2.roles.admin,
        config.oauth2.roles.seller,
        config.oauth2.roles.customer
    ];

    for (var i = 0; i < userInfo.roles.length; i++) {
        var role = userInfo.roles[i].id.toLowerCase();
        if (roles.indexOf(role) > -1) {
            headers['X-Roles'] += role + ',';
        }
    }
};

/**
 * Middleware that makes the OAuth2 authentication.
 *
 * @param  {Object}   req  Incoming request.
 * @param  {Object}   res  Outgoing response.
 * @param  {Function} next Next middleware.
 */
exports.headerAuthentication = function (req, res, next) {
    try {
        var authToken = getAuthToken(req.headers);
        FIWARE_STRATEGY.userProfile(authToken, function (err, userProfile) {
            if (err) {
                res.status(401).json({error: 'Invalid Auth-Token'});
                logger.warn('Token ' + authToken + ' invalid');
            } else {
                // Check that the provided access token is valid for the given service
                verifyAppId(userProfile.appId, req, function (err, valid) {
                    if (err) {
                        res.status(500).send();
                        logger.error('Error in database getting the appId');
                    } else if (valid) {
                        req.user = userProfile;
                        req.user.accessToken = authToken;
                        attachUserHeaders(req.headers, userProfile);
                        next();
                    } else {
                        res.status(401).json({error: 'The auth-token scope is not valid for the current application'});
                        logger.warn('Token ' + authToken + ' is from a different app');
                    }
                });
            }
        });

    } catch (err) {
        if (err.name === 'AuthorizationTokenNotFound') {
            res.status(401).json({error: err.message});
        } else {
            logger.warn(err.message);
            res.status(401).json({error: err.message});
        }
    }
};