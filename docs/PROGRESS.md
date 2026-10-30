# MP3 handoff

Last updated: October 30, 2026 (America/Chicago).

Current status: the Free Render API is live. The first official self-check scored
90/100; successful DELETE status/body expectations are being corrected and verified
in Step 9. The course form has not been submitted. Earlier records describe
the preceding steps and their results at
those times. Preserve these records for handoffs.

## Scope and completed work

Completed only the backend foundation and requirements-checklist step. No business
endpoint, complete schema, database connection, deployment, or submission is claimed.

- Read README.md, FAQ.md, package.json, the parsed lockfile, server.js, all starter
  files under routes/ and models/, .env.example, .gitignore, and submit.js.
  Searched the repository and checked ancestor directories for AGENTS.md; none found.
- Checked Git status before edits: clean. No unrelated existing changes needed
  preservation. Course files, submit.js, starter model, and .gitignore remain unchanged.
- Verified Node `v24.16.0`, npm `11.13.0`, and Git `2.39.5 (Apple Git-154)`.
- Installed dependencies with the existing lockfile. Installed top-level versions:
  dotenv `17.4.2`, Express `5.3.0`, Mongoose `9.11.1`, nodemon `3.1.14`.
  Every locked dependency resolution is unchanged.
- Constrained package/lockfile Node engines to `24.x` and added `.nvmrc` with `24`.
  Use `nvm use` in environments with nvm; do not follow a moving newer-major LTS.
- Exported the Express app without environment loading, database access, or listening.
  `npm start` still loads environment variables and starts through server.js, using
  `process.env.PORT` or fallback `3000`.
- Kept CommonJS, JSON parsing, nested URL-encoded parsing, and CORS. Added bodyless
  `204` OPTIONS handling, shared JSON response helper, safe errors, and JSON 404s.
- Replaced the root response that exposed TOKEN with a static foundation response.
- Created `.env` from `.env.example` only because `.env` was absent. No existing
  credentials were overwritten; `.env` contents were not displayed. `.env.example`
  and its TOKEN convention remain unchanged; database values are still placeholders.
- Added the ten-operation checklist, grading weights, course obligations, documented
  interpretations, source log, and six database-free foundation tests.

## Changed files

| File | Change |
| --- | --- |
| `app.js` | Express setup, CORS/parsers, routes, errors, exported app |
| `server.js` | Quiet environment loading and listener; database startup deferred |
| `routes/home.js` | Static `/api` response using the shared envelope |
| `utils/response.js` | Envelope helper, with bodyless `204` handling |
| `middleware/errors.js` | Explicit safe API errors, parser errors, generic 500, 404 |
| `package.json` | Node 24.x constraint and built-in `npm test` command |
| `package-lock.json` | Root Node constraint only; no resolved-package changes |
| `.nvmrc` | Local Node major 24 |
| `test/foundation.test.js` | Six integration/import checks, no database dependency |
| `docs/REQUIREMENTS.md` | Explicit course requirements and separate project choices |
| `docs/SOURCES.md` | Actually consulted sources and LLM disclosure obligations |
| `docs/PROGRESS.md` | This handoff |
| `.env` (ignored, local only) | Created from the existing placeholder template |

## Commands actually run and results

Repository inspection used `pwd`, `rg --files` (including an AGENTS.md search),
`ls -la`, `cat` on the required files, ancestor AGENTS.md checks, `git status --short`,
and `git ls-files`. Inline Node scripts parsed/compared package.json and the full
lockfile; the root dependency declarations were consistent before installation.

| Command/check | Verified result |
| --- | --- |
| `node --version`, `npm --version`, `git --version` | Versions recorded above |
| `npm ci --no-audit --no-fund` | First restricted attempt failed with registry DNS `ENOTFOUND`; approved network retry installed 111 packages successfully |
| Guarded `cp -n .env.example .env` | Created the absent local file only |
| `npm ls --depth=0` | Expected four top-level dependencies, no reported dependency errors |
| `node --check` on foundation/starter JavaScript | Passed; final inline script checked all nine JavaScript files, including tests |
| `npm test` | Final run: 6 passed, 0 failed; no database accessed |
| Inline Node PORT checks with a stub listener | Explicit PORT `4321` respected; absent PORT defaults to numeric `3000`; no port opened for these checks |
| `PORT=38427 npm start` | Started through server.js on the configured port |
| Inline Node `fetch`/assert check against local `/api` | `200` and exact static envelope; temporary server stopped with Ctrl-C afterwards |
| Inline Node package/runtime/lockfile assertions | Node 24, `.nvmrc`, engines consistent; only lockfile root engines changed compared with `git show HEAD:package-lock.json` |
| `git check-ignore -v .env` | `.gitignore` line 12 ignores `.env` |
| `git ls-files --error-unmatch .env` (guarded) | Confirmed `.env` is not tracked, without reading contents |
| `git diff -- .gitignore .env.example submit.js models/user.js` | No changes |
| `git diff --check` | Passed |

The first test run could not open local ports under restricted execution. Its
cleanup initially obscured the listener error with `ERR_SERVER_NOT_RUNNING`; the
test helper was corrected to close only a listening server. A retry exposed
`listen EPERM`; approved loopback execution then passed all six tests. These
execution restrictions are resolved, not current blockers.

The passing tests verify import without port/environment/database side effects;
static root and missing-route envelopes; actual JSON and nested URL-encoded body
parsing; safe malformed-JSON errors with CORS; empty `204` preflight responses;
and safe async-error handling plus the response helper's empty `204` behavior.
Harness-only routes in tests are not business endpoints.

## Assumptions and open decisions

See [REQUIREMENTS.md](REQUIREMENTS.md) for the precise distinction between course
rules and project choices. Future implementation will use total matching count
before pagination, `200` JSON envelopes for DELETE, `data: null` for errors,
reasonable documented defaults, and the FAQ's detailed user PUT ordering for
checks that require loading references. The course does not fully specify count
with pagination, one DELETE success code, or every mixed-failure tie-break.

Transactions are the planned mechanism for multi-document failure atomicity; this
has not been implemented or tested. No online references were consulted. LLM
assistance must be disclosed as described in [SOURCES.md](SOURCES.md).

## Blockers and next step

No blocker remains for this foundation step. Real Atlas credentials, connection,
transaction support, and Render configuration are not verified. The root response
only proves that Express is serving; it does not indicate database readiness.

Next step, when authorized: implement complete User/Task schemas and explicit
validation/defaults, then database startup and transaction-backed reference
operations following REQUIREMENTS.md. Test database persistence, failure atomicity,
and all ten operations before deploying or running the course autograder. Keep
the API_URL placeholder in submit.js until an actual deployment exists. Preserve
the chatlog for submission. No `npm run submit`, deployment, or commit was performed.

## Step 2: Atlas connection and startup (completed)

This section supersedes the earlier database-startup deferral and next-step notes.
Read the course files, REQUIREMENTS.md, this handoff, and current server/environment
configuration before editing. No applicable AGENTS.md was found. Git status already
contained the preceding step's changes; they were preserved. No dependencies or
lockfile resolutions changed in this step. Runtime remains Node 24.16.0 with
Mongoose 9.11.1 and its MongoDB Node driver 7.7.0.

### Atlas and local configuration

- Initial private inspection found the starter URI placeholder in `.env`, no
  process-level URI, and the unchanged starter TOKEN; no secret values were printed.
- The available Atlas browser session required sign-in, which the user completed.
- Created cluster `mp3` in the existing project, choosing **Free** (`$0/hour`), AWS
  N. Virginia, without sample data or automated security setup. Atlas confirmed the
  cluster active and Free; no paid resources were provisioned.
- Prepared database-user privileges: `readWrite` on database `mp3`, all its
  collections, restricted to cluster `mp3`. The user entered/saved `mp3_app`'s new
  credentials and submitted the user form; Atlas confirmed the saved role/scope.
- Submitted `0.0.0.0/0` after the user's action-time approval; Atlas showed it Active.
  This implements the course's Allow Access from Anywhere requirement.
- Obtained the default SRV template from Atlas's connection UI, showing JavaScript
  and Node.js Driver. Kept its host/options, selected `/mp3`, and added
  `authSource=admin`. No full URI or password appears in this handoff or setup docs.
- Browser credential reads returned redacted values. An initial connection attempt
  therefore failed with sanitized output; it did not establish database readiness.
  Replaced that invalid local entry with an explicit password placeholder and added
  a hidden local password prompt. The user then ran `npm run configure:atlas` in
  their own terminal to supply the existing database password privately.
- The helper percent-encodes the password component once, preserves all other `.env`
  entries, and sets owner-only file permissions (`0600`). TOKEN and .env.example are
  unchanged; `.env` remains ignored and untracked. The final real connection worked.

### Code and documentation changed in this step

- `server.js`: exports `start` behind a main-module guard; loads environment quietly
  at startup, validates an Atlas SRV URI and explicit non-system database, awaits
  Mongoose connection and a selected-database ping, then listens and reports ready.
  Uses `serverSelectionTimeoutMS: 10000`, no obsolete options or Mongoose callbacks.
  Connection/ping/listener failures are sanitized and disconnect the database;
  CLI failures set exit status `1`. PORT handling and fallback `3000` are retained.
- `scripts/set-atlas-password.js` and package.json's `configure:atlas` command:
  private interactive input, credential encoding, and a narrow local URI update.
- `test/server.test.js`, `test/setup.test.js`, and the import test in
  `test/foundation.test.js`: startup sequencing/failures, safe output, encoding,
  and credential-free imports. Test driver stubs do not stand in for Atlas proof.
- `docs/SETUP.md`: current UI steps, separate Atlas/database credentials, restricted
  roles, course IP rule, private environment setup, startup, and verification.
- `docs/REQUIREMENTS.md`: Atlas configuration completed; startup deferral updated.
- `docs/SOURCES.md` and this file: actual official references and observed results.
- Local ignored `.env`: only MONGODB_URI updated with the actual Atlas configuration;
  other entries preserved. Starter app behavior, routes, models, .gitignore,
  .env.example, submission script, and existing dependency versions were preserved.

### Commands/checks actually run and results

| Command/check | Actual result |
| --- | --- |
| `git status --short`, AGENTS.md searches/ancestor checks, `cat` on required docs/configuration | Existing foundation work preserved; no additional instructions found |
| Inline Node/dotenv private assessment | Initially placeholder URI; starter TOKEN preserved; no values displayed |
| `node --version`, `npm ls --depth=0`, `npm ls mongodb` | Node 24.16.0; existing dependencies intact; MongoDB driver 7.7.0 |
| Initial `MONGODB_URI='' npm start` | Sanitized missing-configuration message, exit 1, no listener |
| `npm test` before credential helper | 11 passed, 0 failed using local-port approval |
| First `PORT=38427 npm start` after browser credential capture | Sanitized connection failure; browser had returned redacted credential values; resolved by private local input |
| Inline credential-encoding assertion with dummy punctuation | Round-trip preserved characters and encoded reserved punctuation without using real secrets |
| User-run `npm run configure:atlas` | User confirmed password saved locally; subsequent real connection independently verifies usable credentials |
| Final `PORT=38427 npm start` | Real Atlas connection and selected-database ping succeeded before readiness/listening |
| Inline Node `fetch`/assert against running `/api` | HTTP 200 and exact expected static envelope |
| Independent inline Mongoose verification | Connected to Atlas, asserted database name `mp3`, ping returned `ok: 1` |
| Independent database setup command | Created an empty `users` collection if absent, materializing `mp3`; no documents inserted or deleted |
| Final `npm test` | 13 passed, 0 failed; local HTTP tests and driver-stub startup checks |
| Ctrl-C on temporary server | Verification server stopped after checks |
| Repeated `MONGODB_URI='' npm start` with real .env present | Correct sanitized missing-configuration message and exit 1; real .env not changed |
| Inline `node --check` sweep | All 11 foundation/startup/helper/test JavaScript files checked passed |
| Private environment assertions | Atlas SRV host, `/mp3`, no password placeholder, original TOKEN, and file permissions 0600 confirmed without displaying values |
| `git check-ignore -v .env`, guarded `git ls-files --error-unmatch .env` | Ignored by .gitignore line 12 and not tracked |
| `git diff --check` | Passed |

### Verified scope, assumptions, blockers, next step

Real Atlas connectivity, selected database, ping, collection-creation access, and
root HTTP response were verified separately. Startup only opens a port after its
own successful connection/ping. A root response alone is not database evidence.
The fake success paths in unit/integration tests are labeled explicitly.

This project's setup uses the default Atlas SRV format on a `.mongodb.net` host
and rejects system databases. Names `mp3` and `mp3_app`, explicit `authSource=admin`,
and the 10-second selection timeout are project choices, not extra course rules.
Future connectivity loss can still occur after startup; this step does not add a
continuously polled readiness endpoint or implement business/database invariants.

No blocker or required manual action remains for this step. No local-only database
was substituted. Business endpoints, complete schemas, transactions/failure
atomicity, deployment, and submission remain unimplemented/unverified. When next
authorized, implement schemas/validation/defaults and the business operations from
REQUIREMENTS.md against this Atlas database. No deployment, autograder run, or
commit was performed. Preserve the chatlog and source disclosures for submission.

## Step 3: Data contract, validation, errors, and atomic-write foundation (completed)

Read README.md, FAQ.md, REQUIREMENTS.md, the prior handoff, and current code before
editing. Rechecked repository/ancestor AGENTS.md locations; none found. The working
tree already contained the preceding steps' changes; those were preserved. No
dependency upgrade, credential change, endpoint registration, or deployment was made.

### Implemented

- Complete User and Task models with the required business fields/defaults, Date
  values, immutable server-default `dateCreated`, and string references. Required
  strings reject Mongoose coercion and blank values. User email has a unique index.
- Whitelisted payload builders reject invalid bodies/types and supply replacement
  defaults. They exclude `_id`, `dateCreated`, `__v`, unknown fields, and update
  operators. Client dates never enter model construction through these helpers.
- Explicit JSON/form policy: JSON booleans/arrays stay strict; URL-encoded bodies
  may use exact `"true"`/`"false"` and JSON text for pending task arrays, in addition
  to parser-produced arrays. Callers pass `formEncoded: true` for form bodies.
- `prepareUserWrite` / `prepareTaskWrite` check the URL resource first for PUT,
  then formats/values, duplicate email for User, referenced-resource existence,
  and loaded-document checks (completion/name matching). They perform no writes.
  All dependent queries take the supplied session. Malformed URL ids are `404`,
  malformed body references `400`, and well-formed absent references `404`.
- Assigned names are filled only after loading the user, or rejected on an
  explicit mismatch. Unassigned pairs normalize to `""` / `"unassigned"` after
  checking input types. References remain strings; loaded documents are returned
  separately for later synchronization services.
- Safe error mapping for real email duplicate-key failures and recognized schema,
  cast, and strict-field errors (`400`). Unexpected errors stay sanitized `500`.
  Existing malformed-JSON handling and the message/data envelope remain intact.
- Startup awaits model/collection/index initialization before listening. Index
  conflicts fail with a sanitized startup message; no conflicting records or
  indexes are deleted to make initialization succeed.
- `atomicWrite` uses Mongoose's connection transaction wrapper, snapshot reads,
  primary read preference, and majority writes. It never falls back to standalone
  partial writes. `saveReplacement` requires an active session, re-whitelists the
  payload, resets omitted optional fields, and preserves id/creation date using
  document overwrite/save. Success responses belong after the wrapper resolves,
  not inside the potentially retried callback.

### Files changed in this step

| File | Change |
| --- | --- |
| `models/user.js` | Full user schema and unique email index |
| `models/task.js` | New task schema/defaults with string assignment reference |
| `models/index.js` | Shared model exports and awaited initialization |
| `services/validation.js` | Payload/default/type/id/reference validation and write preparation |
| `services/writes.js` | Transaction wrapper and session-required replacement persistence |
| `middleware/errors.js` | Safe duplicate-key and recognized model error mapping |
| `server.js` | Await required indexes before opening the HTTP port |
| `package.json` | Explicit opt-in `test:atlas` command; dependencies unchanged |
| `test/validation.test.js` | Local schema, normalization, precedence, session, and error checks |
| `test/atlas.test.js` | Opt-in real Atlas index/concurrency/replacement/rollback fixture test |
| `test/server.test.js` | Stub index initialization in local tests; test safe index-startup failure |
| `docs/REQUIREMENTS.md` | Foundation checklist status and precise helper/policy decisions |
| `docs/SETUP.md` | Index startup/verification and deliberate conflict handling |
| `docs/SOURCES.md`, `docs/PROGRESS.md` | Actual references and this handoff |

App importability, body parsers, CORS, the static root route, PORT handling, Node 24,
existing dependency resolutions, submission script, .env.example, .gitignore, and
the private .env entries were preserved. No business routes were added.

### Commands/checks actually run and results

| Command/check | Result |
| --- | --- |
| `git status --short`, `rg --files`, ancestor AGENTS.md checks, `cat`/targeted reads of course/docs/code | Existing changes inventoried and preserved; no AGENTS.md found |
| `rg`/targeted reads of installed Mongoose schema/document/timestamp code | Verified strict casts, array behavior, and immutable-date overwrite semantics |
| Inline Node payload/model smoke check | Defaults and required-string rejection worked; `validateSync` emitted a deprecation notice, so committed tests use async `validate()` |
| Initial `npm test` after local validation additions | 26 passed, 0 failed |
| `npm run test:atlas` with approved network access | Real Atlas test passed; indexes awaited before writes; no business endpoints exercised |
| Final `npm test` | 26 local tests passed, 0 failed; the 1 opt-in Atlas test skipped as designed |
| `PORT=38427 npm start` | Connected and pinged Atlas, initialized models/indexes, then reported ready |
| Inline local `fetch`/assert | Preserved exact root envelope with HTTP 200 after real startup |
| Ctrl-C on the temporary server | Verification server stopped |
| `node --check` sweep | All 18 JavaScript files passed, including helpers/tests and submit.js |
| Inline Node runtime/lock assertions | Node major 24 and dependency/devDependency/engine declarations still match the lockfile |
| `git check-ignore -v .env` and guarded `git ls-files --error-unmatch .env` | .env ignored by line 12 and not tracked; contents not displayed |
| `git diff --check` | Passed |

The real Atlas test inspected the unique email index, bypassed the preliminary
lookup to provoke an actual duplicate-key failure, and checked its safe `400`
envelope mapping. Two independent transactions attempted the same new email;
exactly one committed. It also verified default dates/values and writable-field
whitelisting, URL/reference precedence, assigned-name derivation/rejection,
completed-task rejection, replacement optional resets, unchanged creation dates,
and rollback after modifying two documents then rejecting the transaction.
Fixture cleanup targeted only this run's preallocated ids and verified that all
fixture records were gone. Existing assignment data and indexes were not dropped.

### Decisions, limits, and next step

Full normalization/helper usage is in REQUIREMENTS.md. Email strings retain exact
case/whitespace (blank required strings are rejected), with no domain/format rule.
Deadlines may be past; strings must parse to finite dates, and impossible ISO
calendar dates are rejected. Body reference ids are canonical lowercase strings
and pending ids are deduplicated. These representation choices are not attributed
to the course as additional requirements.

The README/FAQ mixed missing-task/completed-task ambiguity is still documented;
the helpers follow the FAQ's detailed ordering after all task references exist.
An explicit stale string name supplied with no assigned user normalizes to
`"unassigned"`; an explicit conflicting name for an assigned user is rejected.

No blocker remains for this step. Tests verify helpers and database mechanisms,
not unimplemented endpoint behavior or full two-way-reference synchronization.
Future mutation services must prepare/validate inside `atomicWrite`, pass its
session to every related operation, synchronize both sides, and respond only
after commit. GET operations should use the shared id checks where applicable.

Stop here. The next authorized step implements POST and GET endpoints using these
models/helpers and the assignment checklist. PUT/DELETE endpoint behavior,
complete reference synchronization/concurrency, deployment, and submission remain
future work. No autograder run, deployment, or commit was performed.

## Step 4: Six POST/GET operations (completed)

This section supersedes the preceding next-step note. Read README.md, FAQ.md,
REQUIREMENTS.md, the previous handoff, and current models/helpers/routes before
editing. Checked Git status first and preserved all existing work. Repository
and ancestor searches found no applicable AGENTS.md. No dependency or runtime
change, credential edit, PUT/DELETE route, deployment, or submission was added.

### Implemented behavior

- `POST /api/users` and `POST /api/tasks` return 201 with the persisted resource
  in the normal message/data envelope, after the transaction commits. They use
  existing explicit validation/defaults, field whitelists, unique email index,
  reference checks, safe errors, and server-generated creation dates.
- User creation deduplicates and validates the entire pending task list before
  mutation. In one transaction it creates the user, removes those ids from any
  previous owners' pending lists, and sets the tasks' assigned user id/name.
- Task creation validates/derives the assigned user's name. Pending assignments
  use `$addToSet`; completed tasks retain their user/name without joining pending
  lists. Empty assignment normalizes to the canonical unassigned pair.
- All dependent creation operations receive the transaction session and execute
  serially. Success is sent only after commit. Rejected requests, including
  injected failures after insertion and previous-owner updates, leave no partial
  creation/reference changes.
- `GET /api/users` and `GET /api/tasks` parse the six applicable parameters as
  JSON, validate shapes/values, and use Mongoose/MongoDB for all filtering,
  sorting, projection, skipping, limiting, and counting. Operators such as `$in`,
  `$or`, regex, and `$expr` are preserved rather than stripped.
- Users default to unlimited and tasks to 100 results; explicit zero limit is
  unlimited. `count=true` returns total matching documents before pagination,
  following the existing project decision; `count=false` returns documents.
- `GET /api/users/:id` and `GET /api/tasks/:id` return one object or 404. Only
  select is parsed; other parameters are ignored even if malformed. Projection
  uses Mongoose, supports inclusion/exclusion including `_id: 0`, and follows a
  resource-existence check. Missing resources win over invalid select as a
  documented project precedence choice.
- Empty collection results are 200 with `[]`/`0`. Invalid JSON, query shapes,
  common operand types, projections, and recognized query syntax/casting errors
  return safe 400 envelopes. Unexpected database failures remain sanitized 500s.

### Files changed in this step

| File | Change |
| --- | --- |
| `services/create.js` | Transactional user/task creation and two-way reference changes |
| `services/queries.js` | Applicable query parsing/validation and database-side collection/single reads |
| `routes/resources.js` | Six shared async POST/GET handlers |
| `routes/index.js` | Register the resource routes with the existing API router |
| `test/queries.test.js` | Defaults, query shape/operator validation, delegation, and single-resource policies |
| `test/http-atlas.test.js` | Real HTTP creation/persistence/assignment/query/rollback verification with UUID fixtures |
| `package.json` | Run both opt-in Atlas checks through `npm run test:atlas` |
| `docs/API.md` | Implemented operations and correctly encoded curl examples |
| `docs/REQUIREMENTS.md` | Six operations/query checklist completed; choices documented separately |
| `docs/SETUP.md`, `docs/SOURCES.md`, `docs/PROGRESS.md` | Actual verification instructions, references, and handoff |

Existing models, validation/error/transaction helpers, app/server setup, root route,
JSON/form parsers, CORS, Node 24 constraint, dependency resolutions, private .env,
TOKEN convention, .gitignore, course files, and submission script were preserved.

### Commands/checks actually run

| Command/check | Actual result |
| --- | --- |
| `git status --short`, `rg --files`, ancestor AGENTS.md checks, course/docs/code reads | Existing work inventoried and preserved; no AGENTS.md found |
| Targeted `rg`/`sed` reads of installed Mongoose query casters | Checked implicit operand wrapping and differing unsupported-operator errors |
| `npm test` during implementation | Local checks passed; opt-in Atlas tests skipped as designed |
| `npm run test:atlas` during implementation | Passed model foundation plus 102 HTTP requests, then 107 after nested filter checks |
| Final `npm test` | 33 passed, 0 failed; 2 Atlas checks skipped as designed |
| Final `npm run test:atlas` with approved network/local-port access | Both Atlas checks passed; final HTTP test exercised 109 actual requests |
| Real startup inside HTTP verification via `server.start()` | Atlas connection/ping and indexes completed before listening on a temporary port |
| Fixture cleanup assertions | This run's generated ids/UUID markers removed; zero remaining fixture matches |
| Syntax sweep via `node --check` | All 23 JavaScript files passed |
| Inline Node runtime/lockfile checks | Node major 24; dependency/devDependency/engine declarations still match lockfile |
| API example checks | All 17 curl query values parse as JSON and encode/round-trip correctly; example ids are 24 hex characters |
| `git check-ignore -v .env` and guarded `git ls-files --error-unmatch .env` | Ignored by .gitignore line 12 and untracked; no secret values displayed |
| `git diff --check` | Passed |

The final HTTP run tested JSON and URL-encoded creation, actual stored values,
defaults/date ownership, malformed input/JSON, unique and concurrent duplicate
email handling, both assignment directions, moving tasks from an existing owner,
completed assignments, duplicate membership inputs, and missing/completed/mismatched
references. Rejected-POST checks compared before/after fixture state. Two injected
write failures verified rollback after changes had begun, with safe 500 responses.

Query checks covered the default task/user limits using 105 direct pagination
fixtures per collection, explicit limit zero, combined sorting/projection/skip/
limit/count, count before pagination, `$in`, completed filters, logical/expression
filters, valid and malformed query values, and empty-list/count versus missing-id
behavior. Both single-resource routes were checked with inclusion and exclusion,
excluded `_id`, malformed/nonexistent ids, ignored malformed collection parameters,
and invalid applicable select. The direct pagination fixtures are separate from
the resources whose POST creation/persistence was exercised over HTTP.

No checks were blocked by database access. No shared database was wiped. Cleanup
targets only preallocated ids in the older model check and the HTTP run's UUID
name/email markers or returned task ids. It verifies removal before disconnecting;
the temporary HTTP server is also stopped. No DELETE API was needed for cleanup.

### Decisions, limits, and next step

Count-before-pagination, explicit zero limit, exact boolean/number JSON types,
projection-shape validation, and URL-first single-GET precedence are recorded in
REQUIREMENTS.md. Count/pagination is explicitly a project interpretation where
course guidance is incomplete. Query filters remain database queries rather than
in-memory filtering, and real fixture tests verified that supported operators
survive validation. API.md uses curl encoding rather than raw JSON punctuation
embedded in unencoded URLs.

Stop here. No blocker or required manual action remains for this step. PUT and
DELETE, their replacement/deletion cascades and concurrency checks, deployment,
and submission remain future work. The next authorized implementation step can
build those mutations on the existing transaction/validation foundation. No
autograder run, deployment, or commit was performed.

## Step 5: Atomic PUT replacements and reference synchronization (completed)

This section supersedes the preceding next-step note. Read README.md and FAQ.md
(especially two-way references, PUT status codes, and precedence), REQUIREMENTS.md,
the previous handoff, and current models/routes/creation/validation/write helpers.
Git status was checked before editing; existing work was preserved. No applicable
AGENTS.md was found in the repository or ancestor directories. No dependency,
runtime, environment/credential, course-document, or deployment change was made.

### Implemented behavior

- `PUT /api/users/:id` and `PUT /api/tasks/:id` return HTTP 200 with the updated
  persisted object in the normal message/data envelope, only after commit.
- Both reuse `prepareUserWrite` / `prepareTaskWrite`, so malformed/missing URL
  resources win with 404 before required-field checks on otherwise parsed bodies.
  Required fields, field/reference formats, duplicate email, reference existence,
  and loaded-reference values follow the established rules. Own email is allowed.
  The real unique index remains the final race-safe uniqueness check.
- `saveReplacement` resets omitted optional fields and preserves id/dateCreated;
  client internal fields are ignored. User omission of pendingTasks means `[]`.
  Task omission of assignment means unassigned, completed means false, and
  description means empty string. Names/deadlines/emails remain required.
- User replacement unassigns removed pending tasks, retains/assigns/moves the
  requested pending tasks, and removes moved ids from former owners. A rename
  updates every task still assigned, including completed tasks. Completed tasks
  remain assigned despite being absent from pendingTasks.
- Task replacement clears membership from both affected owners, then adds exactly
  one membership only when assigned and pending. Completion retains the requested
  assignment; reopening restores membership. Unassignment clears membership and
  normalizes the pair. Reassigning an already completed task is allowed and leaves
  it out of all pending lists.
- All participating reads and writes receive the transaction session and are
  awaited serially. There is no standalone-write fallback. Shared reference
  helpers now serve both POST and PUT to avoid divergent transfer/membership rules.
- Validation failure leaves state unchanged, and rollback is also verified after
  database writes have already begun. Validation-before-write is not treated as
  protection against later database failures.

### Files changed in this step

| File | Change |
| --- | --- |
| `services/references.js` | Shared pending assignment/previous-owner cleanup and task membership synchronization |
| `services/update.js` | Transactional full User/Task replacements, removals, and rename propagation |
| `services/create.js` | Reuse shared reference helpers while preserving POST behavior |
| `routes/resources.js` | Register both PUT routes with existing parsing/envelopes |
| `test/put-atlas.test.js` | Isolated real HTTP/persistence checks for PUT and concurrent transfers |
| `package.json` | Include the PUT fixture test in the explicit Atlas test command |
| `docs/REQUIREMENTS.md` | Mark PUT/reference obligations complete with actual evidence and shared-helper policy |
| `docs/API.md`, `docs/SETUP.md` | Eight implemented operations, full replacement examples, and verification instructions |
| `docs/SOURCES.md`, `docs/PROGRESS.md` | Actual source scope and this handoff |

Existing POST/GET queries, validation/error/transaction helpers, models, app/server
startup, root response, JSON/form parsing, CORS, Node 24 constraints, dependency
resolutions, private .env/TOKEN, .env.example, .gitignore, and submit.js were preserved.

### Commands/checks actually run and results

| Command/check | Actual result |
| --- | --- |
| `git status --short`, `rg --files`, ancestor AGENTS.md checks, course/docs/code reads | Existing changes inventoried and preserved; no AGENTS.md found |
| `node --check` on new services and the PUT fixture test | Passed |
| `npm test` with local-port access | 33 passed, 0 failed; 3 opt-in Atlas checks skipped as intended |
| `npm run test:atlas` with approved network/local-port access | All 3 Atlas checks passed: model/index/transaction foundation, POST/GET HTTP, and PUT HTTP |
| Existing POST/GET HTTP regression | All 109 actual HTTP requests passed after shared-helper extraction |
| New PUT HTTP workflow | 374 actual HTTP requests including fixture POSTs, PUT workflows, and both-side GET/persistence checks passed |
| Real startup within HTTP tests | Connection/ping/indexes completed before opening temporary ports |
| Fixture cleanup assertions | All test-owned ids/UUID-marked records removed; no shared database wipe |
| Final syntax sweep | All 26 JavaScript files passed |
| Inline Node runtime/lock assertions | Node major 24; dependency/devDependency/engine declarations unchanged and matching lockfile |
| Inline API-example checks | All 4 JSON curl request bodies parsed successfully; resource example ids are 24 hex characters |
| `git check-ignore -v .env` and guarded `git ls-files --error-unmatch .env` | Ignored by .gitignore line 12 and untracked; contents not displayed |
| `git diff --check` | Passed |
| `git diff -- .gitignore .env.example README.md FAQ.md submit.js` | No changes |

The PUT workflow inspected every fixture user/task through GET and compared each
with its persisted document after updates. It checked unique pending membership,
canonical unassigned names, matching assigned names, completed-task exclusion,
unchanged ids/dates, and both directions of every fixture reference. Each rejected
request compared all fixture documents before/after and rechecked both sides.

Actual workflows included task transfers through each PUT endpoint; completion,
reopening, unassignment, and reassignment; completed-task reassignment; retained,
removed, newly requested, and duplicated pending ids; renaming a user with pending
and completed tasks; JSON/form replacements; omitted-option resets; and preservation
of server-owned fields. Rejections covered missing required values, wrong types,
bad/missing references, completed pending tasks, duplicate email, conflicting
assigned names, malformed JSON, malformed URL ids, and missing URL resources.
The detailed FAQ mixed missing/completed-reference interpretation was checked.

Injected failures occurred after a user replacement, a removed-task update, and
former-owner cleanup; and after a task replacement plus membership cleanup.
Both returned safe 500s and rolled back all fixture state. Concurrent PUTs to
the same new email produced one 200 and one 400. Concurrent task/user transfers
and competing user-list transfers both succeeded with consistent final references.
These are real transaction/HTTP checks, not simulations of database atomicity.

### Decisions, blockers, and next step

Task membership is a set: clearing/re-adding the affected id ensures uniqueness
and may move its position in a user's pending list. Requested user lists retain
the established first-occurrence order after deduplication. Completed tasks are
protected from unassignment caused only by omission from pendingTasks. The prior
normalization and README/FAQ mixed-failure decisions remain documented and unchanged.
No additional external sources were consulted for this step.

No blocker or manual action remains. Temporary servers were stopped and test
connections closed. Stop here: DELETE endpoints/cascades, deployment, and submission
remain future work. No DELETE route, autograder run, deployment, or commit was made.

## Step 6: DELETE operations and common HTTP behavior (completed)

Completed October 30, 2026 (America/Chicago). This section supersedes the preceding
next-step note. Read README.md, FAQ.md, REQUIREMENTS.md, this handoff, and current
routes/services/error/response/transaction helpers before editing. Git status was
checked first and existing changes preserved. Repository/ancestor searches found
no applicable AGENTS.md. No dependency upgrade, credential edit, course-file edit,
deployment, or submission was performed.

### Implementation and status decision

- Added `DELETE /api/tasks/:id` and `DELETE /api/users/:id`. Both use the existing
  URL resource checks and `atomicWrite` wrapper. Malformed/nonexistent ids return
  404. Every dependent database operation receives the transaction session and
  is awaited; success is sent only after commit.
- Task deletion removes the task and clears its id from the assigned owner's
  pendingTasks. Pending, completed, and unassigned cases work. Membership cleanup
  was extracted from the existing shared helper so POST/PUT keep the same rules.
- User deletion removes the user and clears assignment fields on every task with
  that assignedUser, including completed tasks. Tasks are preserved with the same
  completion flags, dates, names, descriptions, deadlines, and other business data.
  Other users' unrelated records/references are not targeted.
- Retained the documented DELETE decision: HTTP 200 with human-readable message
  and `data: null`. Current README/FAQ still do not mandate one DELETE success
  status. The implemented messages are `Task deleted.` / `User deleted.`.
  Subsequent single GET and repeated DELETE return 404. Collection queries for
  deleted ids still return HTTP 200 with an empty array or count zero.
- Existing common HTTP behavior was verified and preserved: sanitized JSON 404
  for unknown paths, 400 for malformed JSON/recognized validation, and 500 for
  unexpected failures. CORS headers cover successful/error responses and advertise
  GET, POST, PUT, DELETE, OPTIONS. OPTIONS remains bodyless 204 with no JSON body
  or content type. Literal/parameter routes and app-level catch-all middleware
  work with the installed Express 5; no obsolete wildcard pattern was added.

### Files changed in this step

| File | Change |
| --- | --- |
| `services/remove.js` | Transactional task/user deletion with reference cleanup |
| `services/references.js` | Extract/reuse the membership-clearing helper |
| `routes/resources.js` | Register both DELETE handlers with normal 200 envelopes |
| `test/delete-atlas.test.js` | Isolated real HTTP deletion/cascade/rollback/common-HTTP verification |
| `test/foundation.test.js` | Explicit nested unknown-API check and complete CORS method assertion |
| `package.json` | Include DELETE verification in the explicit Atlas command |
| `docs/REQUIREMENTS.md` | All ten operations checked; DELETE/status/HTTP evidence and verification scope |
| `docs/API.md`, `docs/SETUP.md` | DELETE examples, preflight example, all-ten implementation status |
| `docs/SOURCES.md`, `docs/PROGRESS.md` | Actual source scope, date, and this handoff |

Existing POST/GET/PUT behavior, models, validation/error/transaction foundation,
root response, startup/indexes, body parsers, CORS settings, Node 24 constraints,
locked dependencies, private .env/TOKEN, .env.example, .gitignore, and submit.js
were preserved. The private environment was not modified or displayed.

### Commands/checks actually run

| Command/check | Actual result |
| --- | --- |
| `git status --short`, `rg --files`, ancestor AGENTS.md checks, course/docs/code reads | Existing work inventoried and preserved; no AGENTS.md found |
| `node --check` on changed/new services, routes, and fixture test | Passed |
| `npm test` with local-port access | 33 passed, 0 failed; 4 opt-in Atlas checks skipped as designed |
| `npm run test:atlas` with approved network/local-port access | All 4 real Atlas checks passed |
| New DELETE/common-HTTP verification | 140 actual HTTP requests passed, including fixture creation, deletions, reads, errors, and OPTIONS |
| Existing POST/GET regression | 109 actual HTTP requests passed |
| Existing PUT regression | 374 workflow HTTP requests and both-side persistence checks passed |
| Model/index/transaction fixture test | Passed real unique-index, concurrent-email, replacement, and rollback checks |
| Fixture cleanup assertions | All run-owned ids/UUID-marked records removed; unrelated data not targeted |
| Full syntax sweep | All 28 JavaScript files passed |
| Inline runtime/lock checks | Node major 24; dependency/devDependency/engine declarations still match lockfile |
| Inline API-example checks | All 4 JSON curl bodies parse; resource example ids are 24 hex characters |
| `git check-ignore -v .env` and guarded `git ls-files --error-unmatch .env` | Ignored by .gitignore line 12 and untracked; no values displayed |
| `git diff -- .gitignore .env.example README.md FAQ.md submit.js` | No changes |
| `git diff --check` | Passed |

The deletion test created two isolated users and eight pending/completed/unassigned
tasks. It deleted pending, completed, and unassigned tasks, checked exact 200
envelopes, post-deletion GET/repeated DELETE 404s, and collection `[]`/`0` behavior.
It then deleted one user while preserving their remaining pending and completed
tasks, comparing full before/after task objects with only assignment fields changed.
Both-side checks compared HTTP resources with persisted documents and verified
membership/name consistency. An unrelated-user/task snapshot (including an
unassigned survivor) remained identical through the tested deletions.

Injected failures occurred after actual task/user deletions but before membership
cleanup/task unassignment could finish. Both returned safe 500 envelopes and
rolled back every fixture document. Missing/malformed ids and missing-id paths
returned 404 without state changes. Common checks covered nested unknown API
paths, malformed JSON, required-field failure, duplicate email, invalid query-id
casting, CORS on successes/errors, and real preflights on collection, resource,
and unknown paths. All expected CORS methods were present; every OPTIONS body
was empty with HTTP 204.

Tests cleaned only their generated ids/UUID-prefixed records with controlled
database cleanup and verified zero fixture matches before disconnecting. No shared
database wipe or drop was used. Temporary HTTP servers and connections were closed.
No check was blocked by database access. No new external references were consulted.

### Implementation completeness and next step

All ten assignment operations are now implemented, and this step's targeted
deletion/common-HTTP checks plus existing regressions pass. This is implementation
completeness, not a claim that every broader final-verification scenario or the
deployed autograder has passed. The next authorized step is broader assignment
verification and any fixes it identifies. Deployment, autograder self-check, and
actual course submission remain separate obligations. No deployment, autograder
run, or commit was performed in this step.

## Step 7 — repeatable integration suite and contract fixes

Completed October 30, 2026 (America/Chicago). Read the course documents,
requirements/handoff, current models/routes/services/helpers, environment/startup,
and existing tests. Reviewed behavior against README/FAQ rather than treating the
existing tests as the specification. No applicable AGENTS.md was found. Git status
was checked before edits; prior steps' uncommitted work was preserved.

### Completed work and changed files

- Added `testing/environment.js`, `.env.test.example`, and an appended `.env.test`
  ignore entry. Database tests require an explicit `TEST_MONGODB_URI`; they never
  fall back to `.env`. A private `.env.test` was created only because it was absent,
  reusing the already authorized Atlas connection without printing it. Both private
  files remain ignored, untracked, and mode 0600. The original `.env`/TOKEN and
  `.env.example` were untouched. No test credentials are in tracked files.
- This workspace uses the existing authorized assignment database with carefully
  tracked UUID/ObjectId fixtures. Every query/cleanup is scoped to run-owned
  records; a separate authorized database can instead be selected explicitly.
  Tests create no paid resources and never clear/drop shared data.
- Added `testing/invariants.js` and `test/invariants.test.js`. All five database
  groups share the closed-fixture-graph checker. It detects duplicate/missing
  membership, missing references/owners, completed membership, stale owner names,
  and noncanonical unassigned values. Existing workflow persistence/date checks
  remain in place.
- Added `testing/fixtures.js`, `test/environment.test.js`, and
  `test/contract-atlas.test.js`. The expanded real HTTP matrix checks strict field
  types/dates, missing fields, POST/PUT dates, precedence, query edge cases, exact
  envelopes/content types, concurrent owner changes, and unchanged-state snapshots
  including attempted creation leftovers.
- Updated `test/atlas.test.js`, `test/http-atlas.test.js`, `test/put-atlas.test.js`,
  and `test/delete-atlas.test.js` to use explicit test configuration, shared
  invariants, safe cleanup guards, and restored process environment. POST/GET
  tests also check descending pages and dynamic server creation-time bounds.
  Existing checks were retained; no failure expectation was weakened.
- Updated `package.json`: `npm run test:integration` runs the five real database
  groups serially; `test:atlas` remains an alias. Explicit concurrency cases run
  inside groups. Node 24 built-in runner/fetch/assert and installed Mongoose suffice;
  no dependency was added or upgraded and the lockfile was not changed this step.
- Added `docs/TESTING.md` with commands, private configuration, database/transaction
  prerequisites, fixture safety, the full 13-area coverage map, project choices,
  and limitations. Updated REQUIREMENTS.md, SETUP.md, API.md, SOURCES.md, and this
  handoff. Course documents, submit.js, deployment configuration, and unrelated
  prior changes were preserved.

### Defects found through actual behavior

1. An invalid `$regex` option reached MongoDB as code 51108 and returned 500.
   `services/queries.js` now validates supported MongoDB flags (`i`, `m`, `s`, `x`,
   `u`) and recognizes that query failure as a sanitized 400. Valid flags and
   PCRE string patterns remain accepted. `test/queries.test.js` covers both paths;
   the real HTTP matrix checks invalid options on both collections.
2. Concurrent completed-task creation and owner rename produced a stale
   `assignedUserName`. Pulling a new/completed task from pendingTasks could be a
   no-op, leaving no owner write conflict. `services/references.js` now increments
   the affected owner's internal version during membership cleanup. This forces
   a real transaction conflict/retry with owner rename/deletion, while preserving
   business fields/dateCreated and session propagation. The matrix checks both
   rename and deletion races, in addition to existing competing transfers.

The first two targeted matrix runs exposed those failures and executed scoped
cleanup. After the fixes, the targeted matrix and complete integration run passed.
Raw connection strings, credentials, database messages, and stacks were not logged.

### Commands actually run and verified results

| Command/check | Actual result |
| --- | --- |
| `git status --short`, course/docs/code/test reads, ancestor instruction search | Existing dirty work preserved; no applicable AGENTS.md |
| `npm test` | 36 passed, 0 failed; 5 opt-in database groups skipped as designed |
| `MP3_ATLAS_TESTS=1 node --test test/contract-atlas.test.js` | Final targeted run passed; 167 real HTTP requests and 147 rejected-request snapshots |
| `npm run test:integration` | 5 passed, 0 failed, 0 skipped; captured complete run took 144.5 seconds |
| Model/index/transaction group | Real Atlas ping, initialized unique email index, actual duplicate-key enforcement, concurrent uniqueness, replacement/rollback checks passed |
| POST/GET group | 111 real HTTP requests passed, including 105 isolated users and 105 tasks, default/explicit limits, exact pages/counts, projections, and creation synchronization |
| PUT group | 374 real HTTP requests passed with both-side/persisted-state checks, replacement defaults/dates, rejection snapshots, concurrent transfers/emails, and injected rollback failures |
| DELETE/common-HTTP group | 140 real HTTP requests passed, including pending/completed/unassigned deletion, unrelated-record preservation, repeat/missing reads, safe errors, and bodyless OPTIONS |
| Expanded contract group | 167 real HTTP requests passed; 147 rejected-request snapshots, shared invariants, observed-write rollback, completed-task/owner races |
| Fixture cleanup assertions | Every group removed its own tracked records and verified zero remaining matches before disconnecting; no shared wipe/drop |
| Inline `node --check` sweep | All 34 JavaScript files passed on Node v24.16.0 |
| Inline package/lock declaration comparison | dependencies, devDependencies, and Node 24 engine declarations match |
| `git check-ignore -v .env .env.test`; `git ls-files -- .env .env.test` | Both ignored and untracked; no contents displayed |
| Scoped unsafe-cleanup search in `test/` and `testing/` | No database/collection drop or empty-filter delete found |
| `git diff --name-only -- README.md FAQ.md .env.example submit.js` | No changes |
| `git diff --check` | Passed |

The complete run exercised **792 actual HTTP requests** across four HTTP groups,
plus the real model/index/transaction group. Each HTTP server started only after
Atlas connection, ping, and index initialization. The focused rollback test used
the shared transaction helper: it wrote a fixture user, read the changed value
inside the same session, deliberately threw a test-only error, then verified the
entire fixture snapshot and subsequent HTTP read were unchanged. There is no
public fault endpoint or production test switch. Existing HTTP fault cases fail a
later operation while earlier writes really execute against Atlas.

### Decisions, limitations, and next step

Existing project interpretations remain labeled separately from course rules:
count before pagination, explicit zero limit as unlimited, DELETE 200/null with
bodyless OPTIONS 204, strict JSON/form normalization, exact-case email, and the
README/FAQ mixed-reference precedence ambiguity. The suite did not redefine them.

No database-access blocker remains for these checks. The result verifies the
covered local HTTP/Atlas behavior, not every possible MongoDB expression or every
concurrency schedule. A forcefully interrupted test or unavailable database during
cleanup can still leave identifiable fixtures; it must not be called a clean run.
Render deployment, deployed API checks, the undisclosed course autograder, and
actual submission remain unverified. The project is not claimed deployment-ready.
No deployment, submission, commit, or unrelated feature was performed. The next
step is the separately authorized deployment/deployed-verification work.

## Step 8 — Render deployment

The initial preparation/login handoff below is preserved as history. The resumed
deployment results follow it; the earlier account-access blocker is resolved.

October 30, 2026. Read current README/FAQ, requirements/progress/setup/testing
documents, runtime/environment files, implementation, Git state/remotes/history,
and the actual latest test log. No applicable AGENTS.md was found. Preserved the
previous steps' uncommitted assignment work; no unrelated changes were present
in the reviewed candidate files. This step explicitly authorizes commit/push and
a Free Render deployment, but not the course autograder or submission form.

### Reviewed destination and local changes

- Origin is `https://github.com/Asuka008/mp3.git`, branch `main`. Local Git identity
  is Asuka008. The actual public GitHub repository contains this MP3 assignment;
  its remote main and local HEAD both initially matched `17f06cd`. A push dry run
  authenticated successfully. The course template retained in package metadata
  is not the push destination. No force push or remote replacement is needed.
- Reviewed the tracked diff and candidate source/test/document files. An automated
  scan compared candidate contents against the actual local URI/password values
  without printing them and found no matches or forbidden private env/module paths.
  Original ignore entries remain intact; `.env`, `.env.test`, and node_modules
  are ignored and untracked. No secret-containing logs are repository candidates.
- The clean install reported two request-parser vulnerabilities. Consulted their
  maintainer advisories, then ran `npm update body-parser qs --ignore-scripts`.
  Only body-parser 2.3.0 → 2.4.0 and qs 6.16.0 → 6.17.1 changed in the lockfile;
  there were no major upgrades or new direct dependencies. Express 5.3.0 and
  Mongoose 9.11.1 remain unchanged. Fresh install/audit reports zero vulnerabilities.
- Added `.node-version` with the exact tested Node 24.16.0. Render supports this
  setting; existing .nvmrc 24 and package/lock engines 24.x remain. Provider settings
  must use `npm ci`, `npm start`, repository root, Free instance, private
  MONGODB_URI, and Render-supplied PORT. No TOKEN or test secret is required there.
- Added `scripts/smoke-deployment.js` for an actual public HTTPS workflow, scoped
  to disposable UUID fixtures and verified cleanup. It covers both resource
  types, replacements, pending/completed references, queries, rejection, deletion,
  missing resources, and CORS. Only its syntax has been verified so far; it has
  not been passed off as a public deployment check.
- Added DEPLOYMENT.md with precise settings, provider fallback steps, safe private
  configuration, and status. Updated REQUIREMENTS.md, SETUP.md, SOURCES.md, and
  this progress record. submit.js remains untouched because no live base URL is
  known. AUTOGRADER_URL/grading logic are preserved and were not executed.

### Actual checks

| Command/check | Result |
| --- | --- |
| `git status --short`, `git remote -v`, `git log -3 --oneline`, `git ls-remote origin refs/heads/main` | Reviewed existing assignment state and verified matching personal remote/history |
| `git push --dry-run origin main` | Authenticated; everything up to date; no remote write |
| `git commit -m "Implement and verify MP3 API with deployment preparation"`; `git push origin main` | Committed/pushed 47 reviewed files as 77abe2fa832022996e32c43f5218177c47310809 to Asuka008/mp3 main; no force push |
| `git rev-parse HEAD`; `git ls-remote origin refs/heads/main` after push | Identical 77abe2fa832022996e32c43f5218177c47310809; clean working tree before this documentation follow-up |
| `npm ci` before fixes | Install succeeded; two reported vulnerabilities prompted investigation |
| `npm audit --json` | Identified body-parser high and qs moderate advisories; only package/advisory metadata printed |
| `npm update body-parser qs --ignore-scripts` | Two compatible transitive updates, zero reported vulnerabilities |
| Final `npm ci` | Locked install succeeded; zero reported vulnerabilities |
| Final `npm test` | 36 passed, 0 failed; five database groups skipped by default |
| Final `npm run test:integration` | Five passed, 0 failed, 0 skipped, 133.6 seconds; 792 real HTTP requests, fixture cleanup passed |
| Inline `node --check` sweep | All 35 JavaScript files passed on Node v24.16.0 |
| Runtime/package/lock comparison | Exact Render pin matches tested runtime; root dependency/engine declarations match lockfile |
| Candidate secret/path scan | Passed; actual values not printed |
| `git check-ignore -v .env .env.test node_modules`; `git ls-files -- .env .env.test node_modules` | Ignored and untracked |
| `git diff --check` | Passed |

The pre-update baseline regression also passed (five Atlas groups/792 requests),
then the full suite was rerun because the lockfile changed. Current Atlas checks
include connection/ping/indexes and transactional read/write permissions. The
previously configured course-required `0.0.0.0/0` rule and assignment-scoped user
were not changed. Render-origin connectivity remains unverified until deployment.

### Initial account-access handoff (resolved by the continuation below)

Opened the actual Render dashboard in the in-app browser; it shows Sign In to
Render. Requested only that the user sign in (or create a free account) privately
and reply when ready. No account credentials or URI should be sent in chat.
No service has been created, no provider build/runtime log exists to inspect,
and no public URL has been verified. No paid option was selected.
The tested backend/preparation commit has been published to the intended GitHub
repository. This handoff is a documentation-only follow-up on the same branch.

Once signed in: create the Free Node service from the intended repository/branch,
configure MONGODB_URI privately, confirm Node/build/start/root settings, inspect
deployment logs, wait for Live, run the public smoke script, update only API_URL
in submit.js to the verified base URL, commit/push, and verify the final deployed
revision. DEPLOYMENT.md gives exact UI fallback steps. Do not run the official
autograder or submit the course form during this step.

### Resumed deployment after account access

The user signed into Render in Edge, approved installing Render's GitHub app for
**only Asuka008/mp3**, and privately completed GitHub re-authentication. No other
owned repository received installation access. The original in-app login tab was
not the authenticated session; the existing Edge Render tab was used.

Created Node web service **asuka008-mp3** (`srv-dbihj2l9fdbs73dmgjqg`) in Oregon
(US West), from Asuka008/mp3 **main** at revision `28d86f6`. Changed the creation
form's initial paid default to **Free ($0/month, 0.1 CPU, 512 MB)** before deploying.
Root directory is empty/repository root, build `npm ci`, start `npm start`, health
path `/api`, auto-deploy enabled. Set non-secret NODE_VERSION to **24.16.0** and
transferred only MONGODB_URI from the ignored local file into Render's private
environment field. The URI was hidden, and all state inspection around entry
redacted its value; no credential was printed or captured in screenshots. TOKEN,
test configuration, and custom PORT were not sent. Local env entries were preserved.

| Actual provider/public check | Result |
| --- | --- |
| Atlas connection-status role inspection and ping | Assignment database mp3 and its readWrite role confirmed; ping succeeded; no credentials displayed |
| Initial deploy `dep-dbihj2t9fdbs73dmgkdg` | Source 28d86f6 from main, completed in 47.7 seconds, **Deploy succeeded / Live** |
| Render build logs | Node 24.16.0 via NODE_VERSION; npm ci; zero reported vulnerabilities; successful build |
| Render runtime logs | npm start / node server.js; listening on supplied port 10000 only after Atlas connection, ping, and indexes |
| Public HTTPS `/api` fetch | HTTP 200, application/json, static message/data envelope, no environment values |
| `node scripts/smoke-deployment.js https://asuka008-mp3.onrender.com` | Exit 0; **38 HTTPS requests passed**, including persistence, both reference directions, dates, replacement, queries, rejection, deletion, OPTIONS, and verified cleanup |
| Public fixture scope | Two uniquely marked users and pending/completed tasks; only run-owned ids/UUID matches cleaned; final matching counts zero |

The actual public URL is **https://asuka008-mp3.onrender.com**. This proves
Render-origin Atlas read/write/transaction access in addition to the earlier local
regressions. The course-required IP access configuration and assignment database
user were left unchanged. No provider/startup failure needed repair.

Only the API_URL declaration in submit.js changes to the verified base URL, without
/api or other paths. The grader URL and all grading logic are preserved; the file
is syntax-checked/read as text, never executed in this step. DEPLOYMENT.md now
records the actual URL/service/settings and public evidence; REQUIREMENTS.md and
SOURCES.md reflect completed deployment and the actual account UI consulted.
Committed only submit.js as **9e4bd3b8e97df4db31a3fdcf7a66c0d28aeeb2fe** with
`git commit -m "Set verified Render API base URL"`, then ran `git push origin main`.
Remote main matched that commit. Render auto-deployed it as
`dep-dbihl8fb9u1s738iq3i0`, confirmed the intended source/Node/build/startup and
Atlas readiness, then reported **Live after 53.9 seconds**. Reran
`node scripts/smoke-deployment.js https://asuka008-mp3.onrender.com`: exit 0 and
**38 requests passed again with zero remaining fixtures**. Across initial and
configuration revisions, 76 public workflow requests passed, plus standalone
root checks. No business-code changes were needed, so the fresh 36 local checks
and five Atlas groups/792 requests remain the regression evidence; public smoke
is deliberately smaller than that matrix.

Final read-only checks confirmed that only API_URL differs in submit.js from the
starter, grading logic is preserved, no real local URI/password appears in changed
files, and git diff --check passes. This documentation-only record is published
on the same main branch; its auto-deployed revision is checked through Render and
the public root/database reads before the final response. The authoritative latest
revision is visible in Render's Deploys view and GitHub main, avoiding a self-hash
inside the commit's own documentation.

No paid resource, official autograder call, course-form submission, force push,
shared database wipe, or unrelated change was performed. Free service cold starts
and continued availability during grading remain operational obligations. The
remaining course self-check/submission steps require separate authorization.

## Step 9 — official self-check and DELETE response correction

October 30, 2026, America/Chicago. The user explicitly authorized the official
self-check, its temporary records, necessary fixes/commits/pushes/redeployment,
and repeat grading after verified deployment. The final course form remains
outside scope. Read applicable instruction locations (no AGENTS.md found),
README Grading/Self-check, FAQ, current handoff/deployment, and submit.js.
Git was clean at source **8dce84d309014733a1c1c17ca49947fab6d66d66**, origin
Asuka008/mp3 main. Node v24.16.0 and npm 11.13.0 were verified. Comparing submit.js
with the initial source proved that only API_URL differs; the unchanged grader
URL and grading logic are preserved.

Render's actual account UI showed that revision Live on the established service.
Public root/users/tasks read preflight returned 200 with expected envelopes/data;
an authenticated Atlas ping passed. Saved a private id-only inventory before
grading: zero users and tasks. No warm-up timeout or functional preflight failure
occurred, so grading targeted a ready, database-connected service.

Ran **npm run submit** from 5:38:10 PM to 5:38:42 PM CDT (32.446 seconds). Actual
score: **90/100, 18/20 points**. Eighteen items passed; only successful DELETE
/tasks/:id and /users/:id failed because the grader expects status 204 and an
empty body. Both subsequent deleted-resource GET checks passed. There were no
skipped prerequisites, timeouts, or rate-limit responses. Exact timestamps and
unmodified output are in GRADING.md. Post-grader inventory was again zero users
and tasks; no manual cleanup of grader data was necessary.

A focused public reproduction with two uniquely identified fixtures confirmed
both routes returned 200 with 39 response bytes instead of 204/empty; both records
were actually deleted and subsequent GET returned 404. It exited 1 as expected,
and cleaned only those returned ids. Updated the permanent real HTTP/Atlas DELETE
regression to assert status 204, empty text, and absent content type. Ran
`MP3_ATLAS_TESTS=1 node --test test/delete-atlas.test.js` against the old handler:
it failed in task deletion, as expected, and scoped fixture cleanup ran.

Corrected routes/resources.js to await the existing atomic removal and then
terminate with `res.status(204).end()`. Transactions, reference synchronization,
404/500 errors, and other endpoints are unchanged. Updated delete-atlas and
contract fixture clients plus the public smoke helper to verify this bodyless
success without parsing JSON, retaining JSON-envelope assertions for errors and
other operations. The contract deletion-race expectation is now 204. This is a
generic correction for both resources, not a grader-example special case.

README/FAQ do not fully prescribe a DELETE success status. The actual official
feedback now clarifies 204; the earlier labeled 200/envelope project decision is
superseded. API.md, REQUIREMENTS.md, TESTING.md, DEPLOYMENT.md, SOURCES.md, and
GRADING.md reflect that distinction. `npm test` passed 36 checks (five database
groups skipped by default). `npm run test:integration` passed all five groups,
0 failed/0 skipped, in 136.450 seconds: 792 actual HTTP requests with bodyless
DELETE, error envelopes, both references, rollback, and scoped cleanup verified.
Syntax and git diff checks passed. The reviewed fix will now be pushed/redeployed;
the next grader run must wait for its verified live revision. No unchanged-code
repeat grading was sent.
