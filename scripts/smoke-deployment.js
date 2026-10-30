const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function smokeDeployment(base) {
    const target = new URL(base);
    assert.ok(target.protocol === 'https:' && target.hostname.endsWith('.onrender.com') &&
        !target.username && !target.password && !target.search && !target.hash &&
        target.pathname === '/', 'Supply only your Render HTTPS base URL.');
    const prefix = `MP3-SMOKE-${randomUUID()}-`;
    const ids = { users: new Set(), tasks: new Set() };
    let requests = 0;

    async function request(path, { method = 'GET', json, query = {}, expected = method === 'DELETE' ? 204 : 200 } = {}) {
        const url = new URL('/api' + path, target);
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, JSON.stringify(value));
        requests++;
        const response = await fetch(url, {
            method, signal: AbortSignal.timeout(90000),
            headers: { Origin: 'https://mp3-smoke.example.invalid', ...(json === undefined ? {} : { 'Content-Type': 'application/json' }) },
            body: json === undefined ? undefined : JSON.stringify(json),
        });
        assert.equal(response.status, expected, `${method} ${path}: unexpected HTTP status`);
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
        if (response.status === 204) {
            assert.equal(method, 'DELETE');
            assert.equal(await response.text(), '');
            assert.equal(response.headers.get('content-type'), null);
            return null;
        }
        assert.match(response.headers.get('content-type') || '', /application\/json/, `${method} ${path}: expected JSON`);
        const body = await response.json();
        assert.deepEqual(Object.keys(body).sort(), ['data', 'message']);
        assert.ok(typeof body.message === 'string' && body.message.length > 0);
        if (method === 'POST' && body.data?._id && Object.hasOwn(ids, path.slice(1))) ids[path.slice(1)].add(body.data._id);
        if (expected >= 400) assert.equal(body.data, null);
        return body.data;
    }

    // A root response alone is not proof of database connectivity.
    assert.equal(await request(''), null);
    try {
        const a = await request('/users', { method: 'POST', expected: 201, json: { name: prefix + 'a', email: prefix + 'a@example.invalid' } });
        const b = await request('/users', { method: 'POST', expected: 201, json: { name: prefix + 'b', email: prefix + 'b@example.invalid' } });
        const pending = await request('/tasks', { method: 'POST', expected: 201, json: { name: prefix + 'pending', deadline: '2000-01-01', assignedUser: a._id } });
        const completed = await request('/tasks', { method: 'POST', expected: 201, json: { name: prefix + 'completed', deadline: '2000-01-01', assignedUser: a._id, completed: true } });
        assert.deepEqual((await request('/users/' + a._id)).pendingTasks, [pending._id]);
        assert.equal((await request('/tasks/' + completed._id)).assignedUserName, a.name);

        const renamed = await request('/users/' + a._id, { method: 'PUT', json: { name: prefix + 'renamed', email: a.email, pendingTasks: [pending._id] } });
        assert.equal(renamed.dateCreated, a.dateCreated);
        for (const task of [pending, completed]) assert.equal((await request('/tasks/' + task._id)).assignedUserName, renamed.name);
        const moved = await request('/tasks/' + pending._id, { method: 'PUT', json: { name: pending.name, deadline: pending.deadline, assignedUser: b._id } });
        assert.equal(moved.dateCreated, pending.dateCreated);
        assert.equal(moved.assignedUserName, b.name);
        assert.deepEqual((await request('/users/' + a._id)).pendingTasks, []);
        assert.deepEqual((await request('/users/' + b._id)).pendingTasks, [pending._id]);

        const where = { _id: { $in: [pending._id, completed._id] } };
        assert.deepEqual(await request('/tasks', { query: { where, sort: { name: 1 }, select: { name: 1, _id: 0 }, skip: 0, limit: 1 } }), [{ name: completed.name }]);
        assert.equal(await request('/tasks', { query: { where, count: true, skip: 10, limit: 1 } }), 2);
        assert.deepEqual(await request('/users/' + a._id, { query: { select: { email: 1, _id: 0 } } }), { email: a.email });
        await request('/tasks/' + pending._id, { method: 'PUT', expected: 400, json: { name: pending.name, deadline: pending.deadline, assignedUser: b._id, assignedUserName: 'Wrong' } });
        assert.deepEqual(await request('/tasks/' + pending._id), moved);
        assert.deepEqual((await request('/users/' + b._id)).pendingTasks, [pending._id]);

        for (const user of [a, b]) {
            await request('/users/' + user._id, { method: 'DELETE' });
            await request('/users/' + user._id, { expected: 404 });
        }
        for (const task of [pending, completed]) {
            const unassigned = await request('/tasks/' + task._id);
            assert.equal(unassigned.assignedUser, '');
            assert.equal(unassigned.assignedUserName, 'unassigned');
            assert.equal(unassigned.completed, task.completed);
            await request('/tasks/' + task._id, { method: 'DELETE' });
            await request('/tasks/' + task._id, { expected: 404 });
            await request('/tasks/' + task._id, { method: 'DELETE', expected: 404 });
        }
        await request('/users/not-an-id', { method: 'PUT', json: {}, expected: 404 });
        await request('/unknown/smoke', { expected: 404 });
        requests++;
        const options = await fetch(new URL('/api/tasks', target), { method: 'OPTIONS', signal: AbortSignal.timeout(90000), headers: { Origin: 'https://mp3-smoke.example.invalid', 'Access-Control-Request-Method': 'DELETE' } });
        assert.equal(options.status, 204);
        assert.equal(await options.text(), '');
        assert.equal(options.headers.get('access-control-allow-origin'), '*');
        for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) assert.ok(options.headers.get('access-control-allow-methods').includes(method));
    } finally {
        // Recover even an acknowledged write whose later assertions failed, using only this UUID.
        for (const kind of ['tasks', 'users']) {
            const where = { $or: [{ _id: { $in: [...ids[kind]] } }, { name: { $regex: '^' + prefix } }] };
            if (kind === 'users') where.$or.push({ email: { $regex: '^' + prefix } });
            const remaining = await request('/' + kind, { query: { where, limit: 0 } });
            for (const record of remaining) await request('/' + kind + '/' + record._id, { method: 'DELETE' });
            assert.equal(await request('/' + kind, { query: { where, count: true } }), 0, 'Smoke fixtures remain');
        }
    }
    console.log(`Public deployment smoke passed: ${requests} HTTPS requests; database-backed creation, replacement, both reference directions, queries, deletion, CORS, and fixture cleanup verified.`);
}

if (require.main === module) {
    smokeDeployment(process.argv[2]).catch(() => {
        console.error('Deployment smoke failed. Inspect the service and run-owned MP3-SMOKE fixtures; no unrelated records were targeted.');
        process.exitCode = 1;
    });
}

module.exports = { smokeDeployment };
