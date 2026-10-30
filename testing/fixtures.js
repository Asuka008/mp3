const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { User, Task } = require('../models');
const { assertFixtureInvariants } = require('./invariants');

class Fixtures {
    constructor() {
        const id = randomUUID();
        this.prefix = `MP3-CONTRACT-${id}-`;
        this.emailPrefix = `mp3-contract-${id}-`;
        this.userIds = new Set();
        this.taskIds = new Set();
    }

    user(label, fields = {}) {
        return { name: this.prefix + label, email: `${this.emailPrefix}${label}@example.invalid`, ...fields };
    }

    task(label, fields = {}) {
        return { name: this.prefix + label, deadline: '2000-01-01', ...fields };
    }

    filter(kind) {
        const ids = kind === 'users' ? this.userIds : this.taskIds;
        const marker = kind === 'users' ? { email: { $regex: '^' + this.emailPrefix } } : { description: { $regex: '^' + this.prefix } };
        return { $or: [{ _id: { $in: [...ids] } }, { name: { $regex: '^' + this.prefix } }, marker] };
    }

    async read() {
        return {
            users: await User.find(this.filter('users')).sort({ _id: 1 }).lean(),
            tasks: await Task.find(this.filter('tasks')).sort({ _id: 1 }).lean(),
        };
    }

    async snapshot() { return JSON.stringify(await this.read()); }

    async check() {
        const state = await this.read();
        assertFixtureInvariants(state.users, state.tasks);
    }

    async cleanup() {
        await Task.deleteMany(this.filter('tasks'));
        await User.deleteMany(this.filter('users'));
        assert.equal(await Task.countDocuments(this.filter('tasks')), 0, 'Task fixtures remain');
        assert.equal(await User.countDocuments(this.filter('users')), 0, 'User fixtures remain');
    }
}

function createClient(base, fixtures) {
    let requests = 0;
    return {
        get requests() { return requests; },
        async request(path, { method = 'GET', json, form, query = {}, rawQuery = {}, expected } = {}) {
            const url = new URL(base + '/api' + path);
            for (const [name, value] of Object.entries(query)) url.searchParams.set(name, JSON.stringify(value));
            for (const [name, value] of Object.entries(rawQuery)) {
                for (const entry of Array.isArray(value) ? value : [value]) url.searchParams.append(name, entry);
            }
            const options = { method, signal: AbortSignal.timeout(15000), headers: { Origin: 'https://mp3-test.example.invalid' } };
            if (json !== undefined) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(json);
            }
            if (form) {
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                options.body = new URLSearchParams(form).toString();
            }
            requests++;
            const response = await fetch(url, options);
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
            if (method === 'DELETE' && response.ok) {
                assert.equal(response.status, 204);
                if (expected !== undefined) assert.equal(response.status, expected);
                assert.equal(await response.text(), '');
                assert.equal(response.headers.get('content-type'), null);
                return { status: 204 };
            }
            assert.match(response.headers.get('content-type'), /application\/json/);
            const body = await response.json();
            assert.deepEqual(Object.keys(body).sort(), ['data', 'message']);
            assert.ok(typeof body.message === 'string' && body.message.length > 0);
            if (method === 'POST' && body.data?._id && ['/users', '/tasks'].includes(path)) {
                (path === '/users' ? fixtures.userIds : fixtures.taskIds).add(body.data._id);
            }
            if (!response.ok) {
                assert.equal(body.data, null);
                assert.doesNotMatch(body.message, /Mongo|stack|E11000|mongodb\+srv/);
            }
            if (expected !== undefined) assert.equal(response.status, expected, `${method} ${path}: ${body.message}`);
            return { status: response.status, ...body };
        },
    };
}

module.exports = { Fixtures, createClient };
