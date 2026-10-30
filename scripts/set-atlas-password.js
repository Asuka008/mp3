const fs = require('node:fs/promises');
const path = require('node:path');
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
const dotenv = require('dotenv');

function encodeCredential(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g,
        character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
}

async function main() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error('Run npm run configure:atlas in your own interactive terminal.');
    }
    const envPath = path.resolve(__dirname, '../.env');
    const before = await fs.readFile(envPath, 'utf8');
    const uri = new URL(dotenv.parse(before).MONGODB_URI);
    if (uri.protocol !== 'mongodb+srv:' || !uri.hostname.endsWith('.mongodb.net') || uri.pathname !== '/mp3') {
        throw new Error('Prepare the Atlas host and /mp3 database in .env first.');
    }

    // Discard readline output so the password is never echoed, even on paste.
    const silentOutput = new Writable({ write(chunk, encoding, callback) { callback(); } });
    const input = createInterface({ input: process.stdin, output: silentOutput, terminal: true, historySize: 0 });
    process.stdout.write('Existing Atlas password for mp3_app (hidden): ');
    let password;
    try {
        password = await input.question('');
    } finally {
        input.close();
        process.stdout.write('\n');
    }
    if (!password) throw new Error('Password was empty; .env was not changed.');

    uri.username = 'mp3_app';
    uri.password = encodeCredential(password);
    const after = before.replace(/^MONGODB_URI=.*$/m, () => `MONGODB_URI="${uri.toString()}"`);
    if (after === before) {
        console.log('The local Atlas password is already set to that value.');
        return;
    }
    // Preserve every other entry, including TOKEN; abort if the file changed during input.
    if (await fs.readFile(envPath, 'utf8') !== before) throw new Error('The .env file changed; run the command again.');
    await fs.writeFile(envPath, after, { mode: 0o600 });
    await fs.chmod(envPath, 0o600);
    console.log('Atlas password saved to the ignored local .env; other entries preserved.');
}

if (require.main === module) {
    main().catch(() => {
        console.error('Atlas password setup failed. Use an interactive terminal, check .env, and retry. No credentials were printed.');
        process.exitCode = 1;
    });
}

module.exports = { encodeCredential };
