# Repeatable MP3 verification

Use **Node 24.x** (`nvm use`) and the existing locked dependencies. No new test
package is required: tests use `node:test`, `node:assert/strict`, built-in `fetch`,
and the installed Mongoose/MongoDB driver. README.md and FAQ.md are the assignment
authority. Project choices are labeled in REQUIREMENTS.md.

## Commands

```sh
npm test
npm run test:integration
```

`npm test` runs local checks and explicitly skips the database groups. It covers
payload validation/defaults, safe error handling, query parsing/delegation, local
HTTP/CORS, startup failure paths, credential encoding, test-environment isolation,
and positive/negative tests of the invariant checker. Passing it alone is not
evidence of database correctness.

`npm run test:integration` runs all five real-database groups serially. Each starts
its own temporary HTTP server or database session, waits for required indexes,
and cleans up only its own fixtures. Explicit concurrent-request cases still run
in parallel within a group. `npm run test:atlas` is a compatibility alias for this
same command. Typical runtime is around two minutes, depending on Atlas latency.

To run only the expanded contract matrix while diagnosing a failure:

```sh
MP3_ATLAS_TESTS=1 node --test test/contract-atlas.test.js
```

The opt-in flag enables database tests; it does not provide credentials. Missing
or placeholder test configuration fails explicitly instead of silently using the
assignment connection. Results and exact executed commands are in PROGRESS.md.

## Explicit private test connection

Copy `.env.test.example` to `.env.test` only if the private file does not already
exist, then edit it privately. Its only required value is:

```dotenv
TEST_MONGODB_URI="mongodb+srv://<encoded-user>:<encoded-password>@<atlas-host>/<authorized-database>?retryWrites=true&w=majority&authSource=admin"
```

Use an existing Atlas database user with read/write, collection/index creation,
and transaction access to the selected database. Atlas must be reachable through
the project IP access list and network/DNS. The URI must select an explicit
non-system database. Percent-encode credentials once as described in SETUP.md.
Do not put real values in example files, commands, chat, or logs.

The environment helper reads `TEST_MONGODB_URI` from the test process or ignored
`.env.test`. `MP3_TEST_ENV_FILE` optionally names a different local test-env file.
It sets `MONGODB_URI` and an ephemeral `PORT=0` only in the test process, validates
the selected database, and restores previous process values after disconnecting.
It never falls back to `.env`. Normal `npm start` still uses `.env` as before.

Both `.env` and `.env.test` are ignored and must remain untracked:

```sh
git check-ignore -v .env .env.test
git ls-files -- .env .env.test
```

The second command should print nothing. This workspace's `.env.test` uses the
existing authorized `mp3` database with carefully tracked fixtures. No new paid
resource or new database permission was provisioned. A separate authorized test
database can be selected in the URI without changing tests or production config.

## Fixture safety and shared invariants

Tests allocate unique ObjectIds and/or UUID-prefixed names/emails for each run.
Collection-query fixtures use their own filter, including the 105 users and 105
tasks used to check limits. Counts never assume the assignment database is empty.
Snapshots include tracked ids and attempted UUID-marked records, so a rejected
POST that accidentally leaves a resource would fail the unchanged-state check.

Cleanup uses only those generated ids or that run's UUID namespace and verifies
zero remaining matches. There is no `dropDatabase`, collection drop, or unfiltered
delete. Existing unrelated assignment records are never cleanup targets. A failed
run still executes cleanup in `finally`; unavailable database access or forceful
process termination can prevent cleanup, so a failed/interrupted run is not
reported as a clean verification.

`testing/invariants.js` exports `assertFixtureInvariants(users, tasks)`. Pass the
closed graph of one run's fixture records. It verifies:

- Each assigned incomplete task has exactly one membership in its existing owner.
- Each pending entry is a string id of an existing incomplete task assigned back
  to that user, with the user's current name.
- Membership has no duplicates; completed tasks appear in no pending list.
- Every assigned task, completed ones included, has an existing matching owner/name.
- Unassigned tasks have exactly the empty id and `unassigned` name pair.

The checker is shared by every database group. Unit mutation cases prove it detects
missing entries, duplicate entries, missing resources/owners, completed membership,
and stale/noncanonical names. HTTP workflow checks also compare returned resources
with stored documents and preserve creation-date assertions.

## Assignment coverage map

| Matrix area | Real integration evidence |
| --- | --- |
| All ten operations, envelopes, content types, codes, persistence | HTTP POST/GET, PUT, DELETE groups; contract client checks exact envelope keys/content type |
| Required fields, wrong types/dates, defaults, unique/own email | Contract POST/PUT tables, model unique-index check, HTTP creation/update workflows |
| Server dateCreated and immutable replacement dates/ids | Dynamic creation-time bounds, client override attempts, persisted PUT comparisons |
| Full replacement instead of PATCH | User list omission; task description/completed/assignment omission in PUT group |
| All six collection parameters, combinations, no matches, invalid JSON/shapes | POST/GET and contract query tables on both collections |
| Task default 100, unlimited users, explicit zero | 105 isolated fixtures per collection; ascending/descending expected pages and exact counts |
| Single select inclusion/exclusion, ignored parameters | Both resource routes, excluded _id, mixed irrelevant malformed values, id-only inclusion |
| URL/body id distinctions and precedence | Malformed/nonexistent ids; missing-resource PUT with invalid/missing required body; duplicate/ref/completion ordering |
| Assignment transitions through both endpoints | Creation references, moves, complete/reopen/unassign, rename, pending-list replacement, completed-task reassignment |
| Deletion and preserved unrelated data | Pending/completed/unassigned deletion, user cascade, repeat DELETE/GET, exact unrelated snapshots |
| Failure leaves no changes/leftovers | Relevant fixture snapshots before/after rejected requests, followed by shared invariants |
| Failure after an actual transaction write | Contract group reads its own changed user inside the transaction, throws a test-only error, then verifies full rollback and unchanged HTTP state |
| Concurrent uniqueness/assignment | Concurrent duplicate POST/PUT emails; task/user transfers; completed creation versus owner rename/deletion |

The focused rollback fault exists only in the test callback passed to the shared
transaction helper. It performs and observes a real database write before throwing.
There is no public fault endpoint or production test switch. Existing HTTP rollback
tests also intercept a later write in the test process while earlier transaction
writes execute against Atlas. Normal success paths use real Mongoose methods.

## Requirements versus choices

Count-before-pagination, numeric nonnegative pagination, exact-case email storage,
form normalization, and URL-first single-GET precedence are documented project
choices where applicable. Successful DELETE is bodyless 204 after the official
self-check clarified this previously unspecified detail; the old 200/envelope
choice is superseded. OPTIONS is also bodyless 204. The README/FAQ mixed missing/completed-task
precedence ambiguity remains documented in REQUIREMENTS.md.

The wider matrix found two implementation defects: invalid regex options were
reported as 500, and completed-task creation could race with an owner rename and
keep a stale name. Regex options now follow MongoDB's supported set and recognized
query errors map to 400. Membership cleanup also increments the owner's internal
version, forcing transaction conflicts/retries even when the membership pull is
a no-op. Business fields and creation dates are unchanged by that internal write.

Passing these tests is evidence for the covered local HTTP/Atlas contract. It does
not verify Render hosting, the undisclosed deployed autograder, every MongoDB query
feature, or an exhaustive concurrency/load schedule. No deployment-ready claim is
made. Use API.md's existing curl examples for manual learning; the automated suite
is the primary regression source rather than a duplicated Postman matrix.

The separate public Render smoke command and its results are in
[DEPLOYMENT.md](DEPLOYMENT.md). It uses only disposable UUID fixtures and does
not invoke the official course autograder.
