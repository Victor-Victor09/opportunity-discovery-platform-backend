# Product Decisions

This file records decisions about what the product does, who can see what, and what is in or out of scope. They shape the backend, so the backend team keeps the record, but the owners are Product and Data. Technical choices live in [`architecture-decisions.md`](architecture-decisions.md).

Status values: Proposed, Accepted, Superseded, Rejected. A superseded decision stays here with a pointer to its replacement.

A decision becomes Accepted only when its named owner has confirmed it. Backend implementation does not treat a Proposed decision as final. Where the backend has to build before an answer arrives, the decision is marked "working assumption", which means the backend builds on it and expects to change it cheaply if the owner decides otherwise.

## BD-001 What students can see

Status: Proposed, working assumption. Owners: Product, Data Analysts.

Students browse opportunities that are approved for publication and have not expired.

Today, "approved for publication" means an admin has set the verification status to `verified` and the opportunity is not archived. "Not expired" is worked out from the deadline alone and is not a status: the deadline is empty or has not passed, counted in the Africa/Lagos time zone (to confirm). A deadline of 2026-11-01 stays valid through the end of 2026-11-01 in Lagos.

The backend applies the rule in one place, a Sequelize scope named `publishable`. The catalogue, search, the For You feed, the details page and the apply redirect all use it. No route or query writes its own version.

The rule is kept separate from the status name on purpose. Product may later decide, for example, that unverified opportunities appear with a warning label, or that a new status is added. Only the scope's definition changes, and the API and clients keep working.

## BD-002 Email verification is built last

Status: Proposed, working assumption. Owners: Product Manager, Backend. Backend recommends the deferral and Product accepts the consequence.

Email verification is a stretch goal, built last and only if time permits. Until it ships, registration creates a working account immediately, and anyone can register with an email they do not own. That is a product and security risk that Product must accept for the MVP, and it is listed as a known gap in `security.md`.

## BD-003 Password reset is built last

Status: Proposed, working assumption. Owners: Product Manager, Backend. Backend recommends the deferral and Product accepts the consequence.

Password reset is a stretch goal, built last and only if time permits. Until it ships, forgotten-password recovery is unavailable through the product and must follow an agreed support process. Admins never ask for, view, or manually set a user's password. It shares the email provider with BD-002.

## BD-004 MVP scope

Status: Proposed, working assumption. Owner: Product Manager.

The MVP journey follows the WBS: register, set preferences, discover, search and filter, view details, apply through the official source.

Included: registration and login, interests and preferences, the opportunity catalogue, search and filters, opportunity details, official application links, the For You feed, and admin verification of opportunities.

Deferred: email verification (BD-002), password reset (BD-003), the provider portal (BD-005), notifications and reminders (BD-006), automated scam detection, advanced recommendations, click tracking, and the admin dashboard interface (the backend only supplies the admin requests that dashboard will call).

This is the umbrella decision. BD-002, BD-003, BD-005 and BD-006 are its individual deferrals. They become Accepted together when the Product Manager accepts this decision, or one by one if the Product Manager prefers to decide them separately.

Why: a five-week build. The deferrals came from the shared technical plan, and several of them (the provider portal and notifications) appear in the original MVP feature document, so the Product Manager needs to confirm they are agreed scope changes.

## BD-005 Provider portal is deferred

Status: Proposed, working assumption. Owner: Product Manager.

The original MVP Features document lists provider onboarding and a provider portal where organisations submit opportunities. The MVP build does not include it. Admins create and verify every opportunity, and the `role` list gains `provider` later. The current schema already records who created and changed each opportunity, which gives a useful starting point for adding provider ownership later, though provider organisation records, user membership, provider verification and provider-specific permissions may still be needed.

## BD-006 Notifications and deadline reminders are deferred

Status: Proposed, working assumption. Owner: Product Manager.

The original MVP Features document lists push notifications and reminders about approaching deadlines or new opportunities. The MVP build does not include them. Product should confirm whether any basic reminder is needed for the demo, because it would need an email or push provider that nobody has planned yet.

## BD-007 Cost, deadline and default-value rules

Status: Proposed, working assumption. Owners: Product, Data Analysts.

A free opportunity has no cost amount and no currency. A paid opportunity needs an amount above zero and a currency. For `scholarship_available`, the amount is optional and means the standard fee before any scholarship. Nothing assumes a currency, and a default such as NGN needs explicit approval. An empty deadline means the opportunity has no closing date, so it stays visible until an admin archives it and is never counted as expired. An empty skill level is stored as `all_levels`, which is also a default the backend chose and Product should confirm.

These rules are enforced by validation and by database `CHECK` constraints, and the CSV import rejects rows that break them. The field-level detail is in `data-dictionary.md`.