const { once } = require('node:events');
const mongoose = require('mongoose');
const app = require('./app');
const { initializeModels } = require('./models');

function configurationError(value) {
    if (!value || !value.trim()) {
        return 'Startup failed: MONGODB_URI is missing. Set it privately in .env or the process environment.';
    }
    if (/[<>\s]/.test(value)) {
        return 'Startup failed: MONGODB_URI contains placeholders or unencoded whitespace. Complete the Atlas URI in .env.';
    }

    try {
        const uri = new URL(value);
        // This project uses the default Atlas SRV connection string, not a local database.
        if (uri.protocol !== 'mongodb+srv:' || !uri.hostname.endsWith('.mongodb.net') || uri.hash) {
            return 'Startup failed: use the Atlas mongodb+srv connection string from Connect > Drivers.';
        }
        if (!uri.username || !uri.password) {
            return 'Startup failed: the Atlas URI needs database-user credentials. Enter them privately in .env.';
        }
        decodeURIComponent(uri.username);
        if (decodeURIComponent(uri.password) === 'REPLACE_WITH_DATABASE_PASSWORD') {
            return 'Startup failed: the Atlas database password is not configured. Run npm run configure:atlas privately.';
        }
        const database = decodeURIComponent(uri.pathname.slice(1));
        if (!database || database.includes('/') || ['admin', 'config', 'local'].includes(database)) {
            return 'Startup failed: select an assignment database such as /mp3 before the URI query string.';
        }
    } catch {
        return 'Startup failed: MONGODB_URI is invalid. Check the Atlas URI and percent-encoded credentials privately.';
    }
    return null;
}

async function start() {
    let server;
    let failureMessage = 'Startup failed: could not load server configuration.';

    try {
        // Existing process variables take precedence over the local ignored file.
        require('dotenv').config({ quiet: true });
        const problem = configurationError(process.env.MONGODB_URI);
        if (problem) {
            failureMessage = problem;
            throw new Error();
        }

        // Never log raw driver errors, which can include connection details.
        mongoose.connection.on('error', () => {
            console.error('Database connection error. Check Atlas connectivity and database-user access.');
        });
        failureMessage = 'Startup failed: could not connect to MongoDB Atlas. Check database-user credentials, cluster status, and the IP access list.';
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

        failureMessage = 'Startup failed: the MongoDB Atlas database ping failed. Check Atlas connectivity and database-user access.';
        const ping = await mongoose.connection.db.command({ ping: 1 });
        if (ping.ok !== 1) throw new Error();

        failureMessage = 'Startup failed: database indexes could not be initialized. Check database access and existing email conflicts; no records were removed.';
        await initializeModels();

        failureMessage = 'Startup failed: could not open the HTTP port. Check PORT and whether another server is using it.';
        server = app.listen(process.env.PORT || 3000);
        await once(server, 'listening');
        console.log(`Server ready on port ${server.address().port}; MongoDB Atlas connected and database ping verified.`);
        return server;
    } catch {
        if (server && server.listening) server.close();
        await mongoose.disconnect().catch(() => {});
        // Throw only a message authored here; never pass through the original error.
        throw new Error(failureMessage);
    }
}

if (require.main === module) {
    start().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { start };
