const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task } = require('../models');
const { ApiError } = require('../middleware/errors');
const { collectionParameters, selectParameter, listResources, getResource } = require('../services/queries');

const encoded = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]));
const badRequest = error => error instanceof ApiError && error.status === 400;

test('collection defaults distinguish omitted limit from explicit zero and count false', () => {
    assert.equal(collectionParameters({}, 100).limit, 100);
    assert.equal(collectionParameters({ limit: '0' }, 100).limit, 0);
    assert.equal(collectionParameters({}).limit, 0);
    assert.equal(collectionParameters({ count: 'false' }).count, false);
    const where = { $or: [{ completed: true }, { _id: { $in: ['a'.repeat(24)] } }] };
    assert.deepEqual(collectionParameters(encoded({ where, sort: { name: -1 }, select: { name: 1, _id: 0 }, skip: 2, limit: 3, count: true })), {
        where, sort: { name: -1 }, select: { name: 1, _id: 0 }, skip: 2, limit: 3, count: true,
    });
});

test('query parameter JSON, object shapes, pagination, and projection are validated', () => {
    for (const name of ['where', 'sort', 'select', 'skip', 'limit', 'count']) {
        assert.throws(() => collectionParameters({ [name]: 'invalid' }), badRequest);
        assert.throws(() => collectionParameters({ [name]: ['0', '1'] }), badRequest);
    }
    for (const name of ['where', 'sort', 'select']) {
        for (const value of [null, [], 'text', 123, true]) {
            assert.throws(() => collectionParameters(encoded({ [name]: value })), badRequest);
        }
    }
    for (const name of ['skip', 'limit']) {
        for (const value of [-1, 1.5, '2', null, true, 1e20]) {
            assert.throws(() => collectionParameters(encoded({ [name]: value })), badRequest);
        }
    }
    for (const value of [1, 'true', null, {}]) assert.throws(() => collectionParameters(encoded({ count: value })), badRequest);
    assert.throws(() => collectionParameters(encoded({ sort: { name: 'asc' } })), badRequest);
    assert.throws(() => selectParameter(encoded({ select: { name: 1, email: 0 } })), badRequest);
    assert.throws(() => selectParameter(encoded({ select: { name: '$email' } })), badRequest);
    assert.throws(() => selectParameter(encoded({ select: { name: 1, 'name-extra': 1, 'name.first': 1 } })), badRequest);
    assert.deepEqual(selectParameter(encoded({ select: { name: 0, _id: 1 } })), { name: 0, _id: 1 });
});

test('filter validation preserves query operators and checks common operand shapes', () => {
    const where = { $and: [{ name: { $regex: '^Example', $options: 'i' } }, { pendingTasks: { $size: 0 } }], _id: { $nin: [] } };
    assert.deepEqual(collectionParameters(encoded({ where })).where, where);
    for (const where of [{ $or: [] }, { $and: {} }, { _id: { $in: 'bad' } }, { pendingTasks: { $all: null } }, { name: { $regex: {} } }, { name: { $exists: 1 } }]) {
        assert.throws(() => collectionParameters(encoded({ where })), badRequest);
    }
    assert.throws(() => collectionParameters(encoded({ where: { name: { $not: { $in: 'bad' } } } })), badRequest);
    assert.throws(() => collectionParameters(encoded({ where: { $where: 1 } })), badRequest);
    assert.throws(() => collectionParameters(encoded({ where: { name: { $regex: 'a', $options: 'z' } } })), badRequest);
    const regex = { name: { $regex: '(?i)example', $options: 'imsxu' } };
    assert.deepEqual(collectionParameters(encoded({ where: regex })).where, regex);
    const expression = { $expr: { $eq: [{ $size: '$pendingTasks' }, 0] } };
    assert.deepEqual(collectionParameters(encoded({ where: expression })).where, expression);
});

test('collection reads delegate every query operation to Mongoose', async t => {
    const calls = [];
    const chain = {};
    for (const method of ['sort', 'select', 'skip', 'limit']) chain[method] = value => { calls.push([method, value]); return chain; };
    chain.lean = async () => ['from database'];
    t.mock.method(Task, 'find', where => { calls.push(['where', where]); return chain; });
    const query = encoded({ where: { completed: true }, sort: { name: -1 }, select: { name: 1 }, skip: 2, limit: 3 });
    assert.deepEqual(await listResources(Task, query), ['from database']);
    assert.deepEqual(calls, [['where', { completed: true }], ['sort', { name: -1 }], ['select', { name: 1 }], ['skip', 2], ['limit', 3]]);
});

test('count ignores valid pagination/projection but validates supplied parameters first', async t => {
    const count = t.mock.method(User, 'countDocuments', async where => { assert.deepEqual(where, { name: 'Example' }); return 7; });
    t.mock.method(User, 'find', () => assert.fail('Count must not fetch documents'));
    assert.equal(await listResources(User, encoded({ where: { name: 'Example' }, skip: 200, limit: 1, select: { _id: 0 }, count: true })), 7);
    await assert.rejects(listResources(User, { count: 'true', limit: '-1' }), badRequest);
    assert.equal(count.mock.callCount(), 1);
});

test('single reads ignore inapplicable parameters and check the URL before select', async t => {
    const id = 'a'.repeat(24);
    t.mock.method(User, 'findById', () => ({ session: async () => ({ _id: id, toObject: () => ({ _id: id, name: 'Example' }) }) }));
    const ignored = { where: 'invalid', sort: '[', skip: '-1', limit: '{}', count: 'not JSON' };
    assert.deepEqual(await getResource(User, id, ignored), { _id: id, name: 'Example' });
    await assert.rejects(getResource(User, 'bad', { select: 'invalid' }), error => error.status === 404);
    await assert.rejects(getResource(User, id, { select: 'invalid' }), badRequest);
});

test('read syntax errors become client errors while unexpected database failures stay unexpected', async t => {
    t.mock.method(User, 'countDocuments', async () => { throw new mongoose.mongo.MongoServerError({ code: 2, errmsg: 'private query detail' }); });
    await assert.rejects(listResources(User, { count: 'true' }), badRequest);
    User.countDocuments.mock.mockImplementation(async () => { throw new mongoose.mongo.MongoServerError({ code: 51108, errmsg: 'private regex option detail' }); });
    await assert.rejects(listResources(User, { count: 'true' }), badRequest);
    User.countDocuments.mock.mockImplementation(async () => { throw new Error("Can't use $unknown with String."); });
    await assert.rejects(listResources(User, { count: 'true' }), badRequest);
    User.countDocuments.mock.mockImplementation(async () => { throw new mongoose.Error("Can't use $unknown"); });
    await assert.rejects(listResources(User, { count: 'true' }), badRequest);
    const failure = new mongoose.mongo.MongoServerError({ code: 13, errmsg: 'private access detail' });
    User.countDocuments.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(listResources(User, { count: 'true' }), error => error === failure);
});
