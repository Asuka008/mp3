const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task } = require('../models');
const { start } = require('../server');
const { configureTestEnvironment } = require('../testing/environment');
const { assertFixtureInvariants } = require('../testing/invariants');

test('Atlas HTTP PUT replacements and atomic two-way references', {
    skip: process.env.MP3_ATLAS_TESTS !== '1' ? 'Run npm run test:atlas explicitly to use Atlas.' : false,
    timeout: 120000,
}, async t => {
    const runId = randomUUID();
    const prefix = `MP3-PUT-${runId}-`;
    const emailPrefix = `mp3-put-${runId}-`;
    const users = new Map(), tasks = new Map();
    const userIds = [], taskIds = [];
    let server, base, requests = 0, stage = 'startup';
    const testEnvironment = configureTestEnvironment();
    const asJSON = value => JSON.parse(JSON.stringify(value));
    const userBody = label => ({ name: prefix + label, email: `${emailPrefix}${label}@example.invalid` });
    const taskBody = (task, fields = {}) => ({ name: task.name, deadline: '2001-01-01', ...fields });

    async function request(path, { method = 'GET', json, form, rawBody } = {}) {
        const options = { method, signal: AbortSignal.timeout(15000) };
        if (json !== undefined || rawBody !== undefined) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = rawBody === undefined ? JSON.stringify(json) : rawBody;
        }
        if (form) {
            options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
            options.body = new URLSearchParams(form).toString();
        }
        requests++;
        const response = await fetch(base + '/api' + path, options);
        assert.match(response.headers.get('content-type'), /application\/json/);
        const body = await response.json();
        assert.equal(typeof body.message, 'string');
        assert.ok(Object.hasOwn(body, 'data'));
        return { status: response.status, ...body };
    }

    async function get(path) {
        const response = await request(path);
        assert.equal(response.status, 200);
        return response.data;
    }

    async function create(path, body) {
        const response = await request(path, { method: 'POST', json: body });
        assert.equal(response.status, 201);
        const map = path === '/users' ? users : tasks;
        const ids = path === '/users' ? userIds : taskIds;
        map.set(response.data._id, response.data.dateCreated);
        ids.push(response.data._id);
        return response.data;
    }

    async function inspectBothSides() {
        const currentUsers = new Map(), currentTasks = new Map();
        for (const id of userIds) {
            const user = await get(`/users/${id}`);
            assert.equal(user._id, id);
            assert.equal(user.dateCreated, users.get(id));
            assert.deepEqual(user, asJSON(await User.findById(id).lean()));
            assert.equal(new Set(user.pendingTasks).size, user.pendingTasks.length);
            currentUsers.set(id, user);
        }
        for (const id of taskIds) {
            const task = await get(`/tasks/${id}`);
            assert.equal(task._id, id);
            assert.equal(task.dateCreated, tasks.get(id));
            assert.deepEqual(task, asJSON(await Task.findById(id).lean()));
            currentTasks.set(id, task);
        }
        assertFixtureInvariants([...currentUsers.values()], [...currentTasks.values()]);
        return { users: currentUsers, tasks: currentTasks };
    }

    async function snapshot() {
        return JSON.stringify({
            users: await User.find({ _id: { $in: userIds } }).sort({ _id: 1 }).lean(),
            tasks: await Task.find({ _id: { $in: taskIds } }).sort({ _id: 1 }).lean(),
        });
    }

    async function replace(path, body, form = false) {
        const response = await request(path, { method: 'PUT', ...(form ? { form: body } : { json: body }) });
        assert.equal(response.status, 200);
        assert.equal(Array.isArray(response.data), false);
        const [resource, id] = path.slice(1).split('/');
        const persisted = await get(path);
        assert.deepEqual(response.data, persisted);
        assert.equal(response.data._id, id);
        assert.equal(response.data.dateCreated, (resource === 'users' ? users : tasks).get(id));
        await inspectBothSides();
        return response.data;
    }

    async function rejected(path, body, status, rawBody) {
        const before = await snapshot();
        const response = await request(path, { method: 'PUT', json: body, rawBody });
        assert.equal(response.status, status);
        assert.equal(response.data, null);
        assert.doesNotMatch(response.message, /Mongo|private|stack|E11000/);
        assert.equal(await snapshot(), before, 'Rejected replacement must preserve every related document');
        await inspectBothSides();
    }

    try {
        server = await start();
        base = `http://127.0.0.1:${server.address().port}`;
        assert.equal(mongoose.connection.db.databaseName, testEnvironment.database);
        let a = await create('/users', userBody('a'));
        let b = await create('/users', userBody('b'));
        const first = await create('/tasks', { name: prefix + 'first', deadline: '2000-01-01', description: 'Old description', assignedUser: a._id });
        const retained = await create('/tasks', { name: prefix + 'retained', deadline: '2000-01-01', assignedUser: a._id });
        const completed = await create('/tasks', { name: prefix + 'completed', deadline: '2000-01-01', assignedUser: a._id, completed: true });
        const foreign = await create('/tasks', { name: prefix + 'foreign', deadline: '2000-01-01', assignedUser: b._id });
        await inspectBothSides();
        const missingId = new mongoose.Types.ObjectId().toString();

        stage = 'URL-first precedence and required replacement fields';
        for (const [path, id] of [['users', a._id], ['tasks', first._id]]) {
            for (const absent of ['malformed', missingId]) await rejected(`/${path}/${absent}`, {}, 404);
            await rejected(`/${path}/${id}`, {}, 400);
        }
        await rejected(`/users/${a._id}`, { name: a.name }, 400);
        await rejected(`/tasks/${first._id}`, { deadline: '2000-01-01' }, 400);

        stage = 'task transfer, completion, reopening, unassignment, and reassignment';
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: b._id }));
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: b._id }));
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: b._id, completed: true }));
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: b._id, completed: false }));
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: '', assignedUserName: 'Stale name' }));
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: a._id }));
        await replace(`/tasks/${completed._id}`, taskBody(completed, { assignedUser: b._id, completed: true }));
        await replace(`/tasks/${completed._id}`, taskBody(completed, { assignedUser: a._id, completed: true }));

        stage = 'user transfers retained/new tasks and unassigns removed pending tasks';
        a = await replace(`/users/${a._id}`, { name: a.name, email: a.email, pendingTasks: [retained._id, foreign._id, foreign._id.toUpperCase()] });
        assert.deepEqual(a.pendingTasks, [retained._id, foreign._id]);
        assert.equal((await get(`/tasks/${first._id}`)).assignedUser, '');
        assert.deepEqual((await get(`/users/${b._id}`)).pendingTasks, []);
        b = await replace(`/users/${b._id}`, { name: b.name, email: b.email, pendingTasks: [foreign._id] });

        stage = 'rename propagates to pending and completed tasks';
        a = await replace(`/users/${a._id}`, { name: prefix + 'renamed-a', email: a.email, pendingTasks: [retained._id] });
        assert.equal((await get(`/tasks/${retained._id}`)).assignedUserName, a.name);
        assert.equal((await get(`/tasks/${completed._id}`)).assignedUserName, a.name);
        assert.equal((await get(`/tasks/${completed._id}`)).assignedUser, a._id);

        stage = 'optional-field reset and immutable id/date';
        a = await replace(`/users/${a._id}`, { name: a.name, email: a.email, _id: b._id, dateCreated: '1900-01-01', __v: 999 });
        assert.deepEqual(a.pendingTasks, []);
        assert.equal((await get(`/tasks/${retained._id}`)).assignedUser, '');
        assert.equal((await get(`/tasks/${completed._id}`)).assignedUser, a._id);
        await replace(`/tasks/${first._id}`, taskBody(first, { assignedUser: b._id, completed: true, description: 'Must reset' }));
        const reset = await replace(`/tasks/${first._id}`, taskBody(first, { _id: foreign._id, dateCreated: '1900-01-01', __v: 999 }));
        assert.equal(reset.description, '');
        assert.equal(reset.completed, false);
        assert.equal(reset.assignedUser, '');
        assert.equal(reset.assignedUserName, 'unassigned');
        assert.notEqual(reset.__v, 999);

        stage = 'URL-encoded replacement uses the same normalization';
        await replace(`/tasks/${retained._id}`, taskBody(retained, { assignedUser: b._id, completed: 'false' }), true);
        a = await replace(`/users/${a._id}`, { name: a.name, email: a.email, pendingTasks: JSON.stringify([retained._id, retained._id]) }, true);
        await replace(`/tasks/${retained._id}`, taskBody(retained, { assignedUser: a._id, completed: 'true' }), true);
        await replace(`/tasks/${retained._id}`, taskBody(retained, { assignedUser: a._id }));

        stage = 'rejected references, duplicate emails, and field errors leave unchanged state';
        for (const body of [
            { name: a.name, email: a.email, pendingTasks: null },
            { name: a.name, email: a.email, pendingTasks: ['bad'] },
            { name: a.name, email: a.email, pendingTasks: [retained._id, completed._id] },
            { name: a.name, email: b.email, pendingTasks: [missingId] },
            { name: [], email: a.email, pendingTasks: [missingId] },
        ]) await rejected(`/users/${a._id}`, body, 400);
        await rejected(`/users/${a._id}`, { name: a.name, email: a.email, pendingTasks: [retained._id, missingId] }, 404);
        // FAQ interpretation: establish all reference existence before checking completion.
        await rejected(`/users/${a._id}`, { name: a.name, email: a.email, pendingTasks: [completed._id, missingId] }, 404);
        for (const fields of [
            { assignedUser: 'bad' }, { assignedUser: a._id, assignedUserName: 'Wrong' },
            { assignedUser: a._id, assignedUserName: '' }, { completed: 'false' },
            { deadline: '2026-02-30' }, { name: 42, assignedUser: missingId },
        ]) await rejected(`/tasks/${first._id}`, taskBody(first, fields), 400);
        await rejected(`/tasks/${first._id}`, taskBody(first, { assignedUser: missingId, assignedUserName: 'Wrong' }), 404);
        await rejected(`/tasks/${first._id}`, undefined, 400, '{"name":');

        stage = 'user rollback after replacement, pending removal, and former-owner cleanup';
        const originalUpdate = Task.updateMany.bind(Task);
        const failAssignment = t.mock.method(Task, 'updateMany', (filter, update, options) => {
            if (update.$set?.assignedUser === a._id) throw new Error('private injected assignment failure');
            return originalUpdate(filter, update, options);
        });
        try {
            await rejected(`/users/${a._id}`, { name: prefix + 'must-roll-back', email: a.email, pendingTasks: [foreign._id] }, 500);
        } finally { failAssignment.mock.restore(); }

        stage = 'task rollback after replacement and clearing affected memberships';
        const failMembership = t.mock.method(User, 'updateOne', async () => { throw new Error('private injected membership failure'); });
        try {
            await rejected(`/tasks/${retained._id}`, taskBody(retained, { assignedUser: b._id }), 500);
        } finally { failMembership.mock.restore(); }

        stage = 'concurrent replacement emails remain unique';
        const sharedEmail = `${emailPrefix}concurrent@example.invalid`;
        const emails = await Promise.all([
            request(`/users/${a._id}`, { method: 'PUT', json: { name: a.name, email: sharedEmail, pendingTasks: [retained._id] } }),
            request(`/users/${b._id}`, { method: 'PUT', json: { name: b.name, email: sharedEmail, pendingTasks: [foreign._id] } }),
        ]);
        assert.deepEqual(emails.map(result => result.status).sort(), [200, 400]);
        assert.equal(await User.countDocuments({ email: sharedEmail }), 1);
        await inspectBothSides();
        a = await get(`/users/${a._id}`);
        b = await get(`/users/${b._id}`);

        stage = 'successful transfer after rollback and concurrent task/user transfers';
        a = await replace(`/users/${a._id}`, { name: a.name, email: a.email, pendingTasks: [foreign._id] });
        const competing = await Promise.all([
            request(`/tasks/${retained._id}`, { method: 'PUT', json: taskBody(retained, { assignedUser: b._id }) }),
            request(`/users/${a._id}`, { method: 'PUT', json: { name: a.name, email: a.email, pendingTasks: [foreign._id, retained._id] } }),
        ]);
        assert.deepEqual(competing.map(result => result.status), [200, 200]);
        await inspectBothSides();
        a = await get(`/users/${a._id}`);
        b = await get(`/users/${b._id}`);
        const competingUsers = await Promise.all([
            request(`/users/${a._id}`, { method: 'PUT', json: { name: a.name, email: a.email, pendingTasks: [foreign._id, retained._id] } }),
            request(`/users/${b._id}`, { method: 'PUT', json: { name: b.name, email: b.email, pendingTasks: [retained._id] } }),
        ]);
        assert.deepEqual(competingUsers.map(result => result.status), [200, 200]);
        await inspectBothSides();
        console.log(`Verified ${requests} PUT-workflow HTTP requests against Atlas with both-side/persistence checks; fixture cleanup follows.`);
    } catch {
        throw new Error(`Atlas PUT verification failed during ${stage}; raw database details withheld.`);
    } finally {
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        try {
            if (testEnvironment.matches(mongoose.connection)) {
                // Track ids so rename/email replacements cannot move fixtures outside cleanup scope.
                const ownTasks = { $or: [{ _id: { $in: taskIds } }, { name: { $regex: '^' + prefix } }] };
                const ownUsers = { $or: [{ _id: { $in: userIds } }, { email: { $regex: '^' + emailPrefix } }] };
                await Task.deleteMany(ownTasks);
                await User.deleteMany(ownUsers);
                assert.equal(await Task.countDocuments(ownTasks), 0);
                assert.equal(await User.countDocuments(ownUsers), 0);
            }
        } catch {
            throw new Error('Atlas PUT fixture cleanup failed; unrelated records were not targeted.');
        } finally {
            await mongoose.disconnect().catch(() => {});
            testEnvironment.restore();
        }
    }
});
