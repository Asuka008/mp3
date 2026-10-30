# Implemented API operations

Start with `npm start` after the private setup in [SETUP.md](SETUP.md). All ten
assignment operations are implemented. Targeted checks pass; broader final
verification, deployment, and submission remain separate steps.

| Method | Path | Success data |
| --- | --- | --- |
| POST | `/api/users` | Created user, HTTP 201 |
| POST | `/api/tasks` | Created task, HTTP 201 |
| GET | `/api/users` | User array or numeric count, HTTP 200 |
| GET | `/api/tasks` | Task array or numeric count, HTTP 200 |
| GET | `/api/users/:id` | User object, HTTP 200 |
| GET | `/api/tasks/:id` | Task object, HTTP 200 |
| PUT | `/api/users/:id` | Replaced user, HTTP 200 |
| PUT | `/api/tasks/:id` | Replaced task, HTTP 200 |
| DELETE | `/api/users/:id` | Empty body, HTTP 204 |
| DELETE | `/api/tasks/:id` | Empty body, HTTP 204 |

Every response has `message` and `data`. Invalid input returns 400; a malformed or
missing single-resource id returns 404. Collection filters with no matches return
200 with `[]` or count `0`. Errors use safe human-readable messages and `data: null`.

## Create

Use a fresh email for each new user. These examples create records in your Atlas
assignment database; copy the returned `_id` values for later requests.

```sh
curl -sS 'http://localhost:3000/api/users' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example User","email":"mp3-example@example.invalid"}'

curl -sS 'http://localhost:3000/api/tasks' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example Task","deadline":"2026-11-01T18:00:00.000Z"}'
```

Users require string `name`/`email` and default `pendingTasks` to `[]`. Tasks require
string `name` and a valid date string `deadline`; defaults are description `""`,
completed `false`, assignedUser `""`, assignedUserName `"unassigned"`. Past deadlines
are valid. `_id`, `dateCreated`, and internal fields supplied by clients are ignored.

To assign a new task, supply `assignedUser` with an existing user's id. Omit
`assignedUserName` to derive it, or supply the exact current name. Pending tasks
are added to that user's list; completed tasks keep assignment without membership.
Creating a user with `pendingTasks` moves those existing pending tasks from any
previous owners to the new user. Duplicated ids are removed. Missing/completed
references or mismatched names reject the entire creation without partial writes.

Both JSON and URL-encoded bodies work. Forms accept exact `completed=true` or
`completed=false` text and JSON-encoded `pendingTasks` arrays. JSON requires real
booleans/arrays. Full normalization decisions are in [REQUIREMENTS.md](REQUIREMENTS.md).

## Collection queries

`curl --get --data-urlencode` encodes JSON punctuation and `$` operators correctly.
Keep the single quotes shown here so the shell does not expand query operators.

```sh
curl -sS --get 'http://localhost:3000/api/users' \
  --data-urlencode 'sort={"name":1}' \
  --data-urlencode 'select={"name":1,"email":1,"_id":0}' \
  --data-urlencode 'skip=0' \
  --data-urlencode 'limit=20'

curl -sS --get 'http://localhost:3000/api/tasks' \
  --data-urlencode 'where={"completed":true}' \
  --data-urlencode 'sort={"deadline":1}' \
  --data-urlencode 'select={"name":1,"deadline":1,"_id":0}' \
  --data-urlencode 'skip=0' \
  --data-urlencode 'limit=20' \
  --data-urlencode 'count=false'

curl -sS --get 'http://localhost:3000/api/tasks' \
  --data-urlencode 'where={"_id":{"$in":["aaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbb"]}}'

curl -sS --get 'http://localhost:3000/api/tasks' \
  --data-urlencode 'where={"completed":false}' \
  --data-urlencode 'skip=1000' \
  --data-urlencode 'limit=1' \
  --data-urlencode 'count=true'
```

The example `$in` ids are valid-format examples; replace them with returned task
ids to match your records. No match is still a successful empty collection.

Tasks default to 100 results and users to unlimited. Explicit `limit=0` is
unlimited. The last example returns the **total matching count before pagination**;
this is the documented project decision where the course leaves the interaction
open. Query values must be valid JSON: numbers/booleans are unquoted, and filter,
sort, and projection values are objects. Invalid shapes return 400.

## Single-resource queries

Replace the example ids below with ids returned by the corresponding POST.

```sh
curl -sS --get 'http://localhost:3000/api/users/aaaaaaaaaaaaaaaaaaaaaaaa' \
  --data-urlencode 'select={"name":1,"email":1,"_id":0}'

curl -sS --get 'http://localhost:3000/api/tasks/bbbbbbbbbbbbbbbbbbbbbbbb' \
  --data-urlencode 'select={"description":0,"_id":0}'
```

Only `select` is read on these paths. Every other query parameter is ignored, even
if its value is malformed. Data is one object, not an array. A nonexistent id
returns 404 even when a collection `where` filter for that id would return `[]`.

## Replace a resource

PUT requires name/email for a user or name/deadline for a task. Supply the complete
desired business state: omitted optional fields reset to defaults. In particular,
omitted `pendingTasks` becomes `[]`, omitted `assignedUser` unassigns the task,
omitted `completed` becomes false, and omitted description becomes `""`. The id
and original dateCreated stay unchanged; client-supplied internal fields are ignored.

Replace these example ids with returned resource ids, and use the user's actual
email. The user example intentionally supplies an empty pending list, unassigning
previous pending tasks; completed tasks keep their assignment and get the new name.

```sh
curl -sS --request PUT 'http://localhost:3000/api/users/aaaaaaaaaaaaaaaaaaaaaaaa' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Renamed User","email":"mp3-example@example.invalid","pendingTasks":[]}'

curl -sS --request PUT 'http://localhost:3000/api/tasks/bbbbbbbbbbbbbbbbbbbbbbbb' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example Task","deadline":"2026-11-01T18:00:00.000Z","assignedUser":"aaaaaaaaaaaaaaaaaaaaaaaa","completed":true}'
```

The task example retains a valid assignment while completing the task and removing
pending membership. With `completed: false` and a valid assignment it becomes
pending again. An omitted assigned name is derived; an explicit mismatch is 400.
Reassigning a completed task is allowed and does not add pending membership.
Changing a user's pending list moves requested pending tasks from their previous
owners. A user rename updates every task still assigned, completed ones included.

Malformed/nonexistent URL ids return 404 before required-field checks on a parsed
body. Invalid body reference ids are 400; valid-format missing references are 404;
completed tasks requested in pendingTasks and duplicate emails are 400. A user may
keep their own email. Rejected replacements roll back all related writes.

## Delete a resource

Replace these example ids with the intended resource ids:

```sh
curl -i --request DELETE 'http://localhost:3000/api/tasks/bbbbbbbbbbbbbbbbbbbbbbbb'

curl -i --request DELETE 'http://localhost:3000/api/users/aaaaaaaaaaaaaaaaaaaaaaaa'
```

Success is **204 with no response body or JSON content type**, as required by
the actual official self-check. The README/FAQ did not name one success code;
this feedback supersedes the earlier 200/envelope project choice (see GRADING.md).
Deleting a task also removes pending
membership. Deleting a user preserves their tasks, including completed ones,
and clears only assignedUser/assignedUserName to the unassigned defaults.
Deletion and reference changes commit atomically. Another user's unrelated tasks
and references are preserved. Malformed/missing ids, repeated DELETE, and a GET
after deletion return 404. Collection queries for the deleted id return `[]`/`0`.

## Common HTTP behavior

Successful and error responses use the JSON envelope where a body is allowed.
Unknown API paths return 404, malformed JSON/recognized invalid values return 400,
and unexpected failures return 500 without raw database details or stack traces.
CORS allows GET, POST, PUT, DELETE, and OPTIONS. A preflight is bodyless 204:

```sh
curl -i --request OPTIONS 'http://localhost:3000/api/tasks' \
  -H 'Origin: http://localhost:8080' \
  -H 'Access-Control-Request-Method: DELETE' \
  -H 'Access-Control-Request-Headers: Content-Type'
```

## Verification

`npm test` runs local checks without Atlas. `npm run test:integration` (also
available as `npm run test:atlas`) runs model/index checks and actual HTTP
POST/GET/PUT/DELETE checks against the explicit private test connection, including
rollback after observed writes, concurrent transfers, validation snapshots,
pagination, deletion preservation, and common HTTP/CORS behavior. Cleanup removes
only that run's identifiable fixtures through controlled database operations.
See [TESTING.md](TESTING.md) for `.env.test` prerequisites, the coverage matrix,
shared invariants, and limitations. Deployment is not exercised by this suite.
