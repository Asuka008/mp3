# MP3 implementation checklist

The assignment authority is [README.md](../README.md) and [FAQ.md](../FAQ.md).
Unchecked boxes are future work, not claims of implemented behavior. Model and
helper checks below describe the foundation. All ten assignment operations are
implemented. The repeatable local HTTP/Atlas integration matrix and its actual
results are recorded in [TESTING.md](TESTING.md) and [PROGRESS.md](PROGRESS.md).
Deployment, deployed verification, and submission remain separate work.

## Explicit course requirements

### All ten operations

All paths are relative to `/api`. Responses use the envelope described below.

- [x] `GET /users`: list users; `200`, including an empty list or count of `0`.
- [x] `POST /users`: validate and create a user, synchronize supplied pending tasks;
  `201` with the created user.
- [x] `GET /users/:id`: retrieve one user, support `select`; `200` or `404`.
- [x] `PUT /users/:id`: replace the user, synchronize task assignments; `200`
  with the replacement, or the applicable error.
- [x] `DELETE /users/:id`: delete the user and unassign all their tasks, including
  completed tasks; an absent or malformed URL id is `404`.
- [x] `GET /tasks`: list tasks; `200`, including an empty list or count of `0`.
- [x] `POST /tasks`: validate and create a task, synchronize its assigned user;
  `201` with the created task.
- [x] `GET /tasks/:id`: retrieve one task, support `select`; `200` or `404`.
- [x] `PUT /tasks/:id`: replace the task, synchronize previous/new users; `200`
  with the replacement, or the applicable error.
- [x] `DELETE /tasks/:id`: delete the task and remove its id from the assigned
  user's pending tasks; an absent or malformed URL id is `404`.

### Schemas and validation

| Model | Field | Course rule |
| --- | --- | --- |
| User | `name` | String, required on POST and PUT |
| User | `email` | String, required on POST and PUT; unique across users |
| User | `pendingTasks` | Array of strings containing ids of existing pending tasks |
| User | `dateCreated` | Date, set to the current date by the server on creation |
| Task | `name` | String, required on POST and PUT |
| Task | `description` | String |
| Task | `deadline` | Date, required on POST and PUT |
| Task | `completed` | Boolean |
| Task | `assignedUser` | String containing an existing user id, or default `""` |
| Task | `assignedUserName` | String, default `"unassigned"`; must match the assigned user |
| Task | `dateCreated` | Date, set to the current date by the server on creation |

- [x] Implement both schemas, with public references kept as strings.
- [x] Provide validation rejecting missing/invalid required fields and wrong types with `400`;
  do not rely on permissive type casting to accept wrong input types.
- [x] Enforce email uniqueness with a database index and map duplicate failures to `400`, including concurrent duplicate creation;
  retaining a user's own email on PUT is allowed.
- [x] Strip client `dateCreated` from payloads; preserve it with the replacement helper for both models.
- [x] Apply reasonable values to omitted optional fields. Explicit course defaults
  are the unassigned pair and an empty `pendingTasks` list on user PUT. Other
  defaults chosen for this project are listed separately below.
- [x] Provide checks rejecting a non-list `pendingTasks`, malformed ids in body references, and
  completed tasks requested in `pendingTasks` with `400`.

### Queries

- [x] Parse JSON-encoded query values on collection GETs; invalid JSON in applicable
  parameters is `400`. Support every combination of the six parameters.
- [x] `where`: apply a Mongoose query filter, including operators such as `$in`.
- [x] `sort`: apply field directions (`1` ascending, `-1` descending).
- [x] `select`: apply field inclusion/exclusion (`1`/`0`).
- [x] `skip`: skip the specified number of results.
- [x] `limit`: cap results; default to `100` for tasks and unlimited for users.
- [x] `count=true`: return a numeric count in `data` instead of documents.
- [x] Use Mongoose query methods for filtering, sorting, projection, pagination,
  and counting; do not load everything and perform these operations in JavaScript.
- [x] On `GET /users/:id` and `GET /tasks/:id`, only `select` applies. Ignore other
  query parameters, including invalid JSON in those ignored parameters.
- [x] A collection with no matches returns `200` with `[]` or `0`; a single-resource
  lookup with a missing/malformed URL id returns `404`.

### Responses, status codes, and error precedence

- [x] Establish JSON responses shaped as `{ "message": <human-readable string>,
  "data": <payload> }`, including errors. Apply the helper to future routes.
- [x] Hide raw database/framework messages and credentials in unexpected errors;
  root `/api` returns static information only.
- [x] Return no JSON body with `204`; the foundation uses it for OPTIONS.
- [x] Implement GET `200` and POST `201` success envelopes.
- [x] Implement PUT `200` success envelopes.
- [x] Implement errors for POST/GET/PUT/DELETE operations: malformed/missing URL resource `404`;
  missing/invalid fields or wrong types `400`; duplicate email `400`;
  malformed body reference id `400`; well-formed but missing reference `404`;
  completed pending task `400`; mismatched assigned user/name `400`;
  unexpected server/database failure `500` with a safe message.
- [x] Provide write preparation that checks URL id/existence first (`404`), then field
  formats and values (`400`), then existence of referenced users/tasks (`404`).
  POST has no URL id check. Validate everything before any writes.
- [x] Follow the FAQ's more detailed user PUT order in the helpers where checks need loaded
  documents: URL id, field shapes/reference-id formats, duplicate email,
  referenced task existence, then whether the loaded tasks are completed.

The README gives broad precedence (URL id, field values, reference existence).
The FAQ places completed-task detection after reference existence, although the
README groups invalid values before missing references. This only affects mixed
failures involving different referenced tasks. Project interpretation: use the
FAQ's explicit user PUT sequence, and validate properties that require a loaded
reference after checking that reference exists. Revisit with course staff if a
mixed-failure case is clarified; do not present this tie-break as an explicit
resolution supplied by the course. Malformed request bodies necessarily fail in
the body parser before route-level checks; the course does not specify their
precedence relative to a missing URL resource.

### Replacement PUT and two-way references

- [x] PUT replaces client-editable fields; it is not a partial patch or an upsert.
  Missing required fields are errors; missing optional fields reset to defaults.
  Keep the resource id and `dateCreated`.
- [x] A task is pending exactly when `completed` is false. Every assigned pending
  task appears in exactly its assigned user's `pendingTasks`; every entry in that
  list points to a pending task assigned to that user with their current name.
- [x] Created/replaced unassigned tasks have the pair `""` / `"unassigned"`.
- [x] User PUT supplies `name`, `email`, and `pendingTasks` (omitted list means `[]`).
  Tasks removed from the old list become unassigned. Newly listed tasks become
  assigned to this user. Tasks listed that belong to another user move here and
  are removed from the previous user's list; this is valid, not a conflict.
- [x] When a user's name changes, update `assignedUserName` on every task that
  remains assigned to them, including completed tasks. Completed tasks remain
  assigned despite never being in `pendingTasks`.
- [x] Task PUT removes the task from its previous user's list when reassigned or
  unassigned. Add it to the new user's list only if pending. Completion removes it
  from the list while preserving its assignment; reopening adds it back.
- [x] Task PUT can reassign a completed task; it stays out of all pending lists.
- [x] If `assignedUserName` is supplied for an assigned task, reject a mismatch
  with `400`. If omitted, filling it from the referenced user is permitted.
  Setting `assignedUser` to `""` produces `assignedUserName: "unassigned"`.
- [x] POST user/task uses the reference rules specified for the corresponding PUT.
- [x] DELETE task cleans up its user's pending list. DELETE user unassigns all
  its tasks, including completed ones.
- [x] Preserve these invariants for implemented operations; a failed request
  must leave the database unchanged, including every related document.
- [x] Verify failure atomicity with snapshots before/after failures, including
  duplicate emails, invalid/missing references, and injected failures during a
  multi-document update. Concurrency must not leave half-applied assignments.

### Deployment, submission, and course rules

- [x] Use Node 24.x, JavaScript/CommonJS, Express 5, Mongoose 9, and the lockfile.
- [x] Prepare supported Render runtime settings: `.node-version` pins the tested
  `24.16.0`, alongside `.nvmrc` 24 and engines 24.x. Keep any provider NODE_VERSION
  override at the same exact version; verify the actual runtime in deployment logs.
- [x] Keep JSON and URL-encoded body parsing and CORS; respect `PORT` with local
  fallback `3000`; expose an importable Express app for integration checks.
- [x] Preserve `.gitignore`, keep `.env` ignored/untracked, copy the template only
  if absent, and leave the template's TOKEN convention intact.
- [x] Configure real database credentials privately and connect to MongoDB Atlas;
  enable the assignment's requested "Allow access from anywhere" cluster setting.
- [ ] Deploy the API publicly on Render using Node 24.x (`engines.node: "24.x"`;
  use `NODE_VERSION=24.16.0` if setting a Render runtime override). Use `npm ci` for
  installation and `npm start` for startup, with private environment variables.
  Verify the selected runtime in deployment logs. These commands/settings are
  project deployment choices; Atlas and Render are course requirements.
  Local preparation, free-tier settings, and the account-access prerequisite are
  recorded in [DEPLOYMENT.md](DEPLOYMENT.md); a live URL is not yet verified.
- [ ] Verify deployed business endpoints and database writes, query combinations,
  missing resources, replacement behavior, validation, and reference consistency.
- [ ] Set only `API_URL` in `submit.js` to the deployed base URL (without `/api`);
  preserve `AUTOGRADER_URL`. Run `npm run submit` with Node 24 after deployment.
- [ ] Wake a sleeping Render service before retrying timeouts. Respect the stated
  approximate autograder limit of 5 runs per 2 minutes; fix multiple issues between runs.
- [ ] Inspect any test data left by failed cleanup; no prescribed initial data
  volume or database wipe is required. Keep the deployment/database available
  during grading.
- [ ] Use a public GitHub repository under the student's account. Submit through
  the README's [submission form](https://forms.gle/4V1v2VWU78XwM3H57) by
  **Tuesday, November 3, 2026, 11:59 PM Central Time**. Running `submit.js` is only
  a self-check, not submission. No video is required.
- [ ] Complete the individual assignment without prohibited collaboration or
  copying others' code. Declare every source actually consulted in the submission;
  maintain [SOURCES.md](SOURCES.md). Ask course staff on Piazza if acceptability
  is unclear. Since an LLM is used here, submit chatlogs with the source and answer
  the LLM survey questions in the grading form.

### Grading weights from README

| Area | Weight |
| --- | ---: |
| Creating and validating users and tasks | 20% |
| `select` on single resources | 7.5% |
| Updating missing resources | 10% |
| Two-way references and consistency | 27.5% |
| Query parameters (`where`, `sort`, `limit`, `count` on tasks) | 15% |
| Deleting tasks and users | 20% |
| Total | 100% |

Within each item, correct behavior/status codes are roughly 75%/25%. Separately,
deleting `.gitignore` loses 1 percentage point, and committing `.env` loses 1
percentage point. Exact autograder requests are not published.

## Project choices, not additional course rules

- [x] Separate `app.js` (configuration/export only) from `server.js` (environment
  loading and listening). The root response is a foundation check, not a database
  readiness check. The Atlas/startup step now awaits connection and a database
  ping before listening; real external verification is recorded in PROGRESS.md.
- [x] Use `data: null` for foundation errors and the static root response. Use a
  shared response helper and explicitly safe `ApiError` messages; Express 5 can
  forward rejected async route promises to the error handler. Reusable domain
  validation and context-sensitive id checks are now in services/validation.js;
  future routes must use them.
- [x] Handle oversized request bodies with `413` and unsupported encodings with
  `415`, both with safe envelopes. These are parser choices beyond the listed
  course minimum codes.
- [x] Interpret `count=true` as the total number matching `where` **before** skip,
  limit, or the tasks default limit. Ignore sort/select for the count result;
  validate applicable supplied query values first. The course does not fully
  specify how counting interacts with pagination.
- [x] Use `200` with `data: null` and the message `"User deleted."` or
  `"Task deleted."` for successful DELETE. The course does not prescribe one DELETE success status.
  Use bodyless `204` where appropriate (currently OPTIONS).
- [x] Provide payload defaults for User `pendingTasks` to `[]` on POST as well as PUT. Set omitted
  Task `description` to `""` and `completed` to `false`; use the explicit course
  unassigned defaults. Derive an omitted assigned name from the assigned user.
- [x] Accept nonnegative integers for `skip` and `limit`; interpret explicit
  `limit=0` as unlimited, consistent with Mongoose. Reject other types/ranges
  with `400`; validate `count` as a boolean and query filter/projection/sort shapes.
  These input policies are project choices where course wording is incomplete.
- [x] Keep pending task ids unique as a set of references in prepared payloads. Do not invent extra
  email-format, deadline-in-the-future, or authentication requirements.
- [x] Establish an Atlas transaction wrapper for writes spanning users/tasks, with
  validation and updates inside the transaction. Real index enforcement,
  concurrent duplicate emails, and rollback of multiple writes were verified.
  Transactions are a project mechanism, not a mandated course API. Complete
  POST/PUT/DELETE synchronization, rollback after partial progress, and concurrent
  task/user transfers are verified through HTTP checks. The expanded matrix adds
  concurrent completed-task creation versus owner rename/deletion and verifies
  rollback after observing an initial transaction write.

## Implemented data-contract decisions and helper usage

These are project policies where the assignment leaves representation details open.
They do not change the ten endpoint obligations above.

- `services/validation.js` builds a new payload from explicitly writable fields.
  User fields are `name`, `email`, `pendingTasks`; Task fields are `name`,
  `description`, `deadline`, `completed`, `assignedUser`, `assignedUserName`.
  `_id`, `__v`, `dateCreated`, update operators, and unknown fields are ignored.
  Do not construct a model or an update directly from `req.body`.
- Bodies must be objects. Required strings must be primitive strings with at least
  one non-whitespace character; strings are preserved, without trimming or case
  folding. Email uniqueness uses exact stored strings. No email-format/domain or
  future-deadline restriction is added.
- JSON booleans must be actual booleans and JSON arrays actual arrays. For
  `application/x-www-form-urlencoded`, pass `formEncoded: true`: `completed` may
  also be exactly `"true"` or `"false"`, and `pendingTasks` may be a JSON-encoded
  array such as `[]` or `["<task-id>"]`. The existing parser's bracket/repeated-key
  arrays also work. A single id string, an empty string, `"1"`, and `"TRUE"` are
  not silently coerced. Other fields remain strings; arbitrary objects/arrays/
  numeric values are rejected where strings are required.
- `deadline` accepts nonempty date strings that parse to a finite date (ISO is
  recommended) and internal Date instances. It rejects numbers, booleans, arrays,
  objects, invalid dates, and impossible ISO calendar dates that JavaScript would
  otherwise roll into another month. Past deadlines are valid.
- Reference ids must be 24 hex-character strings. Prepared references are
  lowercased and duplicate pending ids removed, preserving first-occurrence order.
  URL ids that are malformed or absent get `404`; malformed body ids get `400`;
  well-formed missing body references get `404`.
- Omitted optional fields get full replacement defaults. An unassigned task always
  becomes `""` / `"unassigned"`; any supplied string name is normalized in that
  case, after type checking. This follows the explicit unassignment instruction;
  the course does not separately spell out precedence for a stale name supplied
  with an empty assignment. For assigned tasks, an omitted name is filled from
  the loaded user, while an explicit mismatch (including `""`) gets `400`.
- `prepareUserWrite` / `prepareTaskWrite` accept `{ id, session, formEncoded }`.
  Omit `id` for creation. For replacement, they load the URL resource before
  checking the body. They then check formats, duplicate email (User), reference
  existence, and reference-dependent values. A missing referenced user wins over
  a conflicting name because the comparison needs that user. The existing
  README/FAQ mixed-completion/missing-task ambiguity remains documented above.
  These helpers perform no writes and return references separately from payloads;
  the public schema never contains populated objects.
- `dateCreated` is a server Date default and immutable on saved documents. Payloads
  exclude client dates. `saveReplacement` re-whitelists fields and uses document
  `overwrite()`/`save({ session })`, preserving `_id` and the immutable creation
  date while leaving version management to the server. Avoid raw
  `replaceOne`/`findOneAndReplace`, which can
  replace creation timestamps. The PUT services now synchronize references in
  the same transaction as replacement persistence.
- `models.initializeModels()` awaits collection/index initialization before
  startup listens. The declared unique email index is the final authority; the
  preliminary lookup provides ordering/feedback only. Duplicate-key errors for
  email, schema validation, casting, and strict-field errors map to safe `400`
  envelopes. Unexpected/internal-key errors remain safe `500`s. No index or
  conflicting data is silently dropped.
- `atomicWrite(work)` uses Atlas transactions with snapshot reads, primary read
  preference, and majority writes. Inside the callback, prepare/validate first,
  then pass the same `session` to **every** read, save, update, and delete needed
  for the mutation and its reference cleanup. Execute those operations serially.
  Create with a prepared payload and `save({ session })`, or use
  `saveReplacement` for an existing document. Return a result from the callback;
  only send the HTTP success **after** awaiting `atomicWrite`. The callback may
  retry, so do not send responses or perform external side effects inside it.
  Unsupported transactions reject; there is no partial-write fallback.
- `npm test` runs local checks and skips the opt-in Atlas fixture tests.
  `npm run test:integration` (`test:atlas` alias) requires `TEST_MONGODB_URI`
  privately in `.env.test` or the test process; it never falls back to `.env`.
  It awaits indexes, checks the real unique index/transactions and all ten HTTP
  operations, and deletes only its own fixture ids/UUID-marked records.

## Implemented POST/GET behavior and query decisions

- POST handlers call the shared transaction wrapper and respond `201` only after
  commit. A User's requested task list is validated/deduplicated before any write;
  the new user is created, ids are pulled from previous owners, and tasks receive
  the new owner id/name inside the same transaction. Task creation adds membership
  with `$addToSet` only when pending; completed tasks keep their assignment without
  pending membership. Every dependent operation receives the same session.
- Collection query values must appear once as JSON. `where`, `sort`, and `select`
  must be objects. Sort directions are numeric `1`/`-1`; select values numeric
  `1`/`0`, with no mixed inclusion/exclusion except `_id`, and no overlapping
  projection paths. `skip`/`limit` are nonnegative safe integers and `count` a
  boolean. Duplicated parameters, quoted numbers, fractions, nulls, and wrong
  shapes are rejected with safe `400` envelopes. Unknown parameter names are ignored.
- Filter validation checks common operand shapes without rewriting or stripping
  query operators. `$in`, `$or`/`$and`, regex filters, and `$expr` remain usable.
  Mongoose/MongoDB perform the actual query work. Recognized query syntax/cast
  failures become safe `400`s; unexpected connectivity/access failures remain `500`.
- An omitted task limit means 100 and an omitted user limit unlimited. Explicit
  `limit=0` means unlimited using MongoDB semantics. `count=true` returns total
  matching `where` before pagination; valid sort/select/pagination values do not
  affect that number, but are still validated. `count=false` returns documents.
  The course does not fully settle count/pagination interaction; this remains a
  project interpretation, not an official grading rule.
- A single GET checks URL existence first, then reads only `select`. Consequently,
  a missing URL resource wins over invalid `select` as a project precedence choice.
  Other query parameters are not parsed at all, including malformed JSON. With
  projection, existence is checked first and the projection is then applied by a
  second Mongoose query; projection never happens in application memory.
- See [API.md](API.md) for usable curl examples that encode query JSON correctly.

## Implemented PUT synchronization and evidence

- Both PUT services call the same preparation helpers as POST, with the URL id,
  inside `atomicWrite`. URL format/existence is checked before the parsed body's
  required fields; formats precede referenced-document existence, followed by
  reference-dependent checks. The existing README/FAQ mixed-failure interpretation
  remains unchanged. Malformed raw JSON still fails at the parser before routing.
- `services/references.js` is shared by creation and replacement: assigning a
  user's pending list excludes that user from previous-owner cleanup, removes ids
  from other owners, and updates the tasks' owner/name. Task membership clears
  the id from both affected owners and re-adds it once only when assigned/pending.
  Membership is treated as a set; task updates may move the id's list position.
- User replacement compares the old pending list with the validated new list.
  Removed pending tasks assigned to this user are unassigned. Requested tasks are
  assigned/retained/moved using the shared helper. On rename, all tasks still
  assigned to the user get the new name, including completed tasks. Completed
  tasks are never unassigned merely for being absent from the pending list.
- Task replacement saves all defaulted fields and synchronizes old/current owners
  inside the same session. Omitted assignment means unassigned; omitted completed
  means false. Completion keeps the requested assignment, reopening restores
  pending membership, and completed tasks may be reassigned without membership.
- Real Atlas HTTP evidence: both-side GETs and persisted-state comparisons after
  updates; task transfers through both endpoints; repeated membership inputs;
  completion/reopening/unassignment/reassignment; pending/completed user rename;
  optional resets and unchanged ids/dates; rejected field/reference/email/name
  cases with unchanged snapshots; injected failures after multiple writes; and
  concurrent email and cross-endpoint/user-endpoint transfers. No validation-only
  atomicity claim is made: transaction rollback was exercised after writes began.

No frontend, authentication, build system, Docker, dependency major upgrades, or
other unrelated features belong in this step.

## Implemented DELETE and common HTTP behavior

- Both DELETE services use `requireResource` inside `atomicWrite`. Malformed or
  absent URL resources return 404. The target deletion and every related write
  receive the same session; success is returned only after commit.
- Task deletion removes the task, then clears its id from its assigned user's
  pending list using the shared membership cleanup helper. Pending, completed,
  and unassigned tasks are supported; unrelated owners are not targeted.
- User deletion removes the user and sets the assignment pair on **all** tasks
  matching that user's id to `""` / `"unassigned"`. It does not use pendingTasks
  as the only task list, so completed assignments are also cleared. Tasks,
  completion flags, dates, and all other business data are preserved.
- The course documents still do not prescribe a single DELETE success status.
  The implemented project choice is 200 with `data: null` and `User deleted.` or
  `Task deleted.`. Subsequent single GET and repeated DELETE return 404; collection
  filters for the deleted id still succeed with `[]` or count 0.
- Unknown API paths use the existing JSON 404 middleware. Malformed JSON and
  recognized validation errors are safe 400s; unexpected errors are safe 500s.
  CORS headers cover successful/error responses and advertise POST, GET, PUT,
  DELETE, OPTIONS. Preflight terminates with 204, no JSON body, and no content type.
  Parameterized routes and the middleware catch-all are compatible with the
  installed Express 5; no legacy wildcard route syntax was added.
- Targeted real HTTP evidence includes unrelated-user snapshot comparisons,
  successful/repeated/missing-id deletion, preserved pending/completed task data,
  rollback after deleting a target but failing reference cleanup, CORS preflight,
  and normal envelopes across 200/201/400/404/500. These checks complete this
  implementation step. The expanded integration matrix is recorded below.

## Repeatable integration verification

- [x] Provide Node 24 built-in test/fetch commands, explicit ignored test secrets,
  unique fixture namespaces, scoped queries/cleanup, and prerequisite instructions
  in [TESTING.md](TESTING.md). No database or collection is dropped or cleared.
- [x] Exercise all ten operations through real HTTP and verify persisted records,
  status/envelope/content types, validation and defaults, server dates, full PUT
  replacement, own/duplicate email, id/error precedence, and single projections.
- [x] Cover all six collection parameters individually/in combination, malformed
  JSON/shapes, no matches, task default 100, unlimited users, and explicit zero
  with 105 isolated matching fixtures in each collection.
- [x] Check assignment transitions through both resources, deletion preservation,
  concurrent uniqueness/transfers, and completed creation versus owner changes.
- [x] Share a fixture invariant checker across database groups and snapshot records
  around rejected requests, including detection of leftover creations. Exercise
  an observed transaction write followed by a controlled test-only failure.
- [x] Correct invalid regex options returning 500: validate MongoDB's supported
  options and map recognized query errors to sanitized 400 responses. Valid
  supported flags and PCRE patterns remain usable.
- [x] Correct completed-task creation racing with owner rename/deletion: make
  membership cleanup update the owner's internal version even for a no-op pull,
  so transactions conflict/retry rather than retaining a stale owner snapshot.
  Every dependent operation still receives the session; no partial fallback exists.

This is evidence for the documented integration matrix, not every possible query,
an exhaustive concurrency schedule, or the undisclosed deployed autograder.
