const mongoose = require('mongoose');
const { ApiError } = require('../middleware/errors');
const { requireResource } = require('./validation');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = message => { throw new ApiError(400, message); };

function parameter(parameters, name, fallback) {
    if (!Object.hasOwn(parameters, name)) return fallback;
    if (typeof parameters[name] !== 'string') invalid(`${name} must be supplied once as JSON.`);
    try { return JSON.parse(parameters[name]); }
    catch { invalid(`${name} must be valid JSON.`); }
}

function fieldMap(value, name, directions) {
    if (!object(value)) invalid(`${name} must be a JSON object.`);
    for (const [field, direction] of Object.entries(value)) {
        if (!field || field.startsWith('$') || !directions.includes(direction)) {
            invalid(`${name} contains an invalid field or direction.`);
        }
    }
    return value;
}

function selectParameter(parameters) {
    const select = fieldMap(parameter(parameters, 'select', {}), 'select', [0, 1]);
    const modes = new Set(Object.entries(select).filter(([field]) => field !== '_id').map(([, value]) => value));
    if (modes.size > 1) invalid('select cannot mix inclusion and exclusion except for _id.');
    for (const field of Object.keys(select)) {
        let parent = field;
        while (parent.includes('.')) {
            parent = parent.slice(0, parent.lastIndexOf('.'));
            if (Object.hasOwn(select, parent)) invalid('select contains overlapping field paths.');
        }
    }
    return select;
}

function pagination(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) invalid(`${name} must be a nonnegative integer.`);
    return value;
}

function validateCondition(condition) {
    // Check common operand shapes without removing valid MongoDB operators.
    for (const [operator, value] of Object.entries(condition)) {
        if (['$in', '$nin', '$all'].includes(operator) && !Array.isArray(value)) invalid(`${operator} needs an array.`);
        if (operator === '$exists' && typeof value !== 'boolean') invalid('$exists needs a boolean.');
        if (operator === '$size') pagination(value, '$size');
        if (['$regex', '$options', '$where'].includes(operator) && typeof value !== 'string') invalid(`${operator} needs a string.`);
        if (operator === '$options' && !/^[imsxu]*$/.test(value)) invalid('$options contains an unsupported regex option.');
        if (operator === '$not') {
            if (!object(value)) invalid('$not needs an operator object.');
            validateCondition(value);
        }
        if (operator === '$elemMatch') validateFilter(value);
    }
}

function validateFilter(filter) {
    if (!object(filter)) invalid('where must be a JSON object.');
    for (const [field, condition] of Object.entries(filter)) {
        if (['$and', '$or', '$nor'].includes(field)) {
            if (!Array.isArray(condition) || condition.length === 0) invalid(`${field} needs a non-empty list of filters.`);
            condition.forEach(validateFilter);
        } else if (field.startsWith('$')) {
            // Expression/schema operands have their own grammar, validated by MongoDB.
            if (!['$expr', '$jsonSchema'].includes(field)) validateCondition({ [field]: condition });
        } else if (object(condition)) validateCondition(condition);
    }
    return filter;
}

function collectionParameters(parameters, defaultLimit = 0) {
    const where = validateFilter(parameter(parameters, 'where', {}));
    const sort = fieldMap(parameter(parameters, 'sort', {}), 'sort', [1, -1]);
    const select = selectParameter(parameters);
    const skip = pagination(parameter(parameters, 'skip', 0), 'skip');
    const limit = pagination(parameter(parameters, 'limit', defaultLimit), 'limit');
    const count = parameter(parameters, 'count', false);
    if (typeof count !== 'boolean') invalid('count must be a boolean.');
    return { where, sort, select, skip, limit, count };
}

async function executeRead(query) {
    try { return await query; }
    catch (error) {
        // Query syntax errors are client errors; connectivity/permission failures remain 500.
        if (error instanceof mongoose.mongo.MongoServerError &&
            [2, 9, 14, 72, 168, 31249, 31250, 31254, 51091, 51108].includes(error.code)) {
            invalid('Query contains an invalid filter or projection.');
        }
        if (error instanceof Error && /^Can't use \$\w+(?: with |$)/.test(error.message)) {
            invalid('Query contains an invalid field operator.');
        }
        throw error;
    }
}

async function listResources(Model, parameters) {
    const options = collectionParameters(parameters, Model.modelName === 'Task' ? 100 : 0);
    // Project decision: count all matches before pagination, even when limit/skip are supplied.
    if (options.count) return executeRead(Model.countDocuments(options.where));
    return executeRead(Model.find(options.where).sort(options.sort).select(options.select)
        .skip(options.skip).limit(options.limit).lean());
}

async function getResource(Model, id, parameters) {
    // Check the resource first; no collection parameter is read or parsed here.
    const resource = await requireResource(Model, id);
    const select = selectParameter(parameters);
    if (Object.keys(select).length === 0) return resource.toObject();
    const selected = await executeRead(Model.findById(resource._id).select(select).lean());
    if (!selected) throw new ApiError(404, `${Model.modelName} not found.`);
    return selected;
}

module.exports = { collectionParameters, selectParameter, listResources, getResource };
