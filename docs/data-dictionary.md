# Data Dictionary

This file explains the platform's vocabulary: field names, what they mean, and which values are allowed. The values themselves live in one machine-readable file, `src/config/taxonomy.json`. Backend validation, the seeders, CSV checks and the `GET /api/v1/meta/taxonomy` response all read that file, so there is a single source of truth and nothing is copied between files. This document describes it for people.

Data Analysts and Product own the decisions about what the values are. The backend does not add, rename or remove a value on its own.

Status: draft. The starting lists below come from the filters in the MVP Features document. Data Analysts and Product should correct them.

## How the vocabulary is maintained

In the first weeks, Data Analysts and Product may keep their working copy in whichever format suits them, such as a shared sheet. When they confirm a change, the backend team updates `taxonomy.json` and adds a migration that updates the database `CHECK` constraint (ADR-013). Once the lists settle, changes can come through a pull request that Data or Product approves. A test compares `taxonomy.json` with the constraints in a freshly migrated database, so the two cannot drift apart without failing the build.

## Shape of taxonomy.json

```json
{
  "opportunityTypes": ["workshop", "internship", "bootcamp", "seminar", "training", "scholarship"],
  "deliveryFormats": ["remote", "onsite", "hybrid"],
  "costTypes": ["free", "paid", "scholarship_available"],
  "skillLevels": ["beginner", "intermediate", "advanced", "all_levels"],
  "educationLevels": ["secondary_school", "undergraduate", "fresh_graduate"],
  "careerAreas": [{ "name": "Software Development", "slug": "software-development" }]
}
```

`careerAreas` is the one structurally different list: every other list is plain strings, while each career area is an object with a name and a slug. In the database and API it also gets an integer id, which is assigned when it is seeded and is not part of the taxonomy file. Career areas are reference data rather than a simple enum-like list. If Data starts adding richer fields such as groups, descriptions, aliases, ordering or an active flag, move them out of `taxonomy.json` into a seeded table. Until then, one file is simpler.

## Opportunity fields

Each field has one meaning in four places. The CSV header and the database column are `snake_case`, the API key is `camelCase` (ADR-008).

| Field | CSV header | API key | Database column | Required | Meaning and format |
|---|---|---|---|---|---|
| Title | `title` | `title` | `title` | Yes | Up to 200 characters |
| Provider | `provider_name` | `providerName` | `provider_name` | Yes | Organisation running the opportunity, up to 150 characters |
| Description | `description` | `description` | `description` | Yes | Plain text |
| Type | `type` | `type` | `type` | Yes | One value from `opportunityTypes` |
| Delivery format | `delivery_format` | `deliveryFormat` | `delivery_format` | Yes | One value from `deliveryFormats` |
| Cost type | `cost_type` | `costType` | `cost_type` | Yes | One value from `costTypes` |
| Cost amount | `cost_amount` | `costAmount` | `cost_amount` | Depends on cost type | Number, no currency symbol. See the cost rules below |
| Currency | `currency` | `currency` | `currency` | When there is a cost amount | Three-letter ISO 4217 code. No silent default |
| Skill level | `skill_level` | `skillLevel` | `skill_level` | No | One value from `skillLevels`. If empty, `all_levels` is the proposed default (BD-007) |
| Location | `location` | `location` | `location` | No | City or region for onsite and hybrid opportunities |
| Duration | `duration_weeks` | `durationWeeks` | `duration_weeks` | No | Whole number of weeks, greater than 0. Weeks only for the MVP |
| Start date | `start_date` | `startDate` | `start_date` | No | `YYYY-MM-DD` |
| Deadline | `deadline` | `deadline` | `deadline` | No | `YYYY-MM-DD`, last day to apply. See the deadline rule below |
| Eligible education levels | `eligible_education_levels` | `eligibleEducationLevels` | `eligible_education_levels` | No | Values from `educationLevels`. Empty means open to everyone. Represented as a blank CSV cell and `[]` in the API. The database representation is defined in `db-schema.md` |
| Career areas | `career_areas` | see below | `opportunity_career_areas` (join table) | Yes, at least one | Slugs from `careerAreas` |
| Application link | `application_url` | `applicationUrl` | `application_url` | Yes | `https` link to the official application page |
| Source link | `source_url` | `sourceUrl` | `source_url` | Yes | `https` link to the official announcement or provider page |

### Career areas in each place

| Where | Representation |
|---|---|
| CSV import | Slugs joined with `\|`, for example `software-development\|data-analytics` |
| API request (admin create or update, student preferences) | `careerAreaIds`, an array of integers taken from `GET /api/v1/career-areas` |
| API response | `careerAreas`, an array of `{ "id": 1, "name": "Software Development", "slug": "software-development" }` |
| Database | Rows in `opportunity_career_areas` (opportunity id and career area id) |

### Cost and deadline rules

These are business rules, recorded as BD-007 in `product-decisions.md` and Proposed until Product and Data confirm them.

| Rule | Behaviour |
|---|---|
| `costType = free` | `costAmount` and `currency` must be empty |
| `costType = paid` | `costAmount` (greater than 0) and `currency` are required |
| `costType = scholarship_available` | `costAmount` is optional and, if given, is the standard fee before any scholarship. `currency` is required when `costAmount` is given |
| Currency default | None. Nothing assumes `NGN`. Product may approve a default explicitly |
| `skillLevel` empty | Stored as `all_levels`. This is a default chosen by the backend, so it is Proposed until Product and Data confirm it |
| `deadline` empty | The opportunity has no closing date (for example rolling applications). It stays publishable until an admin archives it, and `isExpired` is false |

Multi-value cells in the CSV are separated by `|`. Taxonomy values and slugs may only contain lowercase letters, digits, underscores and hyphens, so a value can never contain `|`. A test over `taxonomy.json` enforces this.

## Starting values

| List | Values | Status |
|---|---|---|
| Opportunity types | `workshop`, `internship`, `bootcamp`, `seminar`, `training`, `scholarship` | To confirm |
| Delivery formats | `remote`, `onsite`, `hybrid` | To confirm |
| Cost types | `free`, `paid`, `scholarship_available` | To confirm |
| Skill levels | `beginner`, `intermediate`, `advanced`, `all_levels` | To confirm |
| Education levels | `secondary_school`, `undergraduate`, `fresh_graduate` | To confirm |
| Career areas | Final list owned by Data Analysts. Each has a display name and a lowercase hyphenated slug | Needed from Data |

The type and format lists follow the MVP Features document (Workshop, Internship, Bootcamp, Seminar, Training and Remote, On-site, Hybrid). `scholarship` is added because the catalogue description lists scholarships. The education levels and cost types are the backend's starting guess.

## Proposed additions for Data and Product to accept or reject

| Value | List | Reason it might be needed |
|---|---|---|
| `conference`, `competition`, `fellowship` | Opportunity types | Appear in the EduTech field research (competitions) or are common categories |

Nothing in this table is in `taxonomy.json` until it is accepted.

## Open questions for Product and Data

These are domain decisions, not backend ones. Each stays open until Product and Data answer.

| Question | Why it matters |
|---|---|
| The MVP catalogue description mentions "business and tech opportunities". Should that be career areas, a separate category, or opportunity types? | It is a broad description, so it is not proposed as a taxonomy value |
| Should a remote opportunity always have an empty `location`, or may it carry an eligibility region such as "Nigeria only"? | It decides whether `location` means where it happens or who may apply, and whether a separate eligibility field is needed |
| What counts as the same opportunity? The backend flags a likely duplicate on title, provider and start date, or on the source link, and an admin decides | It decides whether duplicates can ever be rejected automatically with a unique rule |
| Is weeks the right unit for every duration? | Short events last hours or days. The MVP uses whole weeks only, and other units would need a new field |

## Backend-owned values

These are not content vocabulary, so Data and Product do not edit them.

| List | Values |
|---|---|
| Role | `student`, `admin` |
| Account status | `active`, `disabled`. A temporary login lock is derived from a timestamp, not a status |
| Verification status | `unverified`, `verified`, `rejected`. This is review state only. Expiry is worked out separately from the deadline. What each means for visibility is product decision BD-001 in `product-decisions.md` |

## CSV template

One header row, UTF-8, comma separated, quote any field that contains a comma:

```
title,provider_name,description,type,delivery_format,cost_type,cost_amount,currency,skill_level,location,duration_weeks,start_date,deadline,eligible_education_levels,career_areas,application_url,source_url
```

Rows with an unknown value, a non-`https` link, a missing required field or a breach of the cost rules are rejected and listed in an import report. Imported rows start as `unverified`.

## Change log

| Date | Change | Approved by | Reference (decision, ticket or PR) |
|---|---|---|---|
| | Initial draft from the MVP document and WBS | Pending | |