const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function configureTestEnvironment() {
    const file = process.env.MP3_TEST_ENV_FILE || path.resolve(__dirname, '../.env.test');
    let uri;
    try {
        const values = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
        uri = process.env.TEST_MONGODB_URI || values.TEST_MONGODB_URI;
        if (!uri || /[<>\s]/.test(uri)) throw new Error();
        const parsed = new URL(uri);
        const database = decodeURIComponent(parsed.pathname.slice(1));
        if (parsed.protocol !== 'mongodb+srv:' || !parsed.hostname.endsWith('.mongodb.net') ||
            !parsed.username || !parsed.password || !database || database.includes('/') ||
            ['admin', 'config', 'local'].includes(database)) throw new Error();
        const previous = { MONGODB_URI: process.env.MONGODB_URI, PORT: process.env.PORT };
        process.env.MONGODB_URI = uri;
        process.env.PORT = '0';
        return {
            database,
            matches(connection) { return connection.readyState === 1 && connection.db.databaseName === database; },
            restore() {
                for (const [key, value] of Object.entries(previous)) {
                    if (value === undefined) delete process.env[key];
                    else process.env[key] = value;
                }
            },
        };
    } catch {
        throw new Error('Integration configuration unavailable: set TEST_MONGODB_URI privately in ignored .env.test or the test process environment.');
    }
}

module.exports = { configureTestEnvironment };
