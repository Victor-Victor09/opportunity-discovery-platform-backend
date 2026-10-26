# Architecture Decisions

Each entry records what was chosen, why, what was rejected, and what it costs. Status values: Proposed, Accepted, Superseded, Rejected. A superseded entry stays in this file with a pointer to its replacement, so history is kept.

The language and module system are in ADR-015. The Zod, pino and Vitest choices below also carry over unchanged if TypeScript is adopted later.

Product and scope decisions, such as what students can see and what is deferred, are in [`product-decisions.md`](product-decisions.md). This file covers technical choices only.

## Technical decisions

### ADR-001 Modular monolith
Status: Accepted. One Express app, one database, one deployable unit, with internal layers (routes, controllers, services, models).
Why: two backend developers and a short build window. Microservices add deployment, networking and debugging work that returns nothing at this scale.
Rejected: microservices, serverless functions per route.
Trade-off: scaling is all-or-nothing. A provider module or notification worker can be added later as a new module or a separate process reading the same database.

### ADR-002 Express
Status: Accepted.
Why: known by the team, mature, huge middleware ecosystem, no learning cost during a 5-week build.
Rejected: Fastify (faster, built-in schema validation, but new to the team), NestJS (structure and TypeScript, heavy for this timeline).
Trade-off: Express enforces no structure, so the layering rules in the README carry that load. Express 5 is the current major version and handles rejected promises in async handlers, which removes the need for try/catch wrappers. Confirm the installed major version.

### ADR-003 PostgreSQL
Status: Accepted.
Why: the data is relational (users, opportunities, many-to-many career areas) and filter-heavy. Postgres gives constraints, partial and expression indexes, arrays, and full-text search later without a new system.
Rejected: MongoDB (flexible documents, but filtering and joins on categories are the core feature), MySQL (workable, fewer features used here).
Trade-off: schema changes need migrations and cross-team agreement, which is wanted here.

### ADR-004 Sequelize with migrations
Status: Accepted.
Version: Sequelize v6 with `sequelize-cli` v6, pinned by major version in `package.json`. v7 is not used. Verify the current stable line at install.
Why: the team already knows it, migrations are versioned, and the AWS and Data teams get a predictable `db:migrate` step. With `underscored: true` it maps camelCase attributes to snake_case columns (see ADR-008).
Rejected: Prisma (excellent developer experience and type safety, but a schema language and generated client to learn, and its engine adds deployment weight), Drizzle (SQL-like, TypeScript-first), Knex alone (no models).
Trade-off: Sequelize handles Postgres array-of-enum and expression indexes awkwardly (see ADR-013). Those cases use plain `TEXT[]` and raw SQL inside migrations. Revisit if the project continues beyond the MVP.

### ADR-005 Request validation with Zod
Status: Accepted.
Why: one schema both validates and cleans input, gives typed errors that map straight to the error envelope, and can be reused for the environment check. Schemas read allowed values from `taxonomy.json`, so values are not retyped.
Rejected: express-validator (familiar, chain-based, but verbose for nested bodies and harder to reuse), Joi (similar to Zod, older), hand-written checks.
Trade-off: a new library to learn. Pin the Zod major version at install, because v3 and v4 differ in API and error shape. If it ever has to be replaced, the validator files and the `validate` middleware are the only code that changes.

### ADR-006 Argon2id for password hashing
Status: Accepted. This changes the original technical plan, which named bcrypt.
Why: Cybersecurity allows Argon2id or bcrypt. Argon2id is memory-hard, which makes large-scale GPU cracking more expensive, and it is the first choice in current OWASP guidance. It also has no 72-byte input limit.
Rejected: bcrypt (simple and widely supported, but fixed memory use and the input limit), scrypt.
Settings: type `argon2id`, with memory cost, time cost and parallelism set through `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST` and `ARGON2_PARALLELISM`. A starting point from OWASP's published minimum is about 19 MiB of memory, 2 iterations and 1 degree of parallelism. Verify against current guidance and benchmark on the real instance size before fixing values.
Trade-off: the `argon2` package includes native code, so it must install cleanly in the AWS team's base image. Each hash uses real memory, so a burst of logins on a small container needs sizing. Passwords are capped at 128 characters so a huge input cannot be used to burn memory and time. The shared technical plan document still says bcrypt and needs the same update.

### ADR-007 JWT access token plus rotating refresh token
Status: Accepted.
Why: the web and mobile clients are stateless consumers, and Cybersecurity requires short access tokens with hashed, rotated, revocable refresh tokens. How refresh tokens are stored is in `security.md`.
Rejected: server-side sessions (simpler revocation, but harder for mobile and needs shared session storage), long-lived single JWT (cannot be revoked).
Trade-off: clients need refresh logic (documented in `auth.md`). Access tokens cannot be revoked before expiry except through the account status check on each request.

### ADR-008 Naming: camelCase in code and API, snake_case in database and CSV
Status: Accepted by the backend. Frontend and Mobile to confirm.
Options considered. Option A used snake_case in every layer, so database columns, JSON keys and CSV headers were identical. Option B uses camelCase in Node code and JSON, snake_case in the database and CSV, with Sequelize doing the mapping.
Decision: option B. API consumers in JavaScript get the naming they expect, and Postgres keeps its normal convention.
What actually prevents clashes is a single contract: the data dictionary defines fields and values, the API specification defines the JSON shape, and the schema document defines the database mapping. The data dictionary lists the CSV header, the API key and the column side by side.
Costs: Sequelize models set `underscored: true`. Migrations, raw SQL, `CHECK` constraints and expression indexes always use column names. The CSV importer maps headers to attributes. Enum values keep their data-dictionary form (for example `secondary_school`), and error codes stay upper case.

### ADR-009 Soft delete for opportunities
Status: Accepted.
Why: archived opportunities keep their audit history and links. `deleted_at` is checked in every catalogue query.
Trade-off: every query must remember the filter. The `publishable` scope handles it for students, with an explicit override for the admin view.

### ADR-010 Rule-based For You feed
Status: Accepted.
Why: no training data exists yet, and the scoring weights need tuning against real seeded opportunities. The scoring lives in one service function, so Data Science or AI can replace it later without changing the endpoint.
Trade-off: cruder relevance than a learned model.

### ADR-011 Logging with pino
Status: Proposed.
Why: structured JSON logs that CloudWatch can query, built-in field redaction for secrets, very low overhead, `pino-http` for request logs.
Rejected: winston (flexible, slower, redaction is manual), console logging.
Trade-off: raw logs are hard to read in development, so use `pino-pretty` locally only.

### ADR-012 Vitest and Supertest
Status: Proposed. Changed from Jest because of ADR-015.
Why: Supertest exercises the real Express app over HTTP without opening a port. Vitest runs ES modules natively, which matches ADR-015, and its API is close to Jest's, so the team's Jest knowledge carries over. Tests run against a separate test database with fake data.
Rejected: Jest (widely known, but ES module support still needs an experimental Node flag and extra configuration), Mocha plus Chai (more assembly).
Trade-off: slightly less common than Jest. Get one passing test running early, since the test setup is the likeliest place for ESM friction to appear.

### ADR-013 One machine-readable taxonomy, VARCHAR with CHECK in the database
Status: Proposed.
The agreed vocabulary (opportunity types, delivery formats, cost types, skill levels, education levels and career areas) lives in one file, `src/config/taxonomy.json`. Backend validation, the seeders, CSV validation and the `GET /api/v1/meta/taxonomy` response all read it, so nobody copies values between files. `docs/data-dictionary.md` documents the file and its meaning, and Data Analysts and Product own the decisions about what goes in it.
Why `VARCHAR` plus `CHECK` and not native Postgres enum types: the values will change early, removing or renaming a value in a native enum needs a rebuild, and Sequelize's array-of-enum support is poor. A `CHECK` constraint changes in an ordinary migration.
Constraint: a merged migration must never change meaning. Each migration that creates or alters a vocabulary `CHECK` copies the values it needs at the time it is written and does not read `taxonomy.json`. Adding a value therefore means editing `taxonomy.json` and adding a new migration. A test compares `taxonomy.json` with the constraints in a freshly migrated database, so a value added to one and not the other fails the build.
Trade-off: two places change together (the file and a migration), guarded by that test. Data Analysts do not edit JSON directly at first. They keep a shared sheet, and the backend team updates the file when a change is confirmed.

### ADR-014 Node.js 24 LTS
Status: Proposed.
Decision: Node.js 24.x LTS, pinned in three places so every developer, the pipeline and the container match: `.nvmrc` containing `24`, `engines` in `package.json` set to `>=24 <25`, and a `node:24` base image tag.
Why Node at all: the team knows it, Express and Sequelize run on it, and it fits a five-week build. This entry explains that choice. `.nvmrc` defines which version.
Why 24: the technical plan said Node 20 or newer, and Node 20 reached end of life in April 2026, so a new project should start on a supported LTS. Verify on nodejs.org that 24 is the active LTS before this moves to Accepted. If it is not, change the three pins together. Do not write "current LTS" anywhere in the repository.
Trade-off: upgrading to a new major version becomes a deliberate change with its own pull request.

### ADR-015 JavaScript with ES modules
Status: Accepted.
Decision: plain JavaScript with ES modules. `package.json` sets `"type": "module"` and application code uses `import` and `export`. The files that Sequelize's tooling loads with `require` stay CommonJS and use the `.cjs` extension: `.sequelizerc`, the CLI database config, and every migration and seeder.
Why JavaScript: team skill and a five-week window. Zod schemas and JSDoc give runtime and editor checks without a compile step.
Why ESM: it is the language standard and what current tooling and newer libraries target, so no later conversion is needed.
Rejected: CommonJS everywhere (simplest with the Sequelize CLI, but it ages badly and clashes with ESM-only packages), TypeScript (a compile step and a learning curve inside a short build).
Trade-off: two module styles in one repository. In ESM files, relative imports need file extensions (`./x.js`), JSON is imported with `with { type: 'json' }`, and the current directory is `import.meta.dirname`. CommonJS files cannot use `import`, so migrations stay self-contained and read nothing from the application, which matches the rule in ADR-013 that migrations copy their values. Verify at install that Sequelize 6 imports cleanly from ESM and that the CLI finds the `.cjs` files through `.sequelizerc`.

## Open decisions

| Decision | Owner |
|---|---|
| Final value lists and career areas in the data dictionary | Data Analysts, Product |
| How the taxonomy is updated (shared sheet first, backend edits `taxonomy.json` on confirmation, pull requests later) | Data Analysts, Product, Backend |
| Product decisions awaiting confirmation, including the deadline time zone (see `product-decisions.md`) | Product, Data Analysts |
| Public catalogue or login required to browse | Product, Frontend, Mobile |
| camelCase JSON (ADR-008) | Frontend, Mobile |
| Token transport (header or cookie) and exact lifetimes | Cybersecurity, Frontend, Mobile |
| Hosting target, first environment date, and secrets service (Secrets Manager or Parameter Store) | AWS |
| Argon2 settings on the real instance size | Backend, AWS |
| Confirm Node 24 is the active LTS | Backend |
| What happens to an admin's personal details if they must be erased (anonymise the row, never delete it) | Cybersecurity, Product |
| Split of work between the two backend developers | Backend |