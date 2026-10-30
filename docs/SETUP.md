# Atlas and local startup

Use Node **24.x** (`nvm use` if available), the existing lockfile, Express 5,
and Mongoose 9. Course requirements remain in README.md and FAQ.md.

## Steps in Atlas

1. Sign in at [MongoDB Atlas](https://cloud.mongodb.com/). The Atlas account login
   manages projects and clusters. A separate **database user** authenticates the
   backend; its username/password are not your Atlas website login.
2. In the project, choose **Create** / **Create Deployment**, select **Free (M0)**,
   name the cluster `mp3`, and choose an available provider/region. Confirm that
   pricing is `$0/hour`. Skip sample data and automated security setup so access
   can be scoped explicitly. Do not select M10, Flex, or paid upgrades. See the
   official [Free cluster guide](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
3. Open **Security > Database & Network Access > Database Users > Add New Database
   User**. Use Password authentication, username `mp3_app`, and a strong password
   saved privately. Under **Specific Privileges**, select `readWrite`, database
   `mp3`, and leave Collection blank. Restrict access to cluster `mp3`; grant no
   Atlas admin or read/write-to-all-databases role. Enter/submit new credentials
   yourself. See [database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
4. Under **IP Access List**, choose **Add IP Address**. Use **Allow Access from
   Anywhere** if offered, or enter `0.0.0.0/0`; confirm and wait for the entry to
   become active. This is explicitly required by the course. It permits connection
   attempts from all IPv4 addresses, while database-user authentication still
   applies. The list affects the project, so keep this project for assignment data.
   See [IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
5. In **Clusters**, click **Connect > Drivers**, select **Node.js**, and choose a
   driver version matching the installed driver (currently MongoDB driver 7.x,
   supplied by Mongoose 9). Copy the default `mongodb+srv://` connection string.
   No additional driver package is needed. See [driver connection](https://www.mongodb.com/docs/atlas/driver-connection/).

Use database name **`mp3`** in both the user's privileges and the URI path. A
cluster name and database name are separate even though both are called `mp3`
here. Selecting `/mp3` does not immediately create a visible database: MongoDB
creates it when a collection/data is first written. A connection/ping does not
populate it. In this workspace, setup created an empty `users` collection to
materialize `mp3`; no documents were inserted. No business data or sample data is
needed in this step. See
[database creation](https://www.mongodb.com/docs/manual/core/databases-and-collections/).

## Local environment

The existing ignored `.env` is private. This workspace already has the Atlas host,
username `mp3_app`, and `/mp3` database prepared. To supply the existing database
password without echoing it or putting it in shell history, run this in your own
terminal from the repository and enter the password at the hidden prompt:

```sh
npm run configure:atlas
```

The helper encodes the raw password exactly once and updates only the URI line,
preserving TOKEN and other entries. It does not create or change the Atlas user.
The browser protects credential fields, so the real password must be supplied
locally by the user. If `.env` is missing, copy `.env.example` once; never overwrite
an existing file. For a different cluster, prepare **only** `MONGODB_URI` privately
in a local editor, preserving `TOKEN=secret-starter-mern` and all other entries:

```dotenv
MONGODB_URI="mongodb+srv://<encoded-database-username>:<encoded-database-password>@<atlas-cluster-host>/mp3?retryWrites=true&w=majority&authSource=admin"
```

Use the actual host and options obtained from Atlas. Insert `/mp3` immediately
before `?`, and retain Atlas's query options. `authSource=admin` authenticates the
Atlas database user; it does not change the selected application database `mp3`.

When editing a complete URI manually, percent-encode reserved characters in **each credential component**, exactly once;
do not encode the entire URI. For example, `@` becomes `%40`, `#` becomes `%23`,
and a literal `%` becomes `%25`. Encode spaces and other reserved punctuation as
documented by [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/#special-characters-in-connection-string-password).
For a local JavaScript encoder, use `encodeURIComponent(value).replace(/[!'()*]/g,
c => '%' + c.charCodeAt(0).toString(16).toUpperCase())`. Keep any real input/output
private; never use an online encoder, chat, shell command arguments/history, or
shared logs for credentials. Do not leave angle-bracket placeholders in `.env`.

Startup loads `.env` quietly. Already supplied process environment variables take
precedence, including an empty value. If a previously exported `MONGODB_URI` masks
your edited file, run `unset MONGODB_URI` in that terminal before `npm start`.
`PORT` can also be supplied by the process; it defaults to `3000` locally.

## Start and verify

```sh
npm ci --no-audit --no-fund
npm start
```

The startup sequence validates configuration, awaits `mongoose.connect`, performs
`db.command({ ping: 1 })` on the selected database, awaits model/index initialization
(including the unique email index), and only then opens the HTTP port.
The selection timeout is 10 seconds. No deprecated Mongoose options or
callbacks are used. Readiness is logged only after the listener is open and the
database ping has succeeded:

```text
Server ready on port 3000; MongoDB Atlas connected and database ping verified.
```

Check the root in a second terminal:

```sh
curl http://localhost:3000/api
```

Expected JSON: `{"message":"MP3 API foundation is running.","data":null}`.
The root response by itself proves only HTTP handling. Startup's successful
connection and ping provide the database check. They do not verify write
privileges, business operations, or future transaction behavior.

Missing/placeholder configuration, connection, ping, index initialization, or listener
failure prevents readiness and exits with status `1` and a sanitized message.
For connection failures, inspect the database user's access/password, encoding,
cluster status, and IP access list privately; DNS/firewalls must also allow Atlas.
The project uses Atlas SRV URIs with an explicit database and does not silently
fall back to a local database. System databases (`admin`, `local`, `config`) are
rejected as application databases. These validation choices are project policy.

```sh
npm test
MONGODB_URI='' npm start
git check-ignore -v .env
git ls-files --error-unmatch .env
```

`npm test` uses driver stubs for startup paths, plus real local HTTP requests; it
does **not** prove a real Atlas connection. The empty-variable command intentionally
fails without altering `.env`. The final Git command should fail to find `.env`,
which confirms it is untracked. Never print `.env` or include real secrets in docs.
An explicit `npm run test:integration` (`test:atlas` is an alias) checks real
indexes, validation, replacement dates, transaction rollback, and all ten
assignment operations over HTTP with temporary fixtures. Supply `TEST_MONGODB_URI`
privately in ignored `.env.test`; tests never fall back to `.env`. They clean up
only their own ids/UUID-marked records. See [TESTING.md](TESTING.md) for database
prerequisites, fixture safety, coverage, and exact commands.
Index conflicts fail startup safely: inspect and resolve conflicting records
deliberately, rather than deleting data or dropping the unique index automatically.
See [API.md](API.md) for all implemented operations and encoded HTTP examples,
and [DEPLOYMENT.md](DEPLOYMENT.md) for the reviewed Render settings and status.
The local HTTP/Atlas integration matrix is documented in TESTING.md and
PROGRESS.md. Deployment, deployed verification, and submission remain separate.
