# Security

This maps the Cybersecurity team's Week 2 requirements to what the backend implements. Status values: Planned, In progress, Done, Needs decision (we have not decided), Blocked (we know what to do but another team must provide something). Update this table as work lands, and Cybersecurity signs off against it.

## Requirement mapping

| Task | Requirement | Backend implementation | Status |
|---|---|---|---|
| 2.1.1 Setup | Secrets out of code and Git, HTTPS only, dependency scanning, separate environments | `.env` ignored, `.env.example` committed with no real values, production secrets injected at runtime from AWS Secrets Manager or Parameter Store and never a hand-edited `.env` on a server, config read only in `src/config`, Dependabot or `npm audit` in CI, gitleaks secret scan on every push, separate configuration and credentials per environment, with `.env` files used only for local development | Planned |
| 2.1.2 Database | Private, encrypted, least privilege, backups | Provided by AWS. Backend uses a dedicated DB user with only the rights the app needs. Migrations run under a separate migration user. Privileges for each are in `deployment.md` | Blocked (AWS) |
| 2.1.3 User model | Strong hashes, minimal data, unique email, account status | Argon2id, only name, email, education level, institution, field of study. Unique index on email. `account_status` column | Planned |
| 2.1.4 Opportunity model | Validate fields, admin-only writes, record who changed, sanitise links and text | Zod on every field, `requireRole('admin')`, `created_by`, `updated_by`, `reviewed_by`, `admin_actions`, https-only URL validation, listing text stored and returned as plain text, never as HTML | Planned |
| 2.1.5 Authentication | Short tokens with refresh, rate limit and lockout, secure reset, roles, admin MFA | See `auth.md`. Everything except admin MFA and secure reset is planned. Admin MFA and reset are stretch goals | Planned, with admin MFA and reset as Needs decision |
| 2.1.6 Preferences | Own data only, validated values | User id from token, allowed values from `taxonomy.json` | Planned |
| 2.1.7 Opportunity APIs | Auth on writes, validation, rate limit, pagination caps, safe errors, request logging | `limit` capped at 50, central `errorHandler`, pino-http request logs | Planned |

## Input validation

Every body, query string and route parameter is validated by a Zod schema in the `validate` middleware before it reaches a controller. Unknown fields are stripped, not passed on, except on registration, where the schema is strict and any unknown field (in particular `role`) is rejected with `VALIDATION_ERROR`. Types, lengths and formats are enforced. IDs are checked as UUIDs before any query. Request body size is capped at 100 KB with `express.json({ limit: '100kb' })`.

URL fields (`applicationUrl`, `sourceUrl`) must parse with the `URL` constructor, use the `https:` scheme, have no credentials in them, and be under 2048 characters. A malicious link on a listing is the main abuse risk in the MVP, so the official source and application URLs must be manually verified before an opportunity is marked verified.

Listing text is treated as untrusted plain text. The API stores it as plain text, never intentionally returns executable HTML, and does not entity-encode it. Clients must render listing content with safe text rendering and never through raw HTML insertion. The CSV importer runs the same Zod schemas as the admin endpoints, so imported rows obey the same rules.

## Database access

Sequelize with parameterised queries only. No raw SQL built from user input. The two places raw SQL appears (the expression-index and `CHECK` constraint migrations and, if added later, full-text search) contain no interpolated user values. `ILIKE` search terms have `%`, `_` and `\` escaped before use.

## Refresh token storage

Refresh tokens are 256-bit random values. The raw value is returned to the client once and never stored or logged. The database keeps only its SHA-256 hash in `refresh_tokens.token_hash`, with `user_id`, `expires_at` and `revoked_at`, one row per issued token. A fast hash is enough here because the token is long and random, unlike a password.

On every refresh, the presented token is looked up by hash, checked for expiry and revocation, marked revoked, and replaced by a new row, all in one transaction. If a token that is already revoked is presented again, every active token for that user is revoked and the client must log in again. Logout revokes the presented token. Password reset and account deletion revoke all of a user's tokens, and so would a password-change endpoint if one is added. Expired rows are removed by a scheduled clean-up after the MVP. A leaked database dump therefore contains no usable refresh tokens.

## Signing secret

`JWT_SECRET` is generated with a cryptographically secure random generator, at least 32 random bytes, for example `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. It is never a typed phrase, never shared between environments, and never committed. It is stored and rotated through the secrets service described in `deployment.md`. Rotating it invalidates every access token. Clients receive `UNAUTHENTICATED`, which they treat as a login prompt, so users sign in again. Refresh tokens are random values and are not affected. To avoid forcing everyone out, the API can accept the previous secret for one access-token lifetime during a rotation. The incident note says when to rotate.

## Rate limiting

`express-rate-limit`, per IP, with a shared store later if the app runs on more than one instance (in-memory counters are per instance).

| Route group | Proposed limit |
|---|---|
| `/auth/login` | 10 per 15 minutes per IP, plus the per-account lockout |
| `/auth/register` | 5 per hour per IP |
| `/auth/forgot-password`, `/auth/reset-password` | 5 per hour per IP |
| Everything else | 100 per minute per IP (health routes exempt) |

Students on a shared university network can appear to come from one public IP, so these per-IP numbers are proposals that must be tested against real usage before launch, including the demo.

When the app sits behind the AWS load balancer, set `app.set('trust proxy', 1)` so the limiter sees client IPs and not the balancer's. Confirm the hop count with the AWS team.

## HTTP hardening

`helmet` defaults. CORS allows only origins listed in `CLIENT_URL`. HTTP is redirected to HTTPS at the load balancer. Responses never reveal `X-Powered-By` (helmet removes it).

## Errors and logging

The central `errorHandler` maps known errors to the envelope in `api-spec.md` and turns anything else into `INTERNAL_ERROR`, with the full error in internal logs only.

Logged: logins, failed logins, lockouts, permission failures, token reuse detection, admin actions, and request metadata. Logs identify people by user id and never by email address, because email is personal data. pino redaction removes `authorization`, `password`, `newPassword`, `accessToken`, `refreshToken`, `token` and `cookie` fields from every log line. Full user records are never logged. Logs are retained for at least 90 days on the AWS side.

Alerting thresholds, proposed for Cybersecurity and AWS to confirm so that sign-off can be tested: 20 failed logins from one IP in 5 minutes, 10 accounts locked from one IP in 15 minutes, and any refresh-token reuse detection event. The destination (email, Slack or a CloudWatch alarm) is provided by AWS.

## Personal data and privacy

Collected: full name, email, education level, institution, field of study, interests and preferences. Not collected: matric numbers, phone numbers, payment details. Fee payments are out of scope, so no card or bank data is ever stored.

`DELETE /me` removes the profile, preferences, interests and tokens. Data export is not currently planned for the MVP. If it is not implemented before launch, it remains an unmet privacy requirement, because the Cybersecurity document asks for a way to delete or export a user's data. Cybersecurity, Product and legal must explicitly accept or close that gap. The platform should follow the Nigeria Data Protection Act 2023. Legal or the university's data officer needs to confirm the consent notice, retention period and deletion duties before launch, and the backend will add whatever consent field they require.

## Environments and test data

Separate development, test, staging and production databases. Non-production databases hold fake data only. Seed data must not be copied from production.

## Secure development

Pull request review by a second developer, plus Cybersecurity for authentication and permission code. Dependency and secret scanning on every commit. Before each release, Cybersecurity tests login, permissions and the opportunity APIs for broken access control, injection and weak sessions. Dependencies reviewed monthly. Proposed scanner policy: a critical or high finding in a production dependency fails CI, while moderate and low findings are reviewed monthly. Any accepted exception is recorded with a reason and a review date. A short incident note (who to contact, how to lock accounts, how to rotate secrets) lives with the deployment docs.

## Week 2 sign-off checklist

- [ ] Secrets are outside the code and Git history
- [ ] Database is private, encrypted and uses least-privilege accounts
- [ ] Passwords are hashed with Argon2id
- [ ] Login has rate limiting, lockout and token expiry
- [ ] Student and admin roles are enforced on the server
- [ ] All input is validated and queries are parameterised
- [ ] Opportunity write endpoints require admin access
- [ ] HTTPS only, and CORS limited to platform domains
- [ ] Dependency and secret scanning are running
- [ ] Logging and failed-login alerts are on
- [ ] AWS accounts use multi-factor authentication and least-privilege roles

## Known gaps to raise with Cybersecurity

Argon2id is used for password hashing (ADR-006), which differs from the bcrypt wording in the original plan, so the plan document needs the same update. Until email verification is built (a stretch goal, built last, BD-002), anyone can register with an email they do not own. Password reset is a stretch goal built last, so until it exists, recovery for a forgetful student is unavailable through the product and needs an agreed support process in which admins never ask for, view, or set a password. Multi-factor authentication for admins is an unmet Cybersecurity requirement if it is not built before launch. Long unique passwords and a small admin list reduce the risk but do not replace it, and admin MFA stays in the table as Needs decision until someone accepts or closes it. Data export is not planned for the MVP and remains an unmet privacy requirement if it stays that way. Registration reveals whether an email already has an account, through the duplicate-email response, which is a common trade-off and is more visible without email verification. The access token is not revocable before expiry beyond the per-request account status check. Failed-login alerting needs a destination (email, Slack, CloudWatch alarm) that the AWS team has to provide.