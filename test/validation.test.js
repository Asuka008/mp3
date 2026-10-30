const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task } = require('../models');
const { userPayload, taskPayload, requireResource, prepareUserWrite, prepareTaskWrite } = require('../services/validation');
const { atomicWrite, saveReplacement } = require('../services/writes');
const { ApiError, errorHandler } = require('../middleware/errors');

const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const taskId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const missingId = 'cccccccccccccccccccccccc';
const userBody = { name: 'Example', email: 'any-domain-is-allowed' };
const taskBody = { name: 'Example', deadline: '2000-01-01' };
const status = expected => error => error instanceof ApiError && error.status === expected;
const query = value => ({ session: () => Promise.resolve(value) });

test('schemas provide server dates/defaults and keep public references as strings', async () => {
    const user = new User(userPayload(userBody));
    const other = new User(userPayload(userBody));
    const task = new Task(taskPayload(taskBody));
    await user.validate();
    await task.validate();
    user.pendingTasks.push(taskId);
    assert.deepEqual(other.pendingTasks.toObject(), []);
    assert.equal(typeof user.pendingTasks[0], 'string');
    assert.ok(user.dateCreated instanceof Date);
    assert.ok(task.dateCreated instanceof Date);
    assert.equal(task.description, '');
    assert.equal(task.completed, false);
    assert.equal(task.assignedUser, '');
    assert.equal(task.assignedUserName, 'unassigned');
    assert.equal(User.schema.path('dateCreated').options.immutable, true);
    assert.equal(Task.schema.path('assignedUser').options.ref, undefined);
});

test('required strings are not coerced by builders or models', async () => {
    for (const value of [undefined, null, 42, {}, [], true, '', '   ']) {
        assert.throws(() => userPayload({ ...userBody, name: value }), status(400));
        assert.throws(() => userPayload({ ...userBody, email: value }), status(400));
        assert.throws(() => taskPayload({ ...taskBody, name: value }), status(400));
        await assert.rejects(new User({ ...userBody, name: value }).validate());
        await assert.rejects(new Task({ ...taskBody, name: value }).validate());
    }
    for (const body of [undefined, null, [], 'text', 123]) {
        assert.throws(() => userPayload(body), status(400));
        assert.throws(() => taskPayload(body), status(400));
    }
});

test('payload whitelists ignore IDs, dates, internal fields, and update operators', () => {
    const internal = { _id: userId, dateCreated: '1900-01-01', __v: 100, $set: { name: 'Injected' }, unknown: true };
    assert.deepEqual(userPayload({ ...userBody, ...internal }), { ...userBody, pendingTasks: [] });
    assert.deepEqual(taskPayload({ ...taskBody, ...internal }), {
        name: 'Example', description: '', deadline: new Date('2000-01-01'), completed: false,
        assignedUser: '', assignedUserName: 'unassigned',
    });
    assert.throws(() => userPayload({ email: 'example' }), status(400));
    assert.throws(() => taskPayload({ name: 'Example' }), status(400));
});

test('date validation accepts past dates and rejects invalid types and calendar dates', () => {
    for (const deadline of ['2000-01-01', '2024-02-29T00:00:00.000Z', new Date('2025-01-01')]) {
        assert.ok(taskPayload({ ...taskBody, deadline }).deadline instanceof Date);
    }
    for (const deadline of [null, 123, true, {}, [], '', 'invalid', '2026-02-30', '2025-02-29', new Date(NaN)]) {
        assert.throws(() => taskPayload({ ...taskBody, deadline }), status(400));
    }
});

test('normalization is explicit for forms and strict for JSON', () => {
    const options = { formEncoded: true };
    assert.equal(taskPayload({ ...taskBody, completed: 'true' }, options).completed, true);
    assert.equal(taskPayload({ ...taskBody, completed: 'false' }, options).completed, false);
    assert.deepEqual(userPayload({ ...userBody, pendingTasks: JSON.stringify([taskId]) }, options).pendingTasks, [taskId]);
    assert.deepEqual(userPayload({ ...userBody, pendingTasks: [taskId] }, options).pendingTasks, [taskId]);
    assert.throws(() => taskPayload({ ...taskBody, completed: 'true' }), status(400));
    assert.throws(() => userPayload({ ...userBody, pendingTasks: JSON.stringify([taskId]) }), status(400));
    for (const completed of [1, '1', 'TRUE', null, []]) {
        assert.throws(() => taskPayload({ ...taskBody, completed }, options), status(400));
    }
    for (const pendingTasks of [taskId, 'null', '{}', '[invalid]']) {
        assert.throws(() => userPayload({ ...userBody, pendingTasks }, options), status(400));
    }
});

test('references are canonical string IDs, deduplicated, and type checked', () => {
    assert.deepEqual(userPayload({ ...userBody, pendingTasks: [taskId.toUpperCase(), taskId] }).pendingTasks, [taskId]);
    for (const pendingTasks of [null, {}, [123], ['bad'], [new mongoose.Types.ObjectId()]]) {
        assert.throws(() => userPayload({ ...userBody, pendingTasks }), status(400));
    }
    for (const assignedUser of [null, 42, {}, [], 'bad']) {
        assert.throws(() => taskPayload({ ...taskBody, assignedUser }), status(400));
    }
    assert.equal(taskPayload({ ...taskBody, assignedUser: '', assignedUserName: 'Old name' }).assignedUserName, 'unassigned');
    assert.throws(() => taskPayload({ ...taskBody, assignedUserName: {} }), status(400));
});

test('URL resource checks win over invalid bodies and distinguish missing references', async t => {
    const lookup = t.mock.method(User, 'findById', () => query(null));
    await assert.rejects(prepareUserWrite({}, { id: 'bad' }), status(404));
    assert.equal(lookup.mock.callCount(), 0);
    await assert.rejects(prepareUserWrite({}, { id: missingId }), status(404));
    assert.equal(lookup.mock.callCount(), 1);
    t.mock.method(Task, 'findById', () => query({ _id: taskId }));
    await assert.rejects(prepareTaskWrite({ ...taskBody, assignedUser: 'bad' }, { id: taskId }), status(400));
    await assert.rejects(prepareTaskWrite({ ...taskBody, assignedUser: missingId }, { id: taskId }), status(404));
    await assert.rejects(requireResource(Task, 'bad'), status(404));
});

test('user validation orders duplicate email, reference existence, then completion', async t => {
    t.mock.method(User, 'exists', () => query({ _id: userId }));
    const references = t.mock.method(Task, 'find', () => query([]));
    await assert.rejects(prepareUserWrite({ ...userBody, pendingTasks: [missingId] }), status(400));
    assert.equal(references.mock.callCount(), 0);
    User.exists.mock.mockImplementation(() => query(null));
    Task.find.mock.mockImplementation(() => query([{ _id: taskId, completed: true }]));
    await assert.rejects(prepareUserWrite({ ...userBody, pendingTasks: [taskId, missingId] }), status(404));
    await assert.rejects(prepareUserWrite({ ...userBody, pendingTasks: [taskId] }), status(400));
});

test('assigned names are derived or checked after the referenced user is loaded', async t => {
    t.mock.method(User, 'findById', () => query({ _id: userId, name: 'Owner' }));
    const derived = await prepareTaskWrite({ ...taskBody, assignedUser: userId });
    assert.equal(derived.payload.assignedUserName, 'Owner');
    assert.equal(typeof derived.payload.assignedUser, 'string');
    assert.equal(derived.user.name, 'Owner');
    await assert.rejects(prepareTaskWrite({ ...taskBody, assignedUser: userId, assignedUserName: 'Wrong' }), status(400));
    User.findById.mock.mockImplementation(() => query(null));
    await assert.rejects(prepareTaskWrite({ ...taskBody, assignedUser: userId, assignedUserName: 'Wrong' }), status(404));
});

test('every dependent validation query receives the caller session', async t => {
    const session = {};
    const checked = value => ({ session(actual) { assert.equal(actual, session); return Promise.resolve(value); } });
    t.mock.method(User, 'findById', () => checked({ _id: userId }));
    t.mock.method(User, 'exists', filter => {
        assert.deepEqual(filter._id, { $ne: userId });
        return checked(null);
    });
    t.mock.method(Task, 'find', () => checked([{ _id: taskId, completed: false }]));
    const result = await prepareUserWrite({ ...userBody, pendingTasks: [taskId] }, { id: userId, session });
    assert.equal(result.existing._id, userId);
});

test('recognized database errors are safe 400 envelopes and unexpected errors remain 500', async () => {
    let validationError;
    try { await new User({ name: 123 }).validate(); } catch (error) { validationError = error; }
    for (const [error, expected] of [
        [validationError, 400],
        [new mongoose.Error.CastError('String', 'private detail', 'name'), 400],
        [{ code: 11000, keyPattern: { email: 1 }, message: 'private database detail' }, 400],
        [{ code: 11000, keyPattern: { _id: 1 }, message: 'private database detail' }, 500],
        [new Error('private database detail'), 500],
    ]) {
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        errorHandler(error, {}, res, () => assert.fail('Unexpected forwarding'));
        assert.equal(res.code, expected);
        assert.equal(res.body.data, null);
        assert.equal(typeof res.body.message, 'string');
        assert.doesNotMatch(JSON.stringify(res.body), /private|stack|CastError|Mongo|ValidationError/);
    }
});

test('transaction helper does not fall back and replacement requires an active session', async t => {
    let called = false;
    t.mock.method(mongoose.connection, 'transaction', async () => { throw new Error('Transactions unavailable'); });
    await assert.rejects(atomicWrite(async () => { called = true; }));
    assert.equal(called, false);
    await assert.rejects(saveReplacement(new User(userBody), userBody), status(500));
});
