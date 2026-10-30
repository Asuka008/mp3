const sendResponse = require('../utils/response');
const mongoose = require('mongoose');

// Only use this class with safe, human-readable messages written by the API.
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function notFound(req, res, next) {
    next(new ApiError(404, 'Route not found.'));
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        return sendResponse(res, err.status, err.message);
    }

    if (err.code === 11000 && err.keyPattern && Object.hasOwn(err.keyPattern, 'email')) {
        return sendResponse(res, 400, 'A user with this email already exists.');
    }

    if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError ||
        err instanceof mongoose.Error.StrictModeError) {
        return sendResponse(res, 400, 'Request contains invalid field values.');
    }

    if (err.type === 'entity.parse.failed') {
        return sendResponse(res, 400, 'Request body is not valid JSON.');
    }

    if (err.type === 'entity.too.large' || err.type === 'parameters.too.many') {
        return sendResponse(res, 413, 'Request body is too large.');
    }

    if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
        return sendResponse(res, 415, 'Request body encoding is not supported.');
    }

    // Never return raw database errors, request bodies, or environment values.
    return sendResponse(res, 500, 'An unexpected server error occurred.');
}

module.exports = { ApiError, notFound, errorHandler };
