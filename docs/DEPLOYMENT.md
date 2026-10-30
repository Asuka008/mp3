# Render deployment

Status: **Live and verified** on October 30, 2026.

Public base URL: **https://asuka008-mp3.onrender.com**

API root: https://asuka008-mp3.onrender.com/api

The service uses the assignment's MongoDB Atlas database. Public verification
passed 38 HTTPS requests, including database writes, reference synchronization,
deletion, and fixture cleanup. Subsequent official self-check results and any
corrections are recorded in [GRADING.md](GRADING.md). No course form was submitted.
Latest official self-check: **100/100 (20/20 points)** at 5:45:33 PM CDT,
October 30, 2026, on correction revision `b13fb95`. Successful DELETE now uses
empty 204 responses, as clarified by the grader; earlier deployment smoke records
below describe the preceding release.

The reviewed backend and deployment preparation were committed and pushed to
`Asuka008/mp3` on `main` as
[`77abe2f`](https://github.com/Asuka008/mp3/commit/77abe2fa832022996e32c43f5218177c47310809).
Remote main matched local history after normal pushes. Initial Render deployment
`dep-dbihj2t9fdbs73dmgkdg` built revision `28d86f6` from main. Render automatically
deploys subsequent main pushes, including the verified base URL in submit.js.
API_URL commit [`9e4bd3b`](https://github.com/Asuka008/mp3/commit/9e4bd3b8e97df4db31a3fdcf7a66c0d28aeeb2fe)
was auto-deployed successfully as `dep-dbihl8fb9u1s738iq3i0`; its public smoke
also passed 38 requests after Render reported Live. The final documentation-only
push uses the same backend/configuration and is checked for a healthy deployment
before the final handoff. Render's Deploys page identifies the latest main revision.

## Reviewed destination and service settings

| Setting | Value |
| --- | --- |
| GitHub repository | https://github.com/Asuka008/mp3 |
| Branch | `main` |
| Service name / ID | `asuka008-mp3` / `srv-dbihj2l9fdbs73dmgjqg` |
| Region | Oregon (US West) |
| Service type / runtime | Web Service / Node |
| Instance | Free; do not select a paid instance, database, or disk |
| Root directory | Leave empty: package.json and server.js are at repository root |
| Build command | `npm ci` |
| Start command | `npm start` |
| Node setting | `.node-version` pins `24.16.0`; Render `NODE_VERSION=24.16.0` is configured and confirmed in build logs |
| Additional constraints | `.nvmrc` is `24`; package/lockfile engines are `24.x` |
| Health check path | `/api` |
| Port | Use Render's supplied `PORT`; do not set a custom port |

The origin remote and local Git identity both identify Asuka008. The public
repository contains this MP3 assignment and its initial commit matches the local
history. GitHub push authentication was checked with a dry run. Never push to the
course template URL retained as starter package metadata.

The user approved installing Render's GitHub app for **only Asuka008/mp3** and
completed GitHub's private re-authentication. No other owned repository received
installation access. The provider's default paid compute choice was changed to
Free before creation; no paid instance was deployed.

## Private configuration

The required secret `MONGODB_URI` was transferred from the existing ignored local
`.env` directly into Render's Environment field, then hidden. It selects the
assignment database and user, preserving percent encoding. No real value appears
in chat, this document, commands, screenshots, source files, or build logs. The
original local environment entries and starter TOKEN were preserved.

`NODE_VERSION` is non-secret. No `TOKEN`, test connection, authentication key, or
manually assigned `PORT` is needed by the backend. `.env.test` is for opt-in local
integration tests and must not be supplied to Render. Both private env files and
node_modules remain ignored and untracked.

Atlas must keep the course-required `0.0.0.0/0` IP access entry and the existing
assignment database user's read/write/index privileges. No network rule or
database permission is changed by deploying. Startup awaits connection, a ping,
and required indexes before listening; it reports sanitized failure messages.
A root response alone is not proof of database-backed API behavior.
An authenticated Atlas connection-status check verified the assignment-scoped
readWrite role and ping. The public read/write/transaction workflow also verifies
Render-origin connectivity. The existing course IP access rule was not changed.

## Reproducing the provider configuration

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
   Run the official self-check only when separately authorized, as recorded in
   GRADING.md. It does not submit the course form.

## Public verification

Run against this assignment's service:

```sh
node scripts/smoke-deployment.js https://asuka008-mp3.onrender.com
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

### Actual public evidence

- Initial Render logs identify Asuka008/mp3 main at `28d86f6`, Node **24.16.0 via
  NODE_VERSION**, successful `npm ci` with zero reported vulnerabilities, and
  `npm start` / `node server.js`.
- Runtime logged `Server ready on port 10000; MongoDB Atlas connected and database
  ping verified.` Render reported **Deploy succeeded | Live** after 47.7 seconds,
  with a successful `/api` health check. No startup repair was needed.
- A real public root request returned HTTP 200, JSON content type, and the static
  message/data envelope without environment values.
- The smoke command exited 0: **38 HTTPS requests passed**. Two users and pending/
  completed tasks exercised creation, user renaming, both task owner names, task
  transfer, both users' membership, combined query/projection/count, mismatched-name
  rejection with unchanged task state, user deletion/unassignment, task deletion,
  subsequent/repeated 404s, and bodyless OPTIONS. Cleanup verified zero remaining
  run-owned users/tasks. No unrelated records were targeted.
- Only `API_URL` in submit.js changed to the verified base URL, without `/api`.
  AUTOGRADER_URL and grading logic remain unchanged. Do not execute submit.js just
  to inspect this setting: its entry point invokes the official grader.
- The API_URL auto-deployment (`9e4bd3b`) again confirmed Node 24.16.0, successful
  locked install/startup, Atlas-ready port 10000, and Live after 53.9 seconds.
  The same smoke command passed **38 requests again**, including cleanup, for
  76 workflow requests across the two verified revisions. Standalone root reads
  are additional checks and are not included in that total.
- DELETE correction `b13fb95` deployed as `dep-dbihr5uc6qcc73b3vk2g`, Live after
  37.4 seconds with the same runtime/build/Atlas readiness. Updated public smoke
  passed 38 requests, including both empty 204 DELETE responses and cleanup,
  before the official full-credit run. See GRADING.md for exact source and output.

The local regression evidence is in PROGRESS.md and TESTING.md. Public smoke
coverage is smaller than the 792-request local/Atlas matrix. The actual official
score, feedback, and graded source revision are recorded separately in GRADING.md.

Local preflight on October 30, 2026: `npm ci` succeeded with zero reported
vulnerabilities; `npm test` passed 36 checks (five opt-in database groups skipped);
`npm run test:integration` passed all five groups, including 792 real HTTP requests
and verified fixture cleanup. All 35 JavaScript files passed syntax checks.
Compatible lockfile updates changed only body-parser 2.3.0 to 2.4.0 and qs 6.16.0
to 6.17.1; Express remains 5.3.0 and Mongoose remains 9.11.1. No paid service was
provisioned. The deployment step itself did not run the official grader; the
separately authorized self-check and DELETE 204 clarification are in GRADING.md.

Free services can sleep after 15 idle minutes and may take about a minute to wake.
Atlas stores the data independently of Render's ephemeral filesystem. No paid
upgrade is required or authorized. See the official references in SOURCES.md.
