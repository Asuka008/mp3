# Sources actually consulted

## Assignment and repository sources

- [README.md](../README.md): assignment endpoints, schemas, queries, validation,
  reference rules, grading weights, deployment, submission, and LLM policy.
- [FAQ.md](../FAQ.md): Node/package requirements, replacement and cascade rules,
  timestamps, error ordering, environment convention, and submission clarifications.
- Starter `package.json`, `package-lock.json`, `server.js`, `routes/`, `models/`,
  `.env.example`, `.gitignore`, and `submit.js`: existing implementation and setup.
- No applicable `AGENTS.md` was found in the repository or its ancestor directories.

## External references

No external reading was consulted during the first foundation step. Across the
Atlas/startup, data-contract, and POST/GET steps, these official references were
consulted (October 29, 2026):

- [Deploy a Free Cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/):
  selecting the Free/M0 tier, provider/region, and cluster creation.
- [Configure Database Users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/):
  database-user versus Atlas-account credentials, authentication, and access scope.
- [Advanced User Configuration](https://www.mongodb.com/docs/atlas/data-federation/tutorial/advanced-security-options/advanced-db-user-config/):
  Specific Privileges UI and database/collection scope; the actual current cluster
  user form was also inspected to verify these controls exist.
- [Configure IP Access List Entries](https://www.mongodb.com/docs/atlas/security/ip-access-list/):
  project-wide network access configuration and required privileges.
- [Connect via Client Libraries](https://www.mongodb.com/docs/atlas/driver-connection/):
  Connect > Drivers, Node.js driver selection, and default SRV connection strings.
- [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/):
  Atlas UI connection-string retrieval and credential percent encoding.
- [Troubleshoot Connection Issues](https://www.mongodb.com/docs/atlas/troubleshoot-connection/):
  reserved-character encoding, authentication, DNS, and IP access troubleshooting.
- [Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/):
  choosing a database versus physically creating it with a collection/write.
- [Mongoose Connections](https://mongoosejs.com/docs/connections.html):
  awaiting connection promises, error events, and `serverSelectionTimeoutMS`.
  Also inspected installed Mongoose 9.11.1 connection implementation/comments;
  the website documents a newer patch, and no dependency upgrade was made.
- [Mongoose Validation](https://mongoosejs.com/docs/validation.html) (data-contract step):
  required/type validation, the difference between a unique index and a validator,
  and awaiting model initialization before relying on uniqueness.
- [Mongoose Timestamps](https://mongoosejs.com/docs/timestamps.html) (data-contract step):
  creation-date immutability and the timestamp replacement hazards of raw
  `replaceOne`/`findOneAndReplace`. The implementation uses an immutable Date
  default, whitelisted payloads, and document overwrite/save instead.
- [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html) (data-contract step):
  connection transaction wrapper, session propagation, commit/rollback, retries,
  and avoiding parallel operations within a single transaction.
- [Mongoose Query API](https://mongoosejs.com/docs/api/query.html) (POST/GET step):
  find, projection, sorting, skip/limit, lean results, counting, and the operators
  not supported by countDocuments. Count/pagination interaction remains the
  separately documented project interpretation.
- [MongoDB cursor limit](https://www.mongodb.com/docs/manual/reference/method/cursor.limit/) (POST/GET step):
  explicit zero as no limit, and applying skip/limit through database queries.
- [MongoDB projection](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/) (POST/GET step):
  database-side inclusion/exclusion projection and projection restrictions.
- [MongoDB Error Codes](https://www.mongodb.com/docs/manual/reference/error-codes/) (POST/GET step):
  distinguish query parse/type/value failures from access or connectivity failures.
- Installed Mongoose 9.11.1 source/API comments in `lib/document.js`,
  `lib/schema/array.js`, `lib/schema/string.js`, and timestamp helpers:
  checked document overwrite semantics, strict string casts, and non-array casts.
- Installed Mongoose query-casting code in `lib/schemaType.js` and schema
  string/date/boolean/ObjectId/array implementations (POST/GET step): checked
  operand coercion and unsupported-operator error forms, including ObjectId's
  different message. No library implementation was copied into the project.
- Signed-in MongoDB Atlas UI: observed Free cluster pricing/status, actual database
  user privilege controls, IP access rule, and connection workflow. Account/project
  identifiers and real credentials are not reproduced here.

No third-party tutorial code was used. Dependency downloads are installation
activity, not additional consulted reading. Add actual references as consulted.

The PUT step consulted the course two-way-reference/status-code sections and
existing creation/validation/transaction code. It reused the previously cited
Mongoose APIs; no additional external reading or tutorials were consulted.

The DELETE/common-HTTP step likewise consulted the current course files and
existing response/error/reference/transaction code. The course leaves DELETE's
success status unspecified, so the existing documented 200 decision was retained.
No additional external references were consulted in that step (October 30, 2026).

The repeatable integration-suite step consulted these official references
(October 30, 2026), alongside the course documents and current implementation:

- [Node 24 test runner](https://nodejs.org/docs/latest-v24.x/api/test.html):
  built-in runner, skip/timeout controls, and serial test-file execution. The
  installed runtime remains Node 24.16.0; no runtime/dependency upgrade was made.
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/):
  multi-document atomicity and concurrent transaction/write-conflict behavior.
- [MongoDB $regex](https://www.mongodb.com/docs/manual/reference/operator/query/regex/):
  supported `i`, `m`, `s`, `x`, `u` options and string PCRE patterns. An actual
  invalid-option query was diagnosed using error type/code only; no raw database
  error, connection URI, or credentials were printed.

The Render deployment step consulted the following official sources (October 30,
2026):

- [Render Node/Express deployment](https://render.com/docs/deploy-node-express-app):
  creating a Node web service connected to a Git repository, with project-specific
  build/start commands.
- [Render Node versions](https://render.com/docs/node-version): precedence of
  NODE_VERSION, .node-version, .nvmrc, and bounded package engines. This project
  pins the tested 24.16.0 release rather than relying on the provider default.
- [Render Web Services](https://render.com/docs/web-services): repository/branch,
  root/build/start configuration, health checks, supplied PORT, and public HTTPS.
- [Render Free services](https://render.com/docs/free): selecting Free, idle
  spin-down/cold start, ephemeral filesystem, and usage limitations.
- [Render environment variables and secrets](https://render.com/docs/configure-environment-variables):
  private service configuration without committing database credentials.
- [body-parser maintainer advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828):
  a compressed-request denial of service fixed in 2.4.0. The clean deployment
  install's npm audit identified the affected locked dependency.
- [qs maintainer advisory](https://github.com/ljharb/qs/security/advisories/GHSA-6pq8-jhm2-2vcw):
  affected stringify behavior and patched releases; compatible dependency updates
  were checked rather than applying unrelated major-version upgrades.
- Actual public GitHub repository and signed-in GitHub/Render UI: verified personal
  assignment ownership, approved single-repository app installation, Node service
  settings, Free compute selection, private environment configuration, successful
  deploy/build/runtime logs, public URL, and source revision. No account credentials
  or connection strings are reproduced here. Real public API smoke responses were
  consulted as verification evidence, alongside Atlas connection-status/ping.

## LLM assistance

OpenAI Codex was used in this chat to inspect the starter, implement the foundation,
write the checklist/handoff/setup documents, configure Atlas with user participation,
implement/test connection-aware startup, and build/test models, validation,
error mapping, and transaction helpers, then implement and verify the six POST/GET
operations, followed by atomic PUT replacements and reference synchronization.
The DELETE/common-HTTP step added transactional deletions and targeted Atlas HTTP
verification of cleanup, preservation, rollback, and response/CORS behavior.
The integration-suite step added explicit test-environment isolation, shared
fixture invariants, a broader real HTTP/Atlas contract matrix, observed-write
rollback and concurrency checks, and fixes for regex-error mapping and a
completed-task/owner-change race.
The deployment step reviewed/published the assignment, configured the Free Render
service and private Atlas environment, inspected build/runtime logs, verified the
public API with isolated fixtures, and set only the submission helper's API_URL.
The initial login blocker and resumed successful deployment are recorded in
DEPLOYMENT.md and PROGRESS.md. No official autograder or course form was run.
Preserve and
submit this chatlog with the source, and answer the course's LLM survey questions
as required by README.md. This entry does not replace the required chatlog.
