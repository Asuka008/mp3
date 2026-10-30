const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task } = require('../models');
const { start } = require('../server');
const { configureTestEnvironment } = require('../testing/environment');
const { assertFixtureInvariants } = require('../testing/invariants');

test('Atlas HTTP DELETE cascades, rollback, and common HTTP behavior', {
    skip: process.env.MP3_ATLAS_TESTS !== '1' ? 'Run npm run test:atlas explicitly to use Atlas.' : false,
    timeout: 120000,
}, async t => {
    const runId = randomUUID();
    const prefix = `MP3-DELETE-${runId}-`;
    const emailPrefix = `mp3-delete-${runId}-`;
    const userIds = [], taskIds = [];
    const activeUsers = new Set(), activeTasks = new Set();
    const testEnvironment = configureTestEnvironment();
    let server, base, stage = 'startup', requests = 0;
    const asJSON = value => JSON.parse(JSON.stringify(value));

    async function request(path, { method = 'GET', json, rawBody, query = {} } = {}) {
        const url = new URL(base + '/api' + path);
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, JSON.stringify(value));
        const headers = { Origin: 'https://mp3-client.example.invalid' };
        const options = { method, headers, signal: AbortSignal.timeout(15000) };
        if (json !== undefined || rawBody !== undefined) {
            headers['Content-Type'] = 'application/json';
            options.body = rawBody === undefined ? JSON.stringify(json) : rawBody;
        }
        requests++;
        const response = await fetch(url, options);
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
        if (method === 'DELETE' && response.ok) {
            assert.equal(response.status, 204, 'Successful DELETE must return 204');
            assert.equal(await response.text(), '', 'Successful DELETE must have no body');
            assert.equal(response.headers.get('content-type'), null);
            return { status: 204 };
        }
        assert.match(response.headers.get('content-type'), /application\/json/);
        const body = await response.json();
        assert.equal(typeof body.message, 'string');
        assert.ok(Object.hasOwn(body, 'data'));
        if (!response.ok) {
            assert.equal(body.data, null);
            assert.doesNotMatch(JSON.stringify(body), /Mongo|private|stack|E11000/);
        }
        return { status: response.status, ...body };
    }

    async function create(path, json) {
        const response = await request(path, { method: 'POST', json });
        assert.equal(response.status, 201);
        const ids = path === '/users' ? userIds : taskIds;
        const active = path === '/users' ? activeUsers : activeTasks;
        ids.push(response.data._id);
        active.add(response.data._id);
        return response.data;
    }

    async function get(path) {
        const response = await request(path);
        assert.equal(response.status, 200);
        return response.data;
    }

    async function snapshot() {
        return JSON.stringify({
            users: await User.find({ _id: { $in: userIds } }).sort({ _id: 1 }).lean(),
            tasks: await Task.find({ _id: { $in: taskIds } }).sort({ _id: 1 }).lean(),
        });
    }

    async function inspectBothSides() {
        const users = new Map(), tasks = new Map();
        for (const id of activeUsers) {
            const user = await get(`/users/${id}`);
            assert.deepEqual(user, asJSON(await User.findById(id).lean()));
            assert.equal(new Set(user.pendingTasks).size, user.pendingTasks.length);
            users.set(id, user);
        }
        for (const id of activeTasks) {
            const task = await get(`/tasks/${id}`);
            assert.deepEqual(task, asJSON(await Task.findById(id).lean()));
            tasks.set(id, task);
        }
        assertFixtureInvariants([...users.values()], [...tasks.values()]);
    }

    async function absent(path, id) {
        assert.equal((await request(`/${path}/${id}`)).status, 404);
        assert.equal((await request(`/${path}/${id}`, { method: 'DELETE' })).status, 404);
        const list = await request(`/${path}`, { query: { where: { _id: id } } });
        assert.equal(list.status, 200);
        assert.deepEqual(list.data, []);
        const count = await request(`/${path}`, { query: { where: { _id: id }, count: true } });
        assert.equal(count.status, 200);
        assert.equal(count.data, 0);
    }

    async function remove(path, id) {
        const response = await request(`/${path}/${id}`, { method: 'DELETE' });
        assert.deepEqual(response, { status: 204 });
        (path === 'users' ? activeUsers : activeTasks).delete(id);
        await absent(path, id);
        await inspectBothSides();
    }

    async function rejectedDelete(path, id, expected) {
        const before = await snapshot();
        const response = await request(`/${path}/${id}`, { method: 'DELETE' });
        assert.equal(response.status, expected);
        assert.equal(await snapshot(), before, 'Failed deletion must preserve every fixture record');
    }

    try {
        server = await start();
        base = `http://127.0.0.1:${server.address().port}`;
        assert.equal(mongoose.connection.db.databaseName, testEnvironment.database);
        const a = await create('/users', { name: prefix + 'a', email: `${emailPrefix}a@example.invalid` });
        const b = await create('/users', { name: prefix + 'b', email: `${emailPrefix}b@example.invalid` });
        const task = (label, fields = {}) => create('/tasks', { name: prefix + label, description: 'Preserve ' + label, deadline: '2000-01-01', ...fields });
        const pendingDelete = await task('pending-delete', { assignedUser: a._id });
        const completedDelete = await task('completed-delete', { assignedUser: a._id, completed: true });
        const pendingKeep = await task('pending-keep', { assignedUser: a._id });
        const completedKeep = await task('completed-keep', { assignedUser: a._id, completed: true });
        const bPending = await task('b-pending', { assignedUser: b._id });
        const bCompleted = await task('b-completed', { assignedUser: b._id, completed: true });
        const unassignedDelete = await task('unassigned-delete');
        const unassignedKeep = await task('unassigned-keep');
        await inspectBothSides();
        const unrelated = async () => JSON.stringify([
            await get(`/users/${b._id}`), await get(`/tasks/${bPending._id}`),
            await get(`/tasks/${bCompleted._id}`), await get(`/tasks/${unassignedKeep._id}`),
        ]);
        const unrelatedBefore = await unrelated();

        stage = 'malformed/missing ids and no partial changes';
        const missingId = new mongoose.Types.ObjectId().toString();
        for (const path of ['tasks', 'users']) {
            await rejectedDelete(path, 'malformed', 404);
            await rejectedDelete(path, missingId, 404);
            assert.equal((await request(`/${path}`, { method: 'DELETE' })).status, 404);
        }

        stage = 'pending, completed, and unassigned task deletion';
        await remove('tasks', pendingDelete._id);
        assert.deepEqual((await get(`/users/${a._id}`)).pendingTasks, [pendingKeep._id]);
        assert.equal(await unrelated(), unrelatedBefore);
        await remove('tasks', completedDelete._id);
        assert.deepEqual((await get(`/users/${a._id}`)).pendingTasks, [pendingKeep._id]);
        assert.equal(await unrelated(), unrelatedBefore);
        await remove('tasks', unassignedDelete._id);
        assert.equal(await unrelated(), unrelatedBefore);

        stage = 'task deletion rollback after the task was deleted';
        const failCleanup = t.mock.method(User, 'updateMany', async () => { throw new Error('private membership cleanup failure'); });
        try { await rejectedDelete('tasks', pendingKeep._id, 500); }
        finally { failCleanup.mock.restore(); }
        await inspectBothSides();

        stage = 'user deletion rollback after the user was deleted';
        const failUnassignment = t.mock.method(Task, 'updateMany', async () => { throw new Error('private task unassignment failure'); });
        try { await rejectedDelete('users', a._id, 500); }
        finally { failUnassignment.mock.restore(); }
        await inspectBothSides();

        stage = 'user deletion preserves pending and completed task business data';
        const preserved = [await get(`/tasks/${pendingKeep._id}`), await get(`/tasks/${completedKeep._id}`)];
        await remove('users', a._id);
        for (const before of preserved) {
            assert.deepEqual(await get(`/tasks/${before._id}`), { ...before, assignedUser: '', assignedUserName: 'unassigned' });
        }
        assert.equal(await unrelated(), unrelatedBefore);
        assert.equal((await get(`/tasks/${pendingKeep._id}`)).completed, false);
        assert.equal((await get(`/tasks/${completedKeep._id}`)).completed, true);

        stage = 'common JSON error envelopes and CORS headers';
        assert.equal((await request('/unknown/nested/path')).status, 404);
        assert.equal((await request('/unknown/nested/path', { method: 'POST', json: {} })).status, 404);
        assert.equal((await request('/tasks/unknown/extra', { method: 'DELETE' })).status, 404);
        assert.equal((await request('/users', { method: 'POST', rawBody: '{"private":' })).status, 400);
        assert.equal((await request('/tasks', { method: 'POST', json: {} })).status, 400);
        assert.equal((await request('/users', { method: 'POST', json: { name: prefix + 'duplicate', email: b.email } })).status, 400);
        assert.equal((await request('/tasks', { query: { where: { _id: 'malformed' } } })).status, 400);
        for (const path of ['/users', `/tasks/${pendingKeep._id}`, '/unknown/preflight']) {
            requests++;
            const response = await fetch(base + '/api' + path, {
                method: 'OPTIONS', headers: { Origin: 'https://mp3-client.example.invalid', 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'Content-Type' },
            });
            assert.equal(response.status, 204);
            assert.equal(await response.text(), '');
            assert.equal(response.headers.get('content-type'), null);
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
            assert.deepEqual(new Set(response.headers.get('access-control-allow-methods').split(/,\s*/)), new Set(['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS']));
            assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/);
        }
        await inspectBothSides();
        assert.equal(await unrelated(), unrelatedBefore);
        console.log(`Verified ${requests} DELETE/common-HTTP requests against Atlas, including rollback and unrelated-record preservation; fixture cleanup follows.`);
    } catch {
        throw new Error(`Atlas DELETE verification failed during ${stage}; raw database details withheld.`);
    } finally {
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        try {
            if (testEnvironment.matches(mongoose.connection)) {
                const ownTasks = { $or: [{ _id: { $in: taskIds } }, { name: { $regex: '^' + prefix } }] };
                const ownUsers = { $or: [{ _id: { $in: userIds } }, { email: { $regex: '^' + emailPrefix } }] };
                await Task.deleteMany(ownTasks);
                await User.deleteMany(ownUsers);
                assert.equal(await Task.countDocuments(ownTasks), 0);
                assert.equal(await User.countDocuments(ownUsers), 0);
            }
        } catch {
            throw new Error('Atlas DELETE fixture cleanup failed; unrelated records were not targeted.');
        } finally {
            await mongoose.disconnect().catch(() => {});
            testEnvironment.restore();
        }
    }
});
