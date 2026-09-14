# E2E Assumptions & Unknowns

Things that cannot be determined from the code alone. Each is tagged inline in
the harness as `// ASSUMPTION:` at the point it matters. Where an assumption is
load-bearing, the harness self-provisions rather than depending on it.

## A1 — No pre-seeded authenticatable tenant
`db/seeds/20260530_marbella.ts` creates a `sample-project` and child records but
**no users, org membership, or credentials**. There is therefore no guaranteed
test login from seeds.
**Decision**: the harness **self-provisions** each role via the Better Auth
sign-up API at global-setup time, creates an org + project through the API, and
tears its own data down. It does not depend on any pre-existing tenant.
`// ASSUMPTION:` in `global-setup.ts`.

## A2 — Credentials & base URLs come from env
Per the brief and `config/index.ts`, nothing is hardcoded.
**Decision**: `config/env.ts` reads `E2E_BASE_URL` (default `http://localhost:5173`)
and `E2E_API_URL` (default `http://localhost:3000`). Role passwords default to a
strong constant overridable via `E2E_PASSWORD`. CI overrides all three.
`// ASSUMPTION:` in `config/env.ts`.

## A3 — Servers must be running
Playwright `webServer` can boot the app, but this monorepo needs **both** backend
(`:3000`) and frontend (`:5173`) plus a migrated Postgres.
**Decision**: `webServer` is configured to run `pnpm dev` from the repo root and
wait on `:5173`; it is **disabled when `E2E_NO_WEBSERVER=1`** (CI brings its own
services / already-running dev). Locally, if servers are already up, Playwright
reuses them (`reuseExistingServer: true`).
`// ASSUMPTION:` in `playwright.config.ts`.

## A4 — Email verification may gate sign-in
The app has an email-verification flow (`/auth/verify-email`) and CEO/welcome
emails fire `afterEmailVerification`. Whether a freshly signed-up user can act
without verifying depends on Better Auth config (`requireEmailVerification`).
**Decision**: global-setup signs up, then verifies the user **directly via Knex**
(set `user.email_verified = true`) using the same DB connection the app uses, so
the session is fully privileged. If the project later flips
`requireEmailVerification` on, this keeps tests green without email plumbing.
`// ASSUMPTION:` in `fixtures/auth.ts`.

## A5 — Org auto-creation on sign-up
Whether signing up auto-creates an organization (and makes the user its `owner`)
is a Better Auth org-plugin setting not fully visible from the route layer.
**Decision**: after sign-up, the harness **ensures** an active org exists for the
user (creates one via the org API if absent) and sets it active, so
`request.activeOrganizationId` is populated for project creation.
`// ASSUMPTION:` in `fixtures/seed.ts`.

## A6 — Exact viewer/member capability boundaries
`constructionFull` (owner/admin) vs `constructionContributor` (member) vs viewer
presets declare capabilities, but the precise per-endpoint enforcement (e.g. can
a `member` delete an RFI?) is only knowable by exercising each endpoint.
**Decision**: role specs assert the boundary the **code declares**; where the UI
exposes an action the role shouldn't have, that is logged as a product defect and
the test fails by design (guardrail assertion), never patched in test code.

## A7 — Third-party integrations to stub
Maps/geocoding, payments, email, weather, and any external AI calls are
non-deterministic. Exact providers are inferred from imports.
**Decision**: specs route-intercept these at the network layer (`page.route`) and
return deterministic fixtures. The clock is frozen where dates drive logic
(`page.clock`). The list of intercepted hosts lives in `fixtures/stubs.ts` and is
extended as modules are covered.
`// ASSUMPTION:` in `fixtures/stubs.ts`.

## A8 — `data-testid` availability
Selector priority is role > label > testid > text. Where no stable role/label
exists, the spec uses `data-testid` **and flags it** with a `// TESTID-NEEDED:`
comment so the app team can add a role/label. No silent text-coupling to copy.
