# Render deployment

Status: local preparation and regression checks are complete. No public service
or URL has been verified yet. Render account sign-in is required before provider configuration.
Do not treat the placeholder in submit.js as a deployment.

## Reviewed destination and service settings

| Setting | Value |
| --- | --- |
| GitHub repository | https://github.com/Asuka008/mp3 |
| Branch | `main` |
| Service type / runtime | Web Service / Node |
| Instance | Free; do not select a paid instance, database, or disk |
| Root directory | Leave empty: package.json and server.js are at repository root |
| Build command | `npm ci` |
| Start command | `npm start` |
| Node setting | `.node-version` pins `24.16.0`; set Render `NODE_VERSION=24.16.0` as well if supplying an override |
| Additional constraints | `.nvmrc` is `24`; package/lockfile engines are `24.x` |
| Health check path | `/api` |
| Port | Use Render's supplied `PORT`; do not set a custom port |

The origin remote and local Git identity both identify Asuka008. The public
repository contains this MP3 assignment and its initial commit matches the local
history. GitHub push authentication was checked with a dry run. Never push to the
course template URL retained as starter package metadata.

## Private configuration

Set only the required secret `MONGODB_URI` in the service's Environment fields,
using the existing ignored local `.env` value privately. It must select the
assignment database, use the assignment database user, and preserve percent
encoding of credentials. Never paste the real value into chat, this document,
commands, screenshots, source files, or build logs.

`NODE_VERSION` is non-secret. No `TOKEN`, test connection, authentication key, or
manually assigned `PORT` is needed by the backend. `.env.test` is for opt-in local
integration tests and must not be supplied to Render. Both private env files and
node_modules remain ignored and untracked.

Atlas must keep the course-required `0.0.0.0/0` IP access entry and the existing
assignment database user's read/write/index privileges. No network rule or
database permission is changed by deploying. Startup awaits connection, a ping,
and required indexes before listening; it reports sanitized failure messages.
A root response alone is not proof of database-backed API behavior.

## Provider steps if account access is unavailable

1. Sign in to https://dashboard.render.com using your own account. If account
   creation requires terms or verification, complete that step yourself.
2. Choose New > Web Service. Connect/select **Asuka008/mp3**, branch **main**.
   If installing Render's GitHub app is necessary, limit its access to the intended
   assignment repository. Confirm the owner/repository before proceeding.
3. Select Node and the **Free** instance. Use the root/build/start/Node settings
   above, and configure the private environment value in Render's fields.
4. Create the service. Inspect Events/build/runtime logs for the intended commit,
   Node 24.16.0, successful `npm ci`, `npm start`, and the sanitized Atlas-ready
   message. Wait for the service to become Live. Resolve errors before claiming
   success; never reveal environment values while reviewing logs.
5. Copy only the resulting non-secret HTTPS base URL. Verify it with the smoke
   command below. Then change only `API_URL` in submit.js to that base URL, without
   `/api` or another path; preserve AUTOGRADER_URL and grading logic.
6. Commit/push that configuration and final deployment evidence. Verify the final
   deployed revision is live and repeat the public smoke check if redeployed.
   Do not run the course autograder or submit the course form in this step.

## Public verification

After the actual URL is known, run:

```sh
node scripts/smoke-deployment.js https://<your-service>.onrender.com
```

The script accepts only a Render HTTPS base URL. It exercises root/database reads,
both resource creations, full user/task replacements, pending/completed owner-name
propagation, transfer and both sides of pending membership, query/projection/count,
rejected mismatch with unchanged state, user deletion/unassignment, task deletion,
repeat/missing reads, and bodyless CORS OPTIONS. Creation dates are preserved.
Only that run's UUID-marked fixtures or tracked ids are cleaned up, with zero
remaining fixture counts checked. It never clears a database or touches unrelated
records. Network failure/forced termination during cleanup can leave identifiable
MP3-SMOKE fixtures; report that explicitly rather than claiming a clean pass.

Public URL, deployed revision, runtime/build evidence, and actual smoke results
will be recorded here after verification. The local regression evidence is in
PROGRESS.md and TESTING.md; it does not imply a public deployment exists.

Local preflight on October 30, 2026: `npm ci` succeeded with zero reported
vulnerabilities; `npm test` passed 36 checks (five opt-in database groups skipped);
`npm run test:integration` passed all five groups, including 792 real HTTP requests
and verified fixture cleanup. All 35 JavaScript files passed syntax checks.
Compatible lockfile updates changed only body-parser 2.3.0 to 2.4.0 and qs 6.16.0
to 6.17.1; Express remains 5.3.0 and Mongoose remains 9.11.1. No paid service,
public smoke run, or official autograder run has occurred.

Free services can sleep after 15 idle minutes and may take about a minute to wake.
Atlas stores the data independently of Render's ephemeral filesystem. No paid
upgrade is required or authorized. See the official references in SOURCES.md.
