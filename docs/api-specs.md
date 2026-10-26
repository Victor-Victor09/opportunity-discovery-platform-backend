# API Specification

Base path: `/api/v1`. Format: JSON. Status of this document: MVP draft, aligned with the Backend Technical Plan (WBS 1.4). The vocabulary behind every field and allowed value is defined in [`data-dictionary.md`](data-dictionary.md). Frontend and Mobile should not build against fields that are not listed here.

## Conventions

### Naming
`camelCase` for every JSON key and query parameter. The database and CSV files use `snake_case`, and the backend maps between them (ADR-008). Enum values (`secondary_school`, `all_levels`) are data, not keys, and keep the exact form in the data dictionary. Error `code` values are fixed upper-case strings. Identifiers are UUIDs, except `careerAreas[].id`, which is an integer.

### Versioning and roles
Additive response fields and new endpoints stay in `/v1`, so clients must ignore fields they do not recognise. A change that makes a request an existing client already sends invalid, such as a new required request field, is breaking. It needs a new version prefix (`/api/v2`) or a backwards-compatible migration plan. The Access column in the endpoint summary is the required role for each endpoint.

### Authentication
Protected routes expect `Authorization: Bearer <accessToken>`. The access token lives 15 to 30 minutes. The refresh token is sent in the request body to `/auth/refresh` and `/auth/logout`. Token transport for web (header or httpOnly cookie) is an open Cybersecurity decision, see `auth.md`.

### Success envelope

```json
{ "success": true, "data": {}, "message": "optional text" }
```

### Error envelope

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human readable text", "details": {} } }
```

`details` is optional. When present it is always an object, and it appears only when the client can act on structured extra information.

For `VALIDATION_ERROR` it holds the field-level issues: `{ "fields": [{ "field": "email", "issue": "must be a valid email" }] }`, where `field` uses the camelCase name from the request.

For `CONFLICT` it holds a `reason` and any conflict data. The reasons are `EMAIL_ALREADY_EXISTS` and `LIKELY_DUPLICATE_OPPORTUNITY`. A likely duplicate looks like this:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "A likely duplicate opportunity already exists.",
    "details": { "reason": "LIKELY_DUPLICATE_OPPORTUNITY", "matchingOpportunityIds": ["uuid"] }
  }
}
```

All other errors carry no `details`. Error messages never contain stack traces, SQL or internal paths.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body or query failed validation |
| 401 | `UNAUTHENTICATED` | Missing or malformed access token |
| 401 | `TOKEN_EXPIRED` | Access token expired. Client should call `/auth/refresh` once and retry |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password, or the account is locked or disabled (same message on purpose) |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh token unknown, expired or revoked. Client must send the user to login |
| 403 | `FORBIDDEN` | Valid token, wrong role |
| 404 | `NOT_FOUND` | Resource missing, archived, or not visible to this caller |
| 409 | `CONFLICT` | Duplicate email, or a likely duplicate opportunity that an admin has not confirmed. See `details.reason` |
| 429 | `RATE_LIMITED` | Too many requests. `Retry-After` header is set |
| 500 | `INTERNAL_ERROR` | Anything unexpected. Details stay in server logs |

### Pagination
List endpoints take `page` (default 1) and `limit` (default 20, maximum 50). Responses include:

```json
"meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
```

`meta` sits beside `data` inside the success envelope.

A `page` past the last page is not an error. It returns 200 with an empty `data` array and a valid `meta`. A `page` that is not a whole number of at least 1 returns `VALIDATION_ERROR`. A `limit` above 50 is capped to 50, and `meta.limit` shows the value actually used.

## Endpoint summary

Catalogue read endpoints are public unless Product, Frontend and Mobile decide otherwise. Rows marked "to confirm" depend on that decision.

| Method and path | Access | Purpose |
|---|---|---|
| POST `/auth/register` | Public | Create a student account |
| POST `/auth/login` | Public | Returns access and refresh tokens |
| POST `/auth/refresh` | Public, valid refresh token | Rotate tokens |
| POST `/auth/logout` | Student, admin | Revoke refresh token |
| POST `/auth/forgot-password` | Public | Send reset link (stretch goal, built last) |
| POST `/auth/reset-password` | Public | Set new password with token (stretch goal, built last) |
| GET `/me` | Student, admin | Current profile |
| PATCH `/me` | Student, admin | Update profile fields (onboarding) |
| DELETE `/me` | Student | Delete own account and personal data |
| PUT `/me/preferences` | Student | Save interests and preferences |
| GET `/career-areas` | Public | Reference list |
| GET `/opportunities` | Public (to confirm) | Catalogue with search and filters |
| GET `/opportunities/for-you` | Student | Personalised feed |
| GET `/opportunities/:id` | Public (to confirm) | Opportunity details |
| GET `/opportunities/:id/apply` | Public (to confirm) | Redirect to official application link |
| GET `/admin/opportunities` | Admin | All opportunities, any status |
| POST `/admin/opportunities` | Admin | Create an opportunity |
| PATCH `/admin/opportunities/:id` | Admin | Edit an opportunity |
| PATCH `/admin/opportunities/:id/review` | Admin | Record a review decision (verified, rejected or unverified) |
| DELETE `/admin/opportunities/:id` | Admin | Archive (soft delete) |
| GET `/meta/taxonomy` | Public | Allowed values for every vocabulary list (proposed addition). Full path `/api/v1/meta/taxonomy` |

Order matters in the router: `/opportunities/for-you` must be registered before `/opportunities/:id`.

Infrastructure routes `/health` and `/health/ready` are served at the root, outside `/api/v1`, so they never change with API versions. See the System section.

## Auth

### POST `/auth/register`
Body: `fullName` (2 to 100 chars), `email`, `password` (min 8, max 128, checked against a common-password list). Education level, institution and field of study are collected during onboarding through `PATCH /me`, not at registration.

201: `data.user` (`id`, `fullName`, `email`, `role`, `educationLevel`, null until onboarding) plus `data.accessToken` and `data.refreshToken` so the app can go straight to onboarding. 409 `CONFLICT` with `details.reason` of `EMAIL_ALREADY_EXISTS` if the email exists. Email is lowercased and trimmed before the check. The body is validated strictly: an unknown field, in particular `role`, is rejected with `VALIDATION_ERROR`. Email verification is a stretch goal built last (BD-002), so for now registration neither sends nor requires a verification email.

### POST `/auth/login`
Body: `email`, `password`. 200: `data.accessToken`, `data.refreshToken`, `data.expiresIn` (seconds), `data.user`. 401 `INVALID_CREDENTIALS` for every failure mode, including locked accounts. Rate limited per IP and per account.

### POST `/auth/refresh`
Body: `refreshToken`. 200: new `accessToken` and a new `refreshToken`. The old refresh token is revoked in the same transaction. Reusing a revoked token revokes every active token for that user.

### POST `/auth/logout`
Body: `refreshToken`. 200 with no data. Revokes that token. Idempotent.

### POST `/auth/forgot-password`
Stretch goal. It is built last and only if time permits. Until it lands, the route does not exist, so Frontend and Mobile should not depend on it.

Body: `email`. Always returns 200 with the same message, whether or not the email exists.

### POST `/auth/reset-password`
Stretch goal, same status. Body: `token`, `newPassword`. 200 on success, 400 `VALIDATION_ERROR` for an invalid or expired token. Revokes all refresh tokens for the user.

## Profile and preferences

### GET `/me`
200: the full profile. Fields that have no value are returned as `null`, never omitted.

```json
{
  "id": "uuid",
  "fullName": "Ada Okafor",
  "email": "ada@example.com",
  "role": "student",
  "educationLevel": "undergraduate",
  "institution": null,
  "fieldOfStudy": null,
  "preferences": { "preferredTypes": [], "preferredFormats": [], "freeOnly": false },
  "careerAreas": [{ "id": 1, "name": "Software Development", "slug": "software-development" }]
}
```

### PATCH `/me`
Partial update of profile fields: `fullName`, `educationLevel`, `institution`, `fieldOfStudy`. Email, role and password cannot be changed here, and unknown fields are rejected. 200 returns the updated profile in the same shape as `GET /me`. `educationLevel` must be a value from the taxonomy. Until it is set, the For You feed does not filter by education level.

### PUT `/me/preferences`
Replaces the whole preference set. Body:

```json
{
  "careerAreaIds": [1, 4],
  "preferredTypes": ["bootcamp", "internship"],
  "preferredFormats": ["remote", "hybrid"],
  "freeOnly": false
}
```

Values are validated against the taxonomy. 200 returns the saved set. Calling it again with the same body is safe. An empty array clears that selection: `careerAreaIds: []` removes every selected career area, `preferredTypes: []` and `preferredFormats: []` clear those preferences.

### DELETE `/me`
Deletes the profile, preferences, interests and refresh tokens. 204.

### GET `/career-areas`
200: `data` is an array of `{ id, name, slug }` ordered by name.

## Opportunities

Students only see opportunities that are approved for publication and have not expired (business rule BD-001 in `product-decisions.md`). The backend applies that rule in one place, so this document refers to it by name and does not repeat how "approved for publication" is currently decided.

### GET `/opportunities`

| Query parameter | Type | Meaning |
|---|---|---|
| `q` | string | Case-insensitive match on title and description |
| `type` | enum, repeatable | Opportunity type |
| `deliveryFormat` | enum, repeatable | `remote`, `onsite`, `hybrid` |
| `costType` | enum | `free`, `paid`, `scholarship_available` |
| `skillLevel` | enum | Includes opportunities marked `all_levels` |
| `location` | string | Match on the `location` field |
| `careerArea` | slug, repeatable | From `/career-areas` |
| `educationLevel` | enum | Opportunities open to this level or to all levels |
| `sort` | enum | `deadline` (default, soonest first), `newest` |
| `page`, `limit` | integer | Pagination |

Filters combine with AND. Repeating a parameter combines its values with OR.

Opportunity item shape (also used by `/for-you` and `/:id`):

```json
{
  "id": "uuid",
  "title": "Backend Bootcamp 2026",
  "providerName": "Example Academy",
  "description": "text",
  "type": "bootcamp",
  "deliveryFormat": "remote",
  "costType": "paid",
  "costAmount": "50000.00",
  "currency": "NGN",
  "skillLevel": "beginner",
  "location": null,
  "durationWeeks": 12,
  "startDate": "2026-11-15",
  "deadline": "2026-11-01",
  "eligibleEducationLevels": [],
  "careerAreas": [{ "id": 1, "name": "Software Development", "slug": "software-development" }],
  "isExpired": false,
  "verificationStatus": "verified",
  "reviewedAt": "2026-10-18T10:00:00Z",
  "sourceUrl": "https://...",
  "isFeatured": false
}
```

`costAmount` and `currency` are null for free opportunities, and `currency` is never assumed. `deadline` is null when an opportunity has no closing date. `isExpired` is calculated on every request and never stored. It is true when `deadline` is set and earlier than today in the Africa/Lagos time zone (to confirm with Product). A deadline stays valid through the end of that calendar day. Every use of `isExpired`, including the admin filter, follows these date semantics from BD-001 in `product-decisions.md`. Review state and time state are separate, so a verified opportunity can be expired and an unverified one can be current.

`applicationUrl` is not in list responses. It appears on `/:id`, and the supported way to apply is `/:id/apply`. Dates are ISO 8601 and timestamps are UTC.

### GET `/opportunities/for-you`
Student only. Same item shape plus `matchScore` (integer). Pagination applies. If the student has no preferences yet, returns publishable opportunities ordered by deadline with `matchScore: 0`.

### GET `/opportunities/:id`
200: item shape plus `applicationUrl`. 404 when the opportunity is not publishable and the caller is not an admin.

### GET `/opportunities/:id/apply`
302 redirect to `applicationUrl`. 404 if the opportunity is not visible. Exists so click tracking can be added later without a frontend change. It is the canonical redirect and tracking path, but not the only way to apply. Mobile can open the `applicationUrl` returned by the details endpoint deliberately instead of following a redirect.

## Admin

All admin routes require role `admin`. Every write inserts a row in `admin_actions`, including the fields that changed.

### POST `/admin/opportunities`
Body: all required fields (`title`, `providerName`, `description`, `type`, `deliveryFormat`, `costType`, `applicationUrl`, `sourceUrl`) plus any optional ones and `careerAreaIds`. Both URLs must be `https`. 201 with the created item (`verificationStatus: unverified`). The cost and deadline rules from the data dictionary are enforced, and a breach returns `VALIDATION_ERROR`. If a likely duplicate exists (same title, provider and start date, or the same `sourceUrl`), it returns 409 `CONFLICT` with `details.reason` of `LIKELY_DUPLICATE_OPPORTUNITY` and the matching ids in `details.matchingOpportunityIds`. The admin can resend with `confirmNotDuplicate: true` to create it anyway, and that override is recorded in `admin_actions`.

### PATCH `/admin/opportunities/:id`
Partial update, same validation. Cannot change `verificationStatus` (use `/review`).

### PATCH `/admin/opportunities/:id/review`
Body: `{ "verificationStatus": "unverified" | "verified" | "rejected" }`. Records the reviewer and the time, whether the decision is verified or rejected. Expiry is not a status. It is worked out from the deadline (see `isExpired` below).

### GET `/admin/opportunities`
Same filters as the catalogue plus `verificationStatus`, `isExpired` (boolean) and `includeArchived` (boolean). Returns every status. This is the verification queue.

### DELETE `/admin/opportunities/:id`
Archives the opportunity (soft delete). 204.

## System

Health routes need no authentication, are exempt from rate limiting, and never expose sensitive detail.

### GET `/health` (liveness)
200 `{ "success": true, "data": { "status": "ok" } }` while the process is running. It does not touch the database. The load balancer or container platform uses this route to decide whether to restart a container.

### GET `/health/ready` (readiness)
200 `{ "success": true, "data": { "status": "ok", "database": "up" } }` when the database answers a trivial query. 503 with `"database": "down"` otherwise. Used by release smoke tests, and by the load balancer only to hold back new traffic.

### GET `/meta/taxonomy` (proposed)
Full path `/api/v1/meta/taxonomy`. It is versioned like every other API route. Only `/health` and `/health/ready` sit outside `/api/v1`.

200: the vocabulary lists from `taxonomy.json`, keyed `opportunityTypes`, `deliveryFormats`, `costTypes`, `skillLevels`, `educationLevels` and `careerAreas`. Lets Frontend and Mobile build filters from the server's own lists, since they cannot import from the backend repository.