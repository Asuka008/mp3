const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { test } = require('node:test');
const express = require('express');
const app = require('../app');
const sendResponse = require('../utils/response');
const { ApiError, errorHandler } = require('../middleware/errors');

async function withServer(application, check) {
    const server = application.listen(0, '127.0.0.1');
    try {
        await once(server, 'listening');
        await check(`http://127.0.0.1:${server.address().port}`);
    } finally {
        if (server.listening) {
            await new Promise((resolve, reject) => {
                server.close((err) => err ? reject(err) : resolve());
                server.closeAllConnections();
            });
        }
    }
}

test('app and starter model load without listening, credentials, or database access', () => {
    const result = spawnSync(process.execPath, ['-e', `
        require('node:net').Server.prototype.listen = () => { throw new Error('Unexpected listener'); };
        require('mongoose').connect = () => { throw new Error('Unexpected database connection'); };
        require('dotenv').config = () => { throw new Error('Unexpected environment loading'); };
        const app = require('./app');
        if (typeof app !== 'function') throw new Error('App is not exported');
        require('./server');
        require('./models/user');
    `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
});

test('root returns a static envelope and unknown routes return safe JSON', async () => {
    await withServer(app, async (base) => {
        for (const route of ['/api', '/api/']) {
            const response = await fetch(`${base}${route}`);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                message: 'MP3 API foundation is running.', data: null,
            });
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
        }
        const response = await fetch(`${base}/missing`);
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { message: 'Route not found.', data: null });
        const unknownApi = await fetch(`${base}/api/unknown/nested/path`);
        assert.equal(unknownApi.status, 404);
        assert.deepEqual(await unknownApi.json(), { message: 'Route not found.', data: null });
    });
});

test('actual app parses JSON and nested URL-encoded bodies', async () => {
    // Mount the real app in a harness and observe the body at its 404 boundary.
    const harness = express();
    harness.use((req, res, next) => {
        res.json = (envelope) => {
            assert.equal(res.statusCode, 404);
            assert.equal(envelope.message, 'Route not found.');
            return res.send(JSON.stringify(req.body));
        };
        next();
    });
    harness.use(app);

    await withServer(harness, async (base) => {
        for (const [type, body] of [
            ['application/json', JSON.stringify({ name: 'Example', details: { value: 'test' } })],
            ['application/x-www-form-urlencoded', 'name=Example&details[value]=test'],
        ]) {
            const response = await fetch(`${base}/body-check`, {
                method: 'POST', headers: { 'Content-Type': type }, body,
            });
            assert.equal(response.status, 404);
            assert.deepEqual(await response.json(), { name: 'Example', details: { value: 'test' } });
        }
    });
});

test('malformed JSON produces a safe 400 envelope with CORS', async () => {
    await withServer(app, async (base) => {
        const response = await fetch(`${base}/api`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"private":',
        });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { message: 'Request body is not valid JSON.', data: null });
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
    });
});

test('OPTIONS returns CORS methods and a bodyless 204', async () => {
    await withServer(app, async (base) => {
        const response = await fetch(`${base}/api/tasks`, { method: 'OPTIONS' });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('content-type'), null);
        assert.deepEqual(new Set(response.headers.get('access-control-allow-methods').split(/,\s*/)),
            new Set(['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS']));
        assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/);
    });
});

test('async errors are sanitized and the response helper keeps 204 bodyless', async () => {
    const harness = express();
    harness.get('/unexpected', async () => { throw new Error('private database details'); });
    harness.get('/expected', async () => { throw new ApiError(400, 'Invalid input.'); });
    harness.get('/empty', (req, res) => sendResponse(res, 204, 'Ignored', { hidden: true }));
    harness.use(errorHandler);

    await withServer(harness, async (base) => {
        const unexpected = await fetch(`${base}/unexpected`);
        assert.equal(unexpected.status, 500);
        assert.deepEqual(await unexpected.json(), { message: 'An unexpected server error occurred.', data: null });
        const expected = await fetch(`${base}/expected`);
        assert.equal(expected.status, 400);
        assert.deepEqual(await expected.json(), { message: 'Invalid input.', data: null });
        const empty = await fetch(`${base}/empty`);
        assert.equal(empty.status, 204);
        assert.equal(await empty.text(), '');
        assert.equal(empty.headers.get('content-type'), null);
    });
});
