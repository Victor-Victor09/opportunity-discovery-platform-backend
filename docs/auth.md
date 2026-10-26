# Authentication and Authorization

The MVP uses email and password sign-in, Argon2id hashing, a short-lived JWT access token, a rotating refresh token, and two roles enforced on the server: `student` and `admin`.

## Registration

1. Validate the body (Zod schema in `validators/auth.validator.js`).
2. Lowercase and trim the email. Reject if it exists (409).
3. Check the password against a common-password list. Minimum length 8, maximum 128. No forced symbol or case rules.
4. Hash with Argon2id using the `ARGON2_*` settings (see below).
5. Insert the user with `role = student`. A user can never choose their own role, so the registration schema is strict and a `role` field in the body is rejected, not ignored. Admin accounts are created by seed script or by a database operation done by the team, never through a public endpoint.
6. Issue tokens and return the user without `password_hash`.

Email verification is a stretch goal built last (BD-002). Until it ships, the account is active as soon as it is created.

## Password hashing

Argon2id through the `argon2` package, with `type: argon2id` and memory cost, time cost and parallelism read from `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST` and `ARGON2_PARALLELISM`. The library generates a per-user salt and stores it with the parameters in one encoded string, which goes into `users.password_hash`. Parameters are benchmarked on the real instance size and fixed before launch (ADR-006). If the settings are raised later, `argon2.needsRehash` on a successful login lets the hash upgrade quietly. The dummy hash used for unknown emails must be generated with the same settings, so timing stays similar.

## Login

1. Look up the user by lowercased email.
2. If the user does not exist, verify the password against a fixed dummy Argon2id hash anyway, so response time does not reveal whether the email exists.
3. If `account_status` is `disabled`, or `locked_until` is in the future, respond `INVALID_CREDENTIALS`. If `locked_until` has passed, treat the lock as over and reset `failed_login_attempts` to 0 before going on.
4. Compare the password. On failure, increment `failed_login_attempts`. At 5 failures set `locked_until` to now plus 15 minutes. These numbers are proposals for Cybersecurity to confirm. Respond `INVALID_CREDENTIALS`.
5. On success reset `failed_login_attempts`, set `locked_until` to null, and issue tokens.

There are two separate pieces of state. `account_status` is the account lifecycle (`active` or `disabled`) and only an admin or a database operation changes it. A temporary lock is derived: an account is locked while `locked_until` is in the future, and nothing needs to be cleared when it passes.

Lockout is in addition to IP-based rate limiting (see `security.md`). Locked accounts return the same error as a wrong password on purpose. The cost is that a real student gets no hint about why login fails, so Frontend should keep the login error message generic and helpful. A "forgot password?" link belongs there only once password reset has shipped.

## Tokens

| Token | Format | Lifetime | Stored |
|---|---|---|---|
| Access | JWT, HS256, claims `sub` (user id), `role`, `iat`, `exp` | `JWT_EXPIRES_IN`, 15 to 30 minutes | Not stored |
| Refresh | 256-bit random string, base64url | `REFRESH_TOKEN_EXPIRES_IN`, 7 days proposed | SHA-256 hash in `refresh_tokens` |

The HS256 signing secret (`JWT_SECRET`) must be a randomly generated high-entropy value, never a phrase someone typed. See "Signing secret" in `security.md`.

Rules:

- The access token carries no personal data beyond the user id and role.
- `authenticate` verifies signature and expiry, then loads the user and rejects if `account_status` is not `active`. One indexed lookup per request is the price for being able to disable an account immediately instead of waiting up to 30 minutes.
- Refresh rotates: in one transaction, the presented token is marked revoked and a new one is inserted. Rotation must be atomic. When two requests present the same valid token at the same moment, only one may succeed and the other gets `INVALID_REFRESH_TOKEN`.
- Reuse detection: if a token that is already revoked is presented, revoke every active refresh token for that user and return `INVALID_REFRESH_TOKEN`. This limits the damage of a stolen token.
- The reuse rule is deliberately aggressive. It cannot tell a stolen token from a stale client that retries a token it already used or logged out with, so that user is signed out everywhere. That is accepted for the MVP. A later refinement is to record why and by what a token was revoked, so a rotated token being reused can be treated differently from a logged-out token being presented again.
- Logout revokes the presented token. Password reset and `DELETE /me` revoke all of them.

### Client behaviour (Frontend and Mobile)

On `401 TOKEN_EXPIRED`, call `/auth/refresh` once, replace both tokens, and retry the original request once. If refresh returns `INVALID_REFRESH_TOKEN`, clear stored tokens and go to login. Only one refresh call should be in flight at a time, so concurrent requests must wait for it.

### Open decision: token transport

Mobile stores tokens in secure device storage and sends the header. Web can send the header too, which is simple but exposes tokens to injected scripts, or use an httpOnly cookie for the refresh token, which needs CORS credentials and CSRF thought. Until Cybersecurity decides, the API uses the header for access tokens and the request body for refresh tokens, and token creation and parsing are kept separate from transport handling so the decision does not touch authentication logic. Switching the refresh token to a cookie would still change controller code, cookie settings, CORS credentials, CSRF handling and the Frontend, so it is a deliberate change and not a one-file swap.

## Password reset (stretch goal, built last)

This is the last item in the backend build order and is only done if time permits. Until it ships, the two routes are not registered, and forgotten-password recovery is unavailable through the product and must follow an agreed support process. Admins never ask for, view, or manually set a user's password.

1. `forgot-password` always returns the same 200 response.
2. If the email exists, generate a 256-bit random token, store its SHA-256 in `reset_token_hash`, set `reset_token_expires_at` to now plus 15 to 30 minutes, and email a link containing the raw token to the registered address.
3. `reset-password` hashes the presented token, matches an unexpired row, sets the new password hash, nulls both reset columns (single use), revokes refresh tokens, and clears any lock.

The two reset columns on `users` allow one active reset token per user, which is enough for this stretch goal. If reset attempts ever need an audit trail or several live tokens, move them to a separate `password_reset_tokens` table then, and not before.

This needs an email provider. Amazon SES fits the AWS plan. The AWS team only needs to set it up if this work is picked up.

## Authorization

Two middleware functions, applied in the route file so access rules are visible next to the URL:

```js
router.get('/me', authenticate, meController.getMe);
router.use('/admin', authenticate, requireRole('admin'));
```

`requireRole` reads the role from the loaded user, not from the token claim, so a demoted admin loses access at once.

Ownership: student endpoints take the user id from the token, never from a URL or body. `/me` and `/me/preferences` therefore cannot be pointed at another student.

Public routes are an explicit allowlist. Anything not on it requires authentication. Paths are relative to `/api/v1`, except the two health routes, which sit at the root:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password` and `POST /auth/reset-password` (only once built)
- `GET /career-areas`
- `GET /meta/taxonomy`
- `GET /health` and `GET /health/ready`
- The catalogue read routes under `/opportunities`, unless the team decides otherwise

A new route is protected by default and only joins this list by a deliberate change here.

### Invariants that become tests

- A `role` field sent to `POST /auth/register` is rejected with `VALIDATION_ERROR`. Role assignment is server-controlled.
- Student endpoints take the user id from the token. A user id in a URL or body is never used to choose whose data is read or written.
- A disabled account is refused on its next request, even with an unexpired access token.
- A student calling any `/admin` route gets `FORBIDDEN`.

## Admin accounts

Created outside the public API. Stronger rules proposed by Cybersecurity: multi-factor authentication and an audit log of every action. The audit log (`admin_actions`) is in the MVP. Multi-factor authentication for admin accounts is built only if time allows. If it is not implemented before launch, it remains an unmet Cybersecurity requirement. Long unique passwords and a small admin list reduce the risk but do not replace it, and `security.md` records it as a known gap.