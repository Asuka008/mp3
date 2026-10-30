const mongoose = require('mongoose');
const { ApiError } = require('../middleware/errors');
const { userPayload, taskPayload } = require('./validation');

function requireTransaction(session) {
    if (!session || !session.inTransaction()) {
        throw new ApiError(500, 'An active database transaction is required.');
    }
}

async function atomicWrite(work) {
    // The callback may be retried: keep HTTP responses and other side effects outside it.
    return mongoose.connection.transaction(async (session) => {
        requireTransaction(session);
        return work(session);
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}

async function saveReplacement(document, payload, session) {
    requireTransaction(session);
    const replacement = document.constructor.modelName === 'User' ? userPayload(payload) : taskPayload(payload);
    // overwrite() preserves immutable dateCreated and _id; builders strip all internal input.
    document.overwrite(replacement);
    return document.save({ session });
}

module.exports = { atomicWrite, saveReplacement };
