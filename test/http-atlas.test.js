const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User, Task } = require('../models');
const { start } = require('../server');
const { configureTestEnvironment } = require('../testing/environment');
const { assertFixtureInvariants } = require('../testing/invariants');

test('Atlas HTTP POST/GET operations, queries, and atomic creation', {
    skip: process.env.MP3_ATLAS_TESTS !== '1' ? 'Run npm run test:atlas explicitly to use Atlas.' : false,
    timeout: 120000,
}, async t => {
    const runId = randomUUID();
    const prefix = `MP3-HTTP-${runId}-`;
    const emailPrefix = `mp3-http-${runId}-`;
    const usersFilter = { $or: [{ name: { $regex: '^' + prefix } }, { email: { $regex: '^' + emailPrefix } }] };
    const createdTaskIds = [];
    const tasksFilter = () => ({ $or: [
        { name: { $regex: '^' + prefix } }, { description: { $regex: '^' + prefix } },
        { _id: { $in: createdTaskIds } },
    ] });
    let server, base, stage = 'real startup', requests = 0;
    const testEnvironment = configureTestEnvironment();
    const email = suffix => `${emailPrefix}${suffix}@example.invalid`;
    const userBody = suffix => ({ name: prefix + suffix, email: email(suffix) });
    const taskBody = suffix => ({ name: prefix + suffix, deadline: '2000-01-01' });

    async function request(path, { method = 'GET', json, form, rawBody, query = {}, rawQuery = {} } = {}) {
        const url = new URL(base + '/api' + path);
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, JSON.stringify(value));
        for (const [key, value] of Object.entries(rawQuery)) url.searchParams.set(key, value);
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
        const response = await fetch(url, options);
        assert.match(response.headers.get('content-type'), /application\/json/);
        const body = await response.json();
        assert.equal(typeof body.message, 'string');
        assert.ok(Object.hasOwn(body, 'data'));
        if (method === 'POST' && path === '/tasks' && body.data?._id) createdTaskIds.push(body.data._id);
        return { status: response.status, ...body };
    }

    async function post(path, body) {
        const response = await request(path, { method: 'POST', json: body });
        assert.equal(response.status, 201);
        assert.ok(response.data._id);
        assert.equal(Array.isArray(response.data), false);
        return response.data;
    }

    async function get(path, options) {
        const response = await request(path, options);
        assert.equal(response.status, 200);
        return response.data;
    }

    async function snapshot() {
        const state = {
            users: await User.find(usersFilter).sort({ _id: 1 }).lean(),
            tasks: await Task.find(tasksFilter()).sort({ _id: 1 }).lean(),
        };
        assertFixtureInvariants(state.users, state.tasks);
        return JSON.stringify(state);
    }

    async function rejected(path, options, expected) {
        const before = await snapshot();
        const response = await request(path, { method: 'POST', ...options });
        assert.equal(response.status, expected);
        assert.equal(response.data, null);
        assert.doesNotMatch(response.message, /Mongo|stack|private|E11000/);
        assert.equal(await snapshot(), before, 'Rejected creation must leave all fixture records unchanged');
    }

    try {
        server = await start();
        base = `http://127.0.0.1:${server.address().port}`;
        assert.equal(mongoose.connection.db.databaseName, testEnvironment.database);

        stage = 'HTTP creation, defaults, and persistence';
        const creationStart = Date.now();
        const owner = await post('/users', { ...userBody('owner'), dateCreated: '1900-01-01', __v: 999 });
        assert.deepEqual(owner.pendingTasks, []);
        assert.ok(Date.parse(owner.dateCreated) >= creationStart && Date.parse(owner.dateCreated) <= Date.now());
        assert.notEqual(owner.__v, 999);
        const fakeId = new mongoose.Types.ObjectId().toString();
        const unassigned = await post('/tasks', { ...taskBody('unassigned'), assignedUser: '', assignedUserName: 'Stale', _id: fakeId, dateCreated: '1900-01-01' });
        assert.notEqual(unassigned._id, fakeId);
        assert.equal(unassigned.description, '');
        assert.equal(unassigned.completed, false);
        assert.equal(unassigned.assignedUser, '');
        assert.equal(unassigned.assignedUserName, 'unassigned');
        assert.ok(Date.parse(unassigned.dateCreated) >= creationStart && Date.parse(unassigned.dateCreated) <= Date.now());
        const pending = await post('/tasks', { ...taskBody('pending'), assignedUser: owner._id });
        const completed = await post('/tasks', { ...taskBody('completed'), assignedUser: owner._id, assignedUserName: owner.name, completed: true });
        assert.equal(pending.assignedUserName, owner.name);
        assert.deepEqual((await get(`/users/${owner._id}`)).pendingTasks, [pending._id]);
        assert.equal(completed.assignedUser, owner._id);
        const stored = await Task.findById(pending._id).lean();
        assert.equal(stored.assignedUser, owner._id);
        assert.equal(stored.assignedUserName, owner.name);

        stage = 'user creation moves pending tasks atomically and deduplicates input';
        const next = await post('/users', { ...userBody('next'), pendingTasks: [unassigned._id, pending._id, pending._id.toUpperCase()] });
        assert.deepEqual(next.pendingTasks, [unassigned._id, pending._id]);
        assert.deepEqual((await get(`/users/${owner._id}`)).pendingTasks, []);
        for (const original of [unassigned, pending]) {
            const moved = await get(`/tasks/${original._id}`);
            assert.equal(moved.assignedUser, next._id);
            assert.equal(moved.assignedUserName, next.name);
            assert.equal(moved.dateCreated, original.dateCreated);
        }
        assert.equal((await get(`/tasks/${completed._id}`)).assignedUser, owner._id);

        stage = 'URL-encoded creation and canonical assignments';
        const formTask = await request('/tasks', { method: 'POST', form: { ...taskBody('form-task'), completed: 'false', assignedUser: next._id } });
        assert.equal(formTask.status, 201);
        assert.equal(formTask.data.completed, false);
        const formUser = await request('/users', { method: 'POST', form: { ...userBody('form-user'), pendingTasks: JSON.stringify([formTask.data._id, formTask.data._id]) } });
        assert.equal(formUser.status, 201);
        assert.deepEqual(formUser.data.pendingTasks, [formTask.data._id]);
        assert.equal((await get(`/tasks/${formTask.data._id}`)).assignedUser, formUser.data._id);
        assert.ok(!(await get(`/users/${next._id}`)).pendingTasks.includes(formTask.data._id));

        stage = 'invalid POSTs, precedence, and unchanged state';
        const missingId = new mongoose.Types.ObjectId().toString();
        await rejected('/users', { json: { email: email('no-name') } }, 400);
        await rejected('/users', { json: { ...userBody('wrong-type'), name: 42 } }, 400);
        await rejected('/users', { json: { ...userBody('bad-list'), pendingTasks: '[]' } }, 400);
        await rejected('/users', { json: { ...userBody('bad-id'), pendingTasks: ['bad'] } }, 400);
        await rejected('/users', { json: { ...userBody('missing-ref'), pendingTasks: [pending._id, missingId] } }, 404);
        await rejected('/users', { json: { ...userBody('completed-ref'), pendingTasks: [pending._id, completed._id] } }, 400);
        await rejected('/users', { json: { ...userBody('duplicate'), email: owner.email, pendingTasks: [missingId] } }, 400);
        await rejected('/tasks', { json: { name: prefix + 'no-deadline' } }, 400);
        await rejected('/tasks', { json: { ...taskBody('bad-date'), deadline: '2026-02-30' } }, 400);
        await rejected('/tasks', { json: { ...taskBody('bad-bool'), completed: 'false' } }, 400);
        await rejected('/tasks', { json: { ...taskBody('bad-assignment'), assignedUser: 'bad' } }, 400);
        await rejected('/tasks', { json: { ...taskBody('missing-user'), assignedUser: missingId, assignedUserName: 'Wrong' } }, 404);
        await rejected('/tasks', { json: { ...taskBody('wrong-name'), assignedUser: owner._id, assignedUserName: 'Wrong' } }, 400);
        await rejected('/users', { rawBody: '{"name":' }, 400);

        stage = 'HTTP rollback after related writes have begun';
        const updateTasks = t.mock.method(Task, 'updateMany', async () => { throw new Error('private injected create failure'); });
        try {
            // User insertion and old-owner cleanup occur before this injected task-write failure.
            await rejected('/users', { json: { ...userBody('rollback'), pendingTasks: [pending._id] } }, 500);
        } finally { updateTasks.mock.restore(); }
        const updateUser = t.mock.method(User, 'updateOne', async () => { throw new Error('private injected membership failure'); });
        try {
            await rejected('/tasks', { json: { ...taskBody('rollback-task'), assignedUser: owner._id } }, 500);
        } finally { updateUser.mock.restore(); }

        stage = 'concurrent duplicate-email HTTP requests';
        const concurrentBody = userBody('concurrent');
        const concurrent = await Promise.all([
            request('/users', { method: 'POST', json: concurrentBody }),
            request('/users', { method: 'POST', json: concurrentBody }),
        ]);
        assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 400]);
        assert.equal(await User.countDocuments({ email: concurrentBody.email }), 1);

        stage = 'single-resource projections and ignored parameters';
        for (const [path, resource] of [['users', next], ['tasks', pending]]) {
            const selected = await get(`/${path}/${resource._id}`, { query: { select: { name: 1, _id: 0 } }, rawQuery: { where: '[', sort: 'bad', skip: '-1', limit: '{}', count: 'not-json' } });
            assert.deepEqual(selected, { name: resource.name });
            const excluded = await get(`/${path}/${resource._id}`, { query: { select: { _id: 0 } } });
            assert.ok(!Object.hasOwn(excluded, '_id'));
            assert.equal(excluded.name, resource.name);
            assert.equal(Array.isArray(excluded), false);
            assert.equal((await request(`/${path}/bad`)).status, 404);
            assert.equal((await request(`/${path}/${missingId}`)).status, 404);
            assert.equal((await request(`/${path}/${missingId}`, { rawQuery: { select: '[' } })).status, 404);
            assert.equal((await request(`/${path}/${resource._id}`, { query: { select: { name: 1, _id: 0, dateCreated: 0 } } })).status, 400);
            assert.deepEqual(await get(`/${path}`, { query: { where: { _id: missingId } } }), []);
            assert.equal(await get(`/${path}`, { query: { where: { _id: missingId }, count: true } }), 0);
        }

        stage = 'bulk pagination fixtures';
        // Direct database fixtures isolate default-limit verification from creation tests above.
        const bulkUsers = Array.from({ length: 105 }, (_, index) => ({ ...userBody(`bulk-${String(index).padStart(3, '0')}`) }));
        const bulkTasks = Array.from({ length: 105 }, (_, index) => taskBody(`bulk-${String(index).padStart(3, '0')}`));
        await User.insertMany(bulkUsers);
        await Task.insertMany(bulkTasks);
        const where = { name: { $regex: '^' + prefix + 'bulk-' } };

        stage = 'collection query combinations and count interpretation';
        for (const path of ['users', 'tasks']) {
            assert.equal((await get(`/${path}`, { query: { where } })).length, path === 'tasks' ? 100 : 105);
            assert.equal((await get(`/${path}`, { query: { where, limit: 0 } })).length, 105);
            const page = await get(`/${path}`, { query: { where, sort: { name: 1 }, select: { name: 1, _id: 0 }, skip: 2, limit: 3, count: false } });
            assert.deepEqual(page, [2, 3, 4].map(index => ({ name: prefix + `bulk-${String(index).padStart(3, '0')}` })));
            const descending = await get(`/${path}`, { query: { where, sort: { name: -1 }, select: { name: 1, _id: 0 }, limit: 3 } });
            assert.deepEqual(descending, [104, 103, 102].map(index => ({ name: prefix + `bulk-${index}` })));
            assert.equal(await get(`/${path}`, { query: { where, sort: { name: -1 }, select: { name: 1, _id: 0 }, skip: 1000, limit: 1, count: true } }), 105);
            const chosen = path === 'users' ? owner : pending;
            const matched = await get(`/${path}`, { query: { where: { _id: { $in: [chosen._id] } }, select: { name: 1, _id: 0 } } });
            assert.deepEqual(matched, [{ name: chosen.name }]);
        }
        assert.deepEqual((await get('/tasks', { query: { where: { _id: { $in: [pending._id, completed._id] }, completed: true } } })).map(task => task._id), [completed._id]);
        assert.equal((await get('/users', { query: { where: { $or: [{ _id: owner._id }, { _id: next._id }] } } })).length, 2);
        assert.equal((await get('/users', { query: { where: { _id: owner._id, $expr: { $eq: [{ $size: '$pendingTasks' }, 0] } } } })).length, 1);

        stage = 'invalid collection queries return safe client errors';
        const badQueries = [
            { where: null }, { where: [] }, { sort: { name: 2 } }, { select: { name: 1, email: 0 } },
            { skip: -1 }, { skip: 1.5 }, { skip: '2' }, { limit: -1 }, { limit: null }, { count: 1 },
            { where: { _id: { $in: 'bad' } } }, { where: { $or: [] } }, { where: { $unknown: 1 } },
            { where: { name: { $unknown: 1 } } }, { where: { name: { $regex: '[' } } },
            { where: { name: { $not: { $in: 'bad' } } } }, { where: { $where: 1 } },
            { where: { _id: { $unknown: 1 } } },
        ];
        for (const path of ['users', 'tasks']) {
            for (const query of badQueries) assert.equal((await request(`/${path}`, { query })).status, 400);
            for (const parameter of ['where', 'sort', 'select', 'skip', 'limit', 'count']) {
                const response = await request(`/${path}`, { rawQuery: { [parameter]: '[' } });
                assert.equal(response.status, 400);
                assert.equal(response.data, null);
            }
        }
        console.log(`Verified ${requests} actual HTTP requests against Atlas; creation/query/rollback fixtures will be cleaned up.`);
        await snapshot();
    } catch {
        throw new Error(`Atlas HTTP verification failed during ${stage}; raw database details withheld.`);
    } finally {
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        try {
            if (testEnvironment.matches(mongoose.connection)) {
                // Scope cleanup to this run's UUID markers/returned task ids; no shared data wipe.
                await Task.deleteMany(tasksFilter());
                await User.deleteMany(usersFilter);
                assert.equal(await Task.countDocuments(tasksFilter()), 0);
                assert.equal(await User.countDocuments(usersFilter), 0);
            }
        } catch {
            throw new Error('Atlas HTTP fixture cleanup failed; unrelated records were not targeted.');
        } finally {
            await mongoose.disconnect().catch(() => {});
            testEnvironment.restore();
        }
    }
});
