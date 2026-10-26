# Opportunity Discovery Platform: Backend

> Working title. The product name is not final, so nothing in this repository should hard-code it.

This README has two layers. Read the first section if you want to understand what the backend does. Read the second if you need to run it, call it, or change it. Every deeper document in `docs/` is fully technical.

---

## Part 1: Backend Overview

### What the backend is for

Students miss out on bootcamps, internships, scholarships, seminars and workshops because the information is scattered. The platform puts opportunities from official sources in one place. The backend is the part that stores them, remembers each student's interests, decides which opportunities to show, and makes sure only the right people can change anything.

It does not draw screens. The web frontend and the mobile app both ask the backend for information through the same set of requests (an API), so both always see the same data.

### What a student journey looks like from the backend's side

1. A student creates an account. The backend validates the details, securely hashes the password, and creates the account.
2. The student picks interests, preferred opportunity types and formats. The backend saves these against their account only.
3. The student browses or searches. The backend returns only opportunities that are approved for publication and have not expired. That rule is a product decision, recorded as BD-001 in [`docs/product-decisions.md`](docs/product-decisions.md).
4. The "For You" feed ranks those listings using the student's saved interests, using simple scoring rules.
5. The student opens a listing and presses apply. The backend sends them to the official application page. The backend never takes applications itself.

### What the backend owns, and what it does not

The backend owns:

- Accounts, login, sessions and roles
- The stored opportunity data and its verification status
- Search, filters and the For You ranking
- Rules about who may read or change what
- The audit trail of admin changes

The backend does not own:

| Area | Owner |
|---|---|
| Screens, layout and visual design | Product Design, Frontend, Mobile |
| Opportunity sourcing, classification and content-quality decisions | Data, Product and authorized admins |
| The vocabulary of types, formats, levels and career areas | Data Analysts and Product (see the data dictionary) |
| Hosting, networks and deployment pipelines | AWS |
| Security policy and review | Cybersecurity |
| Marketing pages and campaigns | Digital Marketing |

### Where other teams plug in

| Team | What they need from the backend | Where it is written down |
|---|---|---|
| Frontend and Mobile | A stable list of requests and responses, and the rule for refreshing an expired login | `docs/api-spec.md`, `docs/auth.md` |
| Data Analysts | The exact fields and allowed values for an opportunity, and the CSV template for the first dataset | `docs/data-dictionary.md`, `docs/db-schema.md` |
| AWS | What the app needs to run: runtime, database, settings, health check, logs | `docs/deployment.md` |
| Cybersecurity | How each of their requirements is implemented, and what is still open | `docs/security.md` |
| Product Management | Scope, what is deferred, open decisions | Part 1 here, `docs/product-decisions.md` |
| Data Science and AI | MVP ranking is rule-based. A smarter model can replace the scoring step later without changing any request | `docs/architecture-decisions.md` (ADR-010) |

### MVP scope

Included: registration and login, interests and preferences, the opportunity catalogue, search and filters, listing details, official application links, the For You feed, and admin verification of listings.

Deferred: email verification and password reset (both built last, only if time permits), the provider portal, advanced notifications, automated scam detection, advanced recommendations, click tracking and the admin dashboard interface (the backend only supplies the admin requests that dashboard will call). Each deferral is recorded in [`docs/product-decisions.md`](docs/product-decisions.md).

### Constraints worth knowing

- Build time is short, so the backend is one application and one database rather than many small services.
- Students' personal data is covered by Nigerian data protection law, so the backend collects as little as it can.
- Fee payments are out of scope. The backend never stores card or bank details.

---

## Part 2: Technical Overview

### Stack

| Concern | Choice | Status |
|---|---|---|
| Runtime | Node.js 24 LTS, pinned by `.nvmrc` | Proposed (ADR-014) |
| Framework | Express | Accepted (ADR-002) |
| Database | PostgreSQL 15+ | Accepted (ADR-003) |
| Data access | Sequelize 6 with migrations | Accepted (ADR-004) |
| Language and modules | JavaScript with ES modules (Sequelize CLI files stay CommonJS) | Accepted (ADR-015) |
| Validation | Zod | Accepted (ADR-005) |
| Passwords | Argon2id | Accepted (ADR-006) |
| Sessions | Short-lived JWT access tokens plus rotated, revocable refresh tokens | Accepted (ADR-007) |
| Logging | pino | Proposed (ADR-011) |
| Tests | Vitest and Supertest | Proposed (ADR-012) |

Each choice has its reasoning, alternatives and trade-offs in [`docs/architecture-decisions.md`](docs/architecture-decisions.md).

### Architecture in one paragraph

A modular monolith. A request enters through a route, passes middleware (authentication, role check, validation, rate limiting), reaches a controller that reads the request, which calls a service that holds the logic, which uses Sequelize models to read or write PostgreSQL. Controllers never touch models directly, and services never touch `req` or `res`. That separation is what lets the For You scoring or a future provider module change without rewriting routes.

### Project structure

```
src/
  config/        environment loading, database connection, taxonomy.json (the agreed vocabulary)
  constants/     roles and statuses owned by the backend
  models/        Sequelize models and associations
  migrations/    one migration per schema change (CommonJS, .cjs)
  routes/        URL definitions only
  controllers/   read request, call a service, send response
  services/      auth, opportunities, for-you scoring, verification
  middleware/    authenticate, requireRole, validate, rateLimit, errorHandler
  validators/    Zod schemas, one file per resource
  utils/         small shared helpers
  app.js         builds the Express app
  server.js      starts the server
seeders/         career area seeder (CommonJS, .cjs)
scripts/         opportunity CSV import (ES module)
tests/           unit and integration tests
docs/            technical documentation
```

### Conventions that prevent cross-team clashes

- Naming: `camelCase` in Node code, JSON keys and query parameters. `snake_case` in database columns and CSV headers. Sequelize maps between them (`underscored: true`). The contract that keeps teams aligned is the chain data dictionary, then API specification, then database mapping (ADR-008).
- The agreed vocabulary of allowed values (opportunity types, formats, levels, career areas) lives in one machine-readable file, `src/config/taxonomy.json`. Validation, seeders, CSV checks and `GET /api/v1/meta/taxonomy` all read it, and [`docs/data-dictionary.md`](docs/data-dictionary.md) documents it. Data and Product own what the values are. Nobody retypes a list or adds a value in code first.
- Every response uses one envelope (see the API spec). Every error carries a stable `code` that Frontend and Mobile can branch on.
- Schema changes happen only through migrations. Never edit a migration that has been merged.

### API

Base path: `/api/v1`.

Every request and response contract is defined in [`docs/api-spec.md`](docs/api-spec.md), including the required role for each endpoint. Catalogue read endpoints are public unless the team decides otherwise. Protected endpoints require a bearer access token.

Do not build Frontend or Mobile behaviour against fields that are not in the API specification. Additive changes stay in `/v1`, and breaking changes get a new version.

Health checks (`/health` and `/health/ready`) are described in the [deployment guide](docs/deployment.md#health-checks).

### Local setup

Prerequisites: Node.js 24 LTS (the version is pinned in `.nvmrc`), PostgreSQL 15 or newer, Git.

```bash
git clone <repository-url>
cd backend
nvm use                     # reads .nvmrc
npm install
cp .env.example .env        # then fill in the values
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npm run seed                # career areas, then the opportunity CSV if provided
npm run dev
```

Environment variables (never commit `.env`):

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, `staging` or `production` |
| `PORT` | Port the app listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL` | `true` when the managed database requires SSL |
| `JWT_SECRET` | Secret used to sign access tokens |
| `JWT_EXPIRES_IN` | Access token lifetime, for example `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime, for example `7d` |
| `ARGON2_MEMORY_COST` | Argon2id memory in KiB (see ADR-006) |
| `ARGON2_TIME_COST` | Argon2id iterations |
| `ARGON2_PARALLELISM` | Argon2id parallelism |
| `CLIENT_URL` | Comma-separated list of allowed frontend origins (CORS) |
| `LOG_LEVEL` | `info` by default |

`.env` is for local development only. In staging and production, secrets come from AWS Secrets Manager or Parameter Store and are injected by the platform. Nobody edits a `.env` file on a server.

Development and test databases use fake data only. Real student records never leave production.

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Starts the server (used in deployment) |
| `npm run dev` | Starts with automatic reload |
| `npm test` | Runs the test suite |
| `npx sequelize-cli db:migrate` | Applies pending migrations |
| `npm run seed` | Loads reference data and the opportunity CSV |

### Branching and reviews

Feature branches off `main`, merged through pull requests with one reviewer. Security-sensitive code (authentication, permissions) is also reviewed by Cybersecurity. Migrations are written by the author of the model change and must not be edited after merge.

---

## Detailed Technical Documentation

| Document | Contents |
|---|---|
| [API Specification](docs/api-spec.md) | Conventions, envelope, error codes, every endpoint |
| [Data Dictionary](docs/data-dictionary.md) | Agreed vocabulary, allowed values, CSV template |
| [Database Schema](docs/db-schema.md) | Tables, columns, enums, indexes, relationships |
| [Authentication](docs/auth.md) | Registration, login, tokens, lockout, password reset, roles |
| [Security](docs/security.md) | Cybersecurity requirements mapped to implementation |
| [Deployment](docs/deployment.md) | What the environment must provide, pipeline, health check |
| [Product Decisions](docs/product-decisions.md) | Student visibility rule, scope and deferrals, with owners |
| [Architecture Decisions](docs/architecture-decisions.md) | Why each tool and pattern was chosen |

## Open decisions

Technical decisions are listed with owners at the bottom of [`docs/architecture-decisions.md`](docs/architecture-decisions.md). Product decisions are in [`docs/product-decisions.md`](docs/product-decisions.md).