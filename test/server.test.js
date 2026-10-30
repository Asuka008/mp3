const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const fixtureUri = 'mongodb+srv://example:example%40password@cluster.example.mongodb.net/mp3';

function run(source, uri = fixtureUri) {
    return spawnSync(process.execPath, ['-e', `require('./models').initializeModels = async () => {};\n${source}`], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, MONGODB_URI: uri, PORT: '0' },
        encoding: 'utf8',
        timeout: 5000,
    });
}

test('missing configuration exits with a safe message without modifying .env', () => {
    const result = spawnSync(process.execPath, ['server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, MONGODB_URI: '' },
        encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /MONGODB_URI is missing/);
    assert.doesNotMatch(result.stderr, /mongodb\+srv:\/\//);
});

test('placeholders, missing database, and local URI never reach a driver connection', () => {
    for (const [uri, message] of [
        ['mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>', 'placeholders'],
        ['mongodb+srv://example:password@cluster.example.mongodb.net/', 'assignment database'],
        ['mongodb://127.0.0.1:27017/mp3', 'Atlas mongodb+srv'],
    ]) {
        const result = run(`
            const mongoose = require('mongoose');
            mongoose.connect = async () => { throw new Error('Driver must not be called'); };
            mongoose.disconnect = async () => {};
            require('./server').start().catch(error => { console.error(error.message); process.exitCode = 1; });
        `, uri);
        assert.ifError(result.error);
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes(message));
        assert.ok(!result.stderr.includes(uri));
        assert.doesNotMatch(result.stderr, /Driver must not be called/);
    }
});

test('connection and ping failures prevent listening and never log raw errors', () => {
    for (const stage of ['connect', 'ping']) {
        const result = run(`
            const assert = require('node:assert/strict');
            const mongoose = require('mongoose');
            let disconnected = false;
            mongoose.disconnect = async () => { disconnected = true; };
            mongoose.connect = async () => {
                if ('${stage}' === 'connect') throw new Error(process.env.MONGODB_URI);
            };
            mongoose.connection.db = { command: async () => { throw new Error(process.env.MONGODB_URI); } };
            require('./app').listen = () => { throw new Error('Unexpected listener'); };
            require('./server').start().then(() => { throw new Error('Unexpected success'); }).catch(error => {
                assert.ok(disconnected);
                console.error(error.message);
                process.exitCode = 1;
            });
        `);
        assert.ifError(result.error);
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, stage === 'connect' ? /could not connect to MongoDB Atlas/ : /database ping failed/);
        assert.ok(!result.stderr.includes(fixtureUri));
        assert.doesNotMatch(result.stderr, /Unexpected listener/);
    }
});

test('server awaits connection and ping before listening, then serves the root response', () => {
    // Driver stubs prove startup ordering only; this is not a real Atlas check.
    const result = run(`
        const assert = require('node:assert/strict');
        const mongoose = require('mongoose');
        let connectDone;
        let pingDone;
        let pingStarted = false;
        let listening = false;
        mongoose.connect = () => new Promise(resolve => { connectDone = resolve; });
        mongoose.connection.db = { command: async command => {
            assert.deepEqual(command, { ping: 1 });
            pingStarted = true;
            return new Promise(resolve => { pingDone = resolve; });
        } };
        const app = require('./app');
        const listen = app.listen.bind(app);
        app.listen = (...args) => { listening = true; return listen(...args); };
        (async () => {
            const starting = require('./server').start();
            assert.equal(listening, false);
            assert.equal(pingStarted, false);
            connectDone();
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(pingStarted, true);
            assert.equal(listening, false);
            pingDone({ ok: 1 });
            const server = await starting;
            try {
                const response = await fetch('http://127.0.0.1:' + server.address().port + '/api');
                assert.equal(response.status, 200);
                assert.deepEqual(await response.json(), { message: 'MP3 API foundation is running.', data: null });
            } finally {
                await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
            }
        })().catch(() => { console.error('Startup ordering or HTTP check failed.'); process.exitCode = 1; });
    `);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /MongoDB Atlas connected and database ping verified/);
    assert.ok(!result.stdout.includes(fixtureUri));
});

test('port failures are sanitized and close the database connection', () => {
    const result = run(`
        const assert = require('node:assert/strict');
        const mongoose = require('mongoose');
        let disconnected = false;
        mongoose.connect = async () => {};
        mongoose.disconnect = async () => { disconnected = true; };
        mongoose.connection.db = { command: async () => ({ ok: 1 }) };
        require('./app').listen = () => { throw new Error(process.env.MONGODB_URI); };
        require('./server').start().catch(error => {
            assert.ok(disconnected);
            console.error(error.message);
            process.exitCode = 1;
        });
    `);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /could not open the HTTP port/);
    assert.ok(!result.stderr.includes(fixtureUri));
    assert.equal(result.stdout, '');
});

test('index failure prevents listening and preserves a safe startup error', () => {
    const result = run(`
        const mongoose = require('mongoose');
        mongoose.connect = async () => {};
        mongoose.disconnect = async () => {};
        mongoose.connection.db = { command: async () => ({ ok: 1 }) };
        require('./models').initializeModels = async () => { throw new Error(process.env.MONGODB_URI); };
        require('./app').listen = () => { throw new Error('Unexpected listener'); };
        require('./server').start().catch(error => { console.error(error.message); process.exitCode = 1; });
    `);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /indexes could not be initialized/);
    assert.ok(!result.stderr.includes(fixtureUri));
    assert.equal(result.stdout, '');
});
