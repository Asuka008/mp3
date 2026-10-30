# Official MP3 self-check

API: https://asuka008-mp3.onrender.com. Repository: Asuka008/mp3, main.
`npm run submit` is a self-check, **not assignment submission**. The course form has not been submitted. The grader URL and grading logic are unchanged.

## Run 1 — 90/100; DELETE success response mismatch

- Started: October 30, 2026 at 5:38:10 PM CDT (2026-10-30T22:38:10.055Z).
- Finished: October 30, 2026 at 5:38:42 PM CDT (2026-10-30T22:38:42.501Z).
- Deployed revision: 8dce84d309014733a1c1c17ca49947fab6d66d66; Render service srv-dbihj2l9fdbs73dmgjqg, deployment dep-dbihmg68bjmc73bh7ta0.
- Command: npm run submit; exit 0; elapsed 32.446 seconds.
- Actual result: **90/100 (18/20 points)**. Eighteen items passed; the two successful DELETE responses failed status/body expectations.
- No timeout, rate-limit response, skipped prerequisite, or database-access failure occurred. A zero client exit code means the request completed, not that full credit was awarded.

### Actual client output

```text
> mp3_starter@1.0.0 submit
> node submit.js

Submitting https://asuka008-mp3.onrender.com to the autograder...
This can take a few minutes (the autograder runs many requests against your API).

[PASS   ] POST /users  (1/1)
[PASS   ] POST /users (validation)  (1/1)
[PASS   ] POST /tasks  (1/1)
[PASS   ] POST /tasks (validation)  (1/1)
[PASS   ] GET /users/:id (select)  (0.75/0.75)
[PASS   ] GET /tasks/:id (select)  (0.75/0.75)
[PASS   ] PUT /users/:id (not found)  (1/1)
[PASS   ] PUT /tasks/:id (not found)  (1/1)
[PASS   ] PUT /tasks/:id (two-way reference)  (2.5/2.5)
[PASS   ] PUT /users/:id (two-way reference)  (2/2)
[PASS   ] PUT /tasks/:id (assignedUserName mismatch)  (1/1)
[PASS   ] GET /tasks (where)  (0.75/0.75)
[PASS   ] GET /tasks (sort)  (0.75/0.75)
[PASS   ] GET /tasks (limit)  (0.75/0.75)
[FAIL   ] DELETE /tasks/:id  (0/1)
           - Deleting a task: response body should be empty
           - Deleting a task: expected status 204, received 200
[PASS   ] GET /tasks/:id (deleted)  (1/1)
[PASS   ] GET /tasks (count)  (0.75/0.75)
[FAIL   ] DELETE /users/:id  (0/1)
           - Deleting a user: response body should be empty
           - Deleting a user: expected status 204, received 200
[PASS   ] GET /users/:id (deleted)  (1/1)

Score: 90/100  (18/20 points)
```

## Diagnosis and correction

README.md/FAQ.md do not explicitly select one successful DELETE status. The project initially documented 200 with a JSON envelope. The official self-check now clarifies that both successful DELETE routes must return **204 with an empty body**. That supersedes the earlier project interpretation; it is not a newly invented README rule. Errors still use their existing JSON envelopes and 400/404/500 distinctions.

A focused public reproduction confirmed both routes returned 200 and 39 body bytes, while subsequent reads returned 404. The updated real HTTP/Atlas DELETE regression also failed against the old handler before the fix. The correction changes only successful response handling after the shared atomic removal resolves; transactions, reference cleanup, errors, grader URL, and grading logic are preserved. Regression clients now explicitly assert 204, zero body bytes, and no content type; they do not try to parse JSON from 204.

## Fixture safety

Private pre-run and post-run id inventories both contained zero users and zero tasks. No grader leftovers remained. The focused reproduction removed only its two returned fixture ids. Atlas regression fixtures use their existing UUID/id-scoped cleanup. No shared-database clear or naming-guess cleanup is used.

## Follow-up verification

`npm test`: 36 passed, 0 failed; five database groups skipped by default.
`npm run test:integration`: five passed, 0 failed, 0 skipped in 136.450 seconds;
792 real HTTP requests included both bodyless DELETE routes, preservation,
rollback, validation, queries, and reference invariants. Scoped cleanup passed.
Syntax checks and git diff whitespace checks passed.

Redeployment of the fix is next. The second official run must target the verified
new live revision; no unchanged-code retry has been made. The documented limit
is approximately five runs per two minutes.
