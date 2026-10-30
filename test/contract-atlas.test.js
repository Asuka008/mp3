const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { User } = require('../models');
const { start } = require('../server');
const { atomicWrite } = require('../services/writes');
const { configureTestEnvironment } = require('../testing/environment');
const { Fixtures, createClient } = require('../testing/fixtures');

test('assignment contract matrix over real HTTP and persisted fixture snapshots', {
    skip: process.env.MP3_ATLAS_TESTS !== '1' ? 'Run npm run test:integration to use the explicit test connection.' : false,
    timeout: 120000,
}, async () => {
    const environment = configureTestEnvironment();
    const fixtures = new Fixtures();
    let server, client, stage = 'startup', rejected = 0;
    const missingId = new mongoose.Types.ObjectId().toString();

    async function noChange(path, options, expected = 400) {
        const before = await fixtures.snapshot();
        await client.request(path, { ...options, expected });
        assert.equal(await fixtures.snapshot(), before, `Rejected ${options.method || 'GET'} ${path} changed fixture records`);
        await fixtures.check();
        rejected++;
    }

    try {
        server = await start();
        assert.ok(environment.matches(mongoose.connection));
        client = createClient(`http://127.0.0.1:${server.address().port}`, fixtures);
        stage = 'fresh server dates and persisted defaults';
        const before = Date.now();
        let a = (await client.request('/users', { method: 'POST', json: fixtures.user('a', { dateCreated: '1900-01-01' }), expected: 201 })).data;
        const b = (await client.request('/users', { method: 'POST', json: fixtures.user('b'), expected: 201 })).data;
        const pending = (await client.request('/tasks', { method: 'POST', json: fixtures.task('pending', { assignedUser: a._id, dateCreated: '1900-01-01' }), expected: 201 })).data;
        for (const resource of [a, b, pending]) assert.ok(Date.parse(resource.dateCreated) >= before && Date.parse(resource.dateCreated) <= Date.now());
        await fixtures.check();

        stage = 'required values and wrong types for POST and PUT';
        const invalidStrings = [null, 42, true, [], {}, '', '   '];
        const invalidDates = [null, 42, true, [], {}, '', 'not-a-date', '2025-02-29', '2026-02-30'];
        let number = 0;
        for (const method of ['POST', 'PUT']) {
            for (const field of ['name', 'email']) {
                for (const value of invalidStrings) {
                    stage = `${method} user ${field} type ${number++}`;
                    const json = fixtures.user('bad-user-' + number, { [field]: value });
                    await noChange(method === 'POST' ? '/users' : `/users/${a._id}`, { method, json });
                }
                const json = fixtures.user('missing-' + field + '-' + method);
                delete json[field];
                await noChange(method === 'POST' ? '/users' : `/users/${a._id}`, { method, json });
            }
            for (const [field, values] of [['name', invalidStrings], ['deadline', invalidDates], ['description', [null, 123, {}, []]], ['completed', [null, 1, 'false', [], {}]], ['assignedUser', [null, 123, {}, [], 'bad']], ['assignedUserName', [null, 123, {}, []]]]) {
                for (const value of values) {
                    stage = `${method} task ${field} type ${number++}`;
                    const json = fixtures.task('bad-task-' + number, { description: fixtures.prefix + 'invalid', [field]: value });
                    await noChange(method === 'POST' ? '/tasks' : `/tasks/${pending._id}`, { method, json });
                }
            }
            for (const field of ['name', 'deadline']) {
                stage = `${method} missing task ${field}`;
                const json = fixtures.task('missing-task-' + field + '-' + method);
                delete json[field];
                await noChange(method === 'POST' ? '/tasks' : `/tasks/${pending._id}`, { method, json });
            }
            for (const pendingTasks of [null, {}, 123, '[]', ['bad'], [123]]) {
                stage = `${method} pendingTasks type ${number++}`;
                await noChange(method === 'POST' ? '/users' : `/users/${a._id}`, { method, json: fixtures.user('bad-pending-' + number, { pendingTasks }) });
            }
        }

        stage = 'missing-resource PUT and body/reference precedence';
        for (const path of ['users', 'tasks']) {
            for (const id of ['malformed', missingId]) {
                await noChange(`/${path}/${id}`, { method: 'PUT', json: {} }, 404);
                await noChange(`/${path}/${id}`, { method: 'PUT', json: path === 'users' ? fixtures.user('url-first', { pendingTasks: ['bad'] }) : fixtures.task('url-first', { assignedUser: 'bad' }) }, 404);
            }
        }
        await noChange('/users', { method: 'POST', json: fixtures.user('missing-task', { pendingTasks: [missingId] }) }, 404);
        await noChange(`/tasks/${pending._id}`, { method: 'PUT', json: fixtures.task('missing-user', { assignedUser: missingId }) }, 404);
        await noChange(`/users/${a._id}`, { method: 'PUT', json: fixtures.user('duplicate', { email: b.email }) });
        const kept = await client.request(`/users/${a._id}`, { method: 'PUT', json: { name: a.name, email: a.email, pendingTasks: [pending._id], dateCreated: '1900-01-01' }, expected: 200 });
        assert.equal(kept.data.dateCreated, a.dateCreated);
        await fixtures.check();

        stage = 'single projections, ignored parameters, and query operand edge cases';
        for (const [path, resource] of [['users', a], ['tasks', pending]]) {
            const projected = await client.request(`/${path}/${resource._id}`, { query: { select: { _id: 1, name: 0 } }, rawQuery: { where: '[', sort: 'bad', skip: 'null', limit: '-1', count: 'bad' }, expected: 200 });
            assert.equal(projected.data._id, resource._id);
            assert.ok(!Object.hasOwn(projected.data, 'name'));
            assert.ok(Object.hasOwn(projected.data, 'dateCreated'));
            const filter = { _id: resource._id };
            for (const [sort, select] of [[{ name: -1 }, { name: 1, _id: 0 }], [{ dateCreated: 1 }, { name: 0 }]]) {
                await client.request(`/${path}`, { query: { where: filter, sort, select, skip: 0, limit: 0, count: false }, expected: 200 });
            }
            for (const name of ['where', 'sort', 'select', 'skip', 'limit', 'count']) {
                await noChange(`/${path}`, { rawQuery: { [name]: ['{}', '{}'] } });
            }
            for (const where of [
                { name: { $regex: 'a', $options: 'z' } },
                { _id: { $not: { $in: 'bad' } } },
                { $and: [null] },
                { pendingTasks: { $elemMatch: { $in: 1 } } },
            ]) {
                stage = `invalid ${path} query ${JSON.stringify(where)}`;
                await noChange(`/${path}`, { query: { where } });
            }
            const regex = await client.request(`/${path}`, { query: { where: { name: { $regex: fixtures.prefix, $options: 'imsxu' } } }, expected: 200 });
            assert.ok(regex.data.length > 0);
        }

        stage = 'controlled failure after an actual transaction write';
        const prior = await fixtures.snapshot();
        let initialWriteObserved = false;
        await assert.rejects(atomicWrite(async session => {
            await User.updateOne({ _id: a._id }, { $set: { name: fixtures.prefix + 'rollback' } }, { session });
            const during = await User.findById(a._id).session(session).lean();
            assert.equal(during.name, fixtures.prefix + 'rollback');
            initialWriteObserved = true;
            throw new Error('Controlled test-only transaction fault');
        }), /Controlled test-only transaction fault/);
        assert.ok(initialWriteObserved);
        assert.equal(await fixtures.snapshot(), prior);
        assert.equal((await client.request(`/users/${a._id}`, { expected: 200 })).data.name, a.name);
        await fixtures.check();

        stage = 'concurrent rename and assignment remain consistent';
        const renamed = fixtures.prefix + 'renamed';
        const race = await Promise.all([
            client.request(`/users/${a._id}`, { method: 'PUT', json: { name: renamed, email: a.email, pendingTasks: [pending._id] }, expected: 200 }),
            client.request(`/tasks/${pending._id}`, { method: 'PUT', json: fixtures.task('pending', { assignedUser: b._id }), expected: 200 }),
        ]);
        assert.equal(race.length, 2);
        await fixtures.check();
        a = (await client.request(`/users/${a._id}`, { expected: 200 })).data;
        await Promise.all([
            client.request(`/users/${a._id}`, { method: 'PUT', json: { name: fixtures.prefix + 'renamed-again', email: a.email, pendingTasks: a.pendingTasks }, expected: 200 }),
            client.request('/tasks', { method: 'POST', json: fixtures.task('completed-race', { assignedUser: a._id, completed: true }), expected: 201 }),
        ]);
        await fixtures.check();

        stage = 'concurrent completed creation and owner deletion';
        const deletionRace = await Promise.all([
            client.request(`/users/${b._id}`, { method: 'DELETE', expected: 204 }),
            client.request('/tasks', { method: 'POST', json: fixtures.task('delete-race', { assignedUser: b._id, completed: true }) }),
        ]);
        assert.ok([201, 404].includes(deletionRace[1].status));
        await fixtures.check();
        console.log(`Contract matrix passed: ${client.requests} real HTTP requests, ${rejected} rejected-request snapshots, shared invariants, and observed-write rollback.`);
    } catch (error) {
        if (error instanceof assert.AssertionError) throw new Error(`Contract matrix assertion failed at ${stage}: ${error.message}`);
        throw new Error(`Contract matrix failed at ${stage}; database details withheld.`);
    } finally {
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        try {
            if (environment.matches(mongoose.connection)) await fixtures.cleanup();
        } catch { throw new Error('Contract fixture cleanup failed; no unrelated records were targeted.'); }
        finally {
            await mongoose.disconnect().catch(() => {});
            environment.restore();
        }
    }
});
