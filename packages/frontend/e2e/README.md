# BuildPanda E2E (Playwright)

End-to-end suite for the BuildPanda SPA. Self-provisioning, deterministic,
per-role isolated. Seeds and tears down through the Fastify API (and a thin DB
hook only to satisfy Better Auth's email-verification gate) — the UI is reserved
for the behaviour under test.

## Prerequisites

- Backend running on `:3000`, frontend on `:5173`, a migrated Postgres
  (`pnpm dev` from the repo root, `pnpm db:migrate`).
- Browsers installed: `pnpm --filter @buildpanda/frontend exec playwright install chromium`.

## Run

```bash
# from packages/frontend
pnpm e2e:smoke        # @smoke only — fastest signal
pnpm e2e              # full suite (all roles)
pnpm e2e -- --project=owner --grep @tasks   # one role + module
pnpm e2e:typecheck    # typecheck the harness
pnpm e2e:report       # open the last HTML report
```

If the dev servers are already up, set `E2E_NO_WEBSERVER=1` so Playwright reuses
them instead of booting `pnpm dev`.

## Determinism (why local runs serial)

`POST /projects` is rate-limited server-side. Projects are seeded once **per
worker** (worker-scoped fixture), and seeding retries while honouring the
server's `Retry-After`. Locally the suite runs with **1 worker** so the startup
burst never trips the limit — deterministic, flake-free signal. CI fans out with
**sharding** across machines (each with a couple of workers), so no single
machine hits the limit. Override concurrency with `E2E_WORKERS=N` if your
environment has a higher limit.

## Covered modules

Green across owner/member/viewer: **tasks** (persist + edit round-trip, columns),
**action-items** (upsert + edit round-trip), **invoices** (flagship — payment
balance reconciliation asserted at the API/DB layer), **change-requests**,
**rfis**, **queries**, **permits**, **key-dates**. The generic `ListUpsertPage`
POM covers the shared list+FormDrawer shape; new list modules are a few lines of
config. See `COVERAGE_MAP.md` for the full module inventory and the remaining
modules (materials, daily-log, inspections, team, schedule, etc.) which follow
the same recipe but need per-module field wiring.

## Config (env, mirrors backend `config/index.ts`)

| Var | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | SPA under test |
| `E2E_API_URL` | `http://localhost:3000` | Backend (seeding/auth) |
| `DATABASE_URL` / `DB_*` | knexfile dev defaults | Flip `emailVerified`, teardown |
| `E2E_PASSWORD` | strong default | Provisioned role password |
| `E2E_NO_WEBSERVER` | `0` | `1` = don't boot servers (CI) |

## Layout

- `playwright.config.ts` — one project per role (`owner`/`member`/`viewer`), sharding, env-driven.
- `config/env.ts` — single env access point.
- `fixtures/` — `api-client`, `ids` (generateId format), `db`, `auth` (sign-up→verify→sign-in), `seed`, `test` (per-spec project + teardown).
- `global-setup.ts` — provisions role users, writes `.auth/*.json` storageState.
- `pages/` — `base-drawer.pom` (FormDrawer upsert), `project-nav`, `<module>.pom`.
- `specs/` — one per module; each leads with a `/** RISK MAP **/`.

See `COVERAGE_MAP.md` (every module + stakes + highest-risk mutation) and
`ASSUMPTIONS.md` (unknowns, tagged inline as `// ASSUMPTION:`).

## Conventions

- Selectors: role > label > testid > text. Fallbacks flagged `// TESTID-NEEDED:`.
- No `waitForTimeout`; web-first assertions + `waitFor({ state })`.
- After a FormDrawer save, assert the post-invalidation DOM (drawer closed), never the in-flight request.
- All test data uses `generateId`-format IDs + a run token; teardown runs even on failure.
- `.auth/` and `.results/` are git-ignored (sessions + artifacts).
