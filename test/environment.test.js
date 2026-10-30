const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('integration environment is explicit, sanitized, and restores production variables', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mp3-test-env-'));
    const file = path.join(directory, '.env.test');
    const run = source => spawnSync(process.execPath, ['-e', source], {
        cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000,
        env: { ...process.env, MP3_TEST_ENV_FILE: file, TEST_MONGODB_URI: '', MONGODB_URI: 'production-marker', PORT: '1234' },
    });
    try {
        const missing = run(`
            const assert = require('node:assert/strict');
            assert.throws(() => require('./testing/environment').configureTestEnvironment(), /TEST_MONGODB_URI/);
            assert.equal(process.env.MONGODB_URI, 'production-marker');
        `);
        assert.equal(missing.status, 0, missing.stderr);
        fs.writeFileSync(file, 'TEST_MONGODB_URI="mongodb+srv://example:example-password@cluster.example.mongodb.net/mp3_separate_test"\n');
        const configured = run(`
            const assert = require('node:assert/strict');
            const config = require('./testing/environment').configureTestEnvironment();
            assert.equal(config.database, 'mp3_separate_test');
            assert.equal(process.env.PORT, '0');
            config.restore();
            assert.equal(process.env.MONGODB_URI, 'production-marker');
            assert.equal(process.env.PORT, '1234');
        `);
        assert.equal(configured.status, 0, configured.stderr);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
