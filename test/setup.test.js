const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');
const { encodeCredential } = require('../scripts/set-atlas-password');

test('password encoder handles reserved punctuation once in the URI component', () => {
    const password = 'example :/?#[]@!$&\'()* ,;=%';
    const encoded = encodeCredential(password);
    assert.equal(decodeURIComponent(encoded), password);
    assert.doesNotMatch(encoded, /[:/?#\[\]@!$&'()* ,;=]/);
    const uri = new URL('mongodb+srv://example:placeholder@cluster.example.mongodb.net/mp3');
    uri.password = encoded;
    assert.equal(decodeURIComponent(new URL(uri.toString()).password), password);
});

test('password helper rejects non-interactive input without modifying .env', () => {
    const fs = require('node:fs');
    const envPath = path.resolve(__dirname, '../.env');
    const before = fs.existsSync(envPath) ? fs.readFileSync(envPath) : null;
    const result = spawnSync(process.execPath, ['scripts/set-atlas-password.js'], {
        cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000,
        input: 'example-not-a-real-password\n',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /interactive terminal/);
    assert.doesNotMatch(result.stderr, /example-not-a-real-password/);
    const after = fs.existsSync(envPath) ? fs.readFileSync(envPath) : null;
    assert.ok(before === null ? after === null : after !== null && after.equals(before), '.env should be unchanged');
});
