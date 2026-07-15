# BuildPanda Admin Dashboard — Audit & Metric Plan

_Audit only. No implementation until sign-off._
_Canonical reporting timezone: **Africa/Lagos**. Charts library (to add): **Recharts** — not currently present._

---

## 0. Where the admin actually lives (orienting fact)

The admin is a **separate Vite SPA**: [`packages/admin`](file:///Users/drhendrix/projects/buildpanda/core/packages/admin) (`@buildpanda/admin`, port 5174, brand `#004DE7`, Plus Jakarta Sans). There are **no admin pages inside `packages/frontend`**. It talks to the backend `/admin/*` API ([`modules/admin`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/admin/routes.ts)) and auths via better-auth.

**Conventions to match (this app's, not the main frontend's):**
- Query keys are **inline arrays** (`["admin","overview"]`, `["admin","leads",search,offset]`) — there is **no `actionItemKeys`-style factory here**. To honour the "follow the factory" constraint I'll introduce an `adminKeys` factory in `src/api/` and migrate keys as I touch pages.
- Fetch layer: `src/api/client.ts` (axios) → `src/api/admin.ts`. All calls go through it.
- UI kit: [`components/ui.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/components/ui.tsx) (`Card`, `Loading`, `ErrorState`, `PageHeader`, `StatusBadge`, `RoleBadge`, `Button`), [`components/data-table.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/components/data-table.tsx), `cn()` in `lib/utils.ts`, `formatMoney`/`formatDate` in `lib/utils.ts`.
- **No `FormDrawer` and no `generateId` in the admin app** — those are backend/main-frontend patterns. Any new client IDs use the backend `generateId("prefix")` in Knex writes, not the admin SPA.

---

## 1. Screen inventory — keep / improve / cut

| Screen | Route | Shows today | Data source | Verdict |
|---|---|---|---|---|
| **Dashboard** | `/` | 9 raw count cards, 2 finance totals, newest 6 users + 6 projects | `GET /admin/overview` → `repo.overview()` | **Improve** — point-in-time counts only; no deltas, trends, or charts. This is the whole ask. |
| **Users** | `/users` | Search + paginated table (role, banned, verified, country, counts) | `GET /admin/users` | **Keep** — solid, batched counts (no N+1). |
| **User detail** | `/users/:id` | Profile + role/ban controls + memberships + projects | `GET /admin/users/:id`, `PATCH`, `DELETE` | **Keep + instrument** — mutations must hit an audit log (currently don't). |
| **Organizations** | `/organizations` | Search + table (member/project counts) | `GET /admin/organizations` | **Keep**. |
| **Org detail** | `/organizations/:id` | Members + projects | `GET /admin/organizations/:id` | **Improve** — add per-org activity + AI usage once instrumented. |
| **Projects** | `/projects` | Search/filter table across orgs | `GET /admin/projects` | **Keep**. |
| **Project detail** | `/projects/:id` | Drill-down tabs (finances, inspections, docs, activities, logs, risks) | `GET /admin/projects/:id` | **Keep** — but this is operational depth, not a growth lever. |
| **Leads** | `/leads` | Unassigned leads + assign-to-org | `GET /admin/leads`, `POST .../assign` | **Keep + instrument** (assign is a write; audit it). |
| **Jobs** | `/jobs` | Import jobs list w/ status filter | `GET /admin/jobs` | **Improve** — only `programme_import_jobs` + `boq_import_jobs`. **Omits takeoff/precon/agent** — the actual AI jobs. |
| **Maintenance** | `/maintenance` | Maintenance-mode toggle | `GET/PUT /admin/maintenance` | **Keep**. |
| **Feature flags** | `/feature-flags` | Flag toggles | `GET/PUT /admin/feature-flags` | **Keep**. |
| Sign-in | `/sign-in` | better-auth login | — | Keep. |

**Nothing to cut outright** — every screen is actionable. The gaps are *analytical*, not redundant screens.

---

## 2. Growth levers (opinionated)

| Lever | Is it a lever? | Justification |
|---|---|---|
| **Automated take-off / precon (DWG/PDF → BoQ)** | **YES — the core activation lever** | It's the one feature that turns "signed up" into "got value"; a proposal with an AI-measured BoQ is the aha-moment. |
| **Proposals → conversion to project** | **YES — expansion lever** | Proposal → won project is the funnel that grows accounts from pre-con into full project management (retention). |
| **Panda AI agent (chat/tools)** | **YES — retention lever** | Recurring, habit-forming usage; agent queries are the stickiness signal. |
| **Drawings/file ingestion** | Enabler, not a lever | Necessary plumbing for take-off; nobody adopts *because of* ingestion, but its failures kill activation. |
| Programme/BoQ import jobs | Weak lever | One-time onboarding convenience; doesn't drive recurring value. |
| Inspections / daily logs / risks / documents | **NO** | Project-execution depth — valuable to end users, but not what moves platform activation/retention/revenue and not admin-dashboard headline material. |
| Finances (project budgets) | **NO (for SaaS metrics)** | These are **construction figures logged, not SaaS revenue** (repo rule: money is logged, never transacted). Useful as an engagement proxy, misleading as "revenue." |

---

## 3. Metric set

### 3a. Already tracked & correct
| Metric | Formula | Source |
|---|---|---|
| Total users / orgs / projects | `count(*)` | `user`, `organization`, `projects` |
| Total project budget / funds released | `sum(total_budget)`, `sum(funds_released)` | `project_finances` |
| Import job volume + failures | `count`, `count where status='failed'` | `programme_import_jobs`, `boq_import_jobs` |
| Unassigned leads | `count where org_id is null` | `leads` |

### 3b. Tracked but wrong / misleading
| Metric | What's broken |
|---|---|
| **"Jobs" = imports only** | The dashboard's job counts **exclude `takeoff_jobs` + precon sessions + agent runs** — i.e. the real AI workload. "Failed imports" reads as "AI health" but isn't. |
| **Finance totals framed as platform value** | `total_budget`/`funds_released` are **users' construction money logged off-platform**, not BuildPanda revenue. Presenting them on an exec overview implies GMV/revenue they are not. |
| **No timezone bucketing anywhere** | All counts are all-time; any future "today/this week" number must bucket in **Africa/Lagos**, or DAU-type numbers will be off by up to a day. |

### 3c. Missing — and what's needed to compute
| Metric | Computable now? | Gap / instrumentation needed |
|---|---|---|
| **Signups over time, PoP delta, sparkline** | ✅ Yes | `user.created_at` exists; needs SQL `date_trunc` bucketing in Africa/Lagos. |
| **Activation funnel** (signup → org → first proposal → first take-off) | ✅ Yes (join) | All tables exist (`user`, `organization`/`member`, `proposals`, `takeoff_jobs`/precon). Needs funnel SQL. |
| **Cohort retention grid** | ⚠️ Partial | Signup cohort from `user.created_at`; "active" from `session.updatedAt`. Works, but session activity is coarse (see DAU caveat). |
| **DAU / WAU / MAU + stickiness** | ⚠️ Partial | **No `user.last_seen`.** Proxy = distinct `session.userId` by `session.updatedAt`/`createdAt`. Acceptable v1; a `last_seen_at` column (or activity events) would make it precise. |
| **Feature adoption by module** | ⚠️ Partial | Per-feature usage inferable from domain tables (proposals, takeoff_jobs, agent runs), but there's **no unified events table** — each module queried separately. |
| **Panda AI agent usage** | ✅ Yes (volume) | Agent runs/messages tables exist. |
| **AI job success rate** | ✅ Yes | `takeoff_jobs.status`, import jobs `.status` — `completed` vs `failed`. |
| **AI job / ingestion latency** | ⚠️ Approximate | Job tables have `created_at`+`updated_at` but **no `started_at`/`completed_at`**. `updated_at−created_at` includes queue wait. Precise latency needs a `started_at`/`completed_at` pair (additive columns). |
| **AI cost per run / token usage / model mix / validation success** | ✅ Platform-wide only | **`llm_calls` exists** (`tokens_in`, `tokens_out`, `latency_ms`, `model_version`, `validation_status`, `retry_count`, `created_at`, indexed on `created_at`). Cost = tokens × per-model price (in SQL). **But `llm_calls` has no `user_id`/`org_id`/`job_id`** → **no per-org / per-feature cost breakdown** without adding a nullable FK. |
| **MRR / ARR / ARPA / expansion / churn / LTV:CAC** | ❌ **NOT computable** | **There is no subscription/billing/plan/price table anywhere** (verified: no Stripe/billing, consistent with "money is logged, not transacted"). The entire **Revenue** section cannot be built without net-new billing instrumentation. Decision needed (§6). |
| **Admin audit trail** | ❌ Missing | **No admin audit-log table/helper.** Admin ban/delete/role/lead-assign/impersonate are **not audited**. Constraint "every admin read/write hits the audit log" is currently unmet → needs an additive `admin_audit_log` table + a write helper in the `/admin` preHandler and mutations. |

---

## 4. Gap analysis — ranked by decision-value ÷ effort

| # | Fix | Value | Effort | V/E |
|---|---|---|---|---|
| 1 | **Overview → time-series + PoP deltas + sparklines** (signups, active users, AI jobs, proposals) with Africa/Lagos bucketing | High | Med | **Top** |
| 2 | **AI ops panel** from `llm_calls` (cost/day, tokens, validation success, model mix) + `takeoff_jobs`/import success rate | High | Low‑Med | **Top** (data already exists) |
| 3 | **Admin audit log** (additive table + helper on every `/admin` write + impersonation) | High (constraint + trust) | Med | High |
| 4 | **Activation funnel** (signup→org→proposal→take-off, per-step conversion) | High | Med | High |
| 5 | **Fix "Jobs"** to include takeoff/precon/agent, not just imports | Med | Low | High |
| 6 | **DAU/WAU/MAU + stickiness + retention grid** (session-based, with caveat) | Med | Med | Med |
| 7 | Per-org AI cost (needs `llm_calls.org_id` FK backfill) | Med | Med‑High | Med |
| 8 | Precise job latency (`started_at`/`completed_at` columns + worker writes) | Med | Med | Med |
| 9 | **Revenue (MRR/ARR/…)** | High *if* monetized | **High** (net-new billing) | **Low now** — blocked on §6 |

---

## 5. Information hierarchy — the founder's daily 5–7

**Overview (headline, at-a-glance):**
1. **New signups** (period) + PoP delta + sparkline
2. **Activated accounts** (reached first take-off) + activation rate
3. **Active users** (WAU) + stickiness (DAU/MAU)
4. **AI jobs run** (period) + **success rate**
5. **AI spend** (period, from `llm_calls`) + PoP delta
6. **Proposals created → converted** (mini-funnel)
7. **Open ops alerts** (failed AI jobs / ingestion errors today)

**Everything else moves to drill-downs:**
- Growth page → signups chart, full activation funnel, cohort retention grid.
- Engagement page → DAU/WAU/MAU, feature adoption by module, agent usage.
- Revenue page → *stub until monetization exists* (see §6).
- Ops/health page → AI success rate by job type, latency, error feed, cost per run, model mix.
- Users/Orgs → keep existing tables + per-org detail, **now with an audit-log tab**.
- Raw finance totals (`project_finances`) → demote to a labelled "Customer construction volume (logged, not revenue)" tile, off the headline.

---

## 6. Decisions — LOCKED (founder sign-off received)

1. **Revenue → SKIP the SaaS page.** Instead: a single **"Total value tracked"** tile (`sum(project_finances.total_budget)`, labelled *logged, not revenue*) + a **"Highest-budgeted project"** callout. No MRR/ARR/churn.
2. **Per-org AI cost + tokens → YES.** Track per-org tokens & cost, per-org token usage, **and** platform-wide total token burn.
3. **Job latency → BOTH.** Add precise `started_at`/`completed_at` columns + worker writes, **and** keep the `updated_at−created_at` approximate fallback for legacy rows.
4. **Audit → ALL reads + writes** + impersonation start/stop.
5. **`adminKeys` factory → YES**, introduce and migrate keys as pages are touched.

### ⚠️ Scope discovered during verification (affects decision 2 — needs your awareness)

Threading per-org tokens is **bigger than an FK add**, because the LLM layer is deliberately decoupled:
- `lib/llm.ts` `LlmCallRecord` carries **no orgId and no token counts**; the provider response parser **discards `usage`** entirely.
- `llm_calls.tokens_in/out` columns exist but are **hardcoded `null`** on every insert.
- **The Panda AI agent is invisible to `llm_calls`** — `chatTools`/`chatStream` (agent path) **never emit call records**; only `chatJsonValidated` (take-off/structured path) does. So agent token burn is currently **untracked**.
- Many LLM calls run in **BullMQ workers with no Fastify request**, so org context can't be read from the request — it must be threaded explicitly or via AsyncLocalStorage.

**Implication:** delivering true per-org + platform token/cost requires (a) parsing `usage` from provider responses (incl. `stream_options.include_usage` for the streamed agent path), (b) extending `LlmCallRecord` with `tokensIn/tokensOut/orgId`, (c) emitting records from **all three** transports, (d) an org-context mechanism that survives queue workers. I've asked the Oracle to design the least-risky approach; I'll fold its recommendation into the final plan before writing code.

---

## 7. Planned deliverables once approved (additive, incremental)

- This audit doc (done) + short changelog of kept/improved/cut.
- **Migrations (additive only):** `admin_audit_log` table (+ indexes); optional `llm_calls.org_id` FK; optional `started_at`/`completed_at` on job tables. Every index named + justified.
- **Backend:** extend `modules/admin` with `overview.metrics` (bucketed, PoP), `funnel`, `retention`, `engagement`, `ai-ops` endpoints — **all SQL-aggregated via Knex** (`date_trunc` at `Africa/Lagos`, `filter`/`count`/`sum`, no JS rollups, no N+1). Audit-log write helper wired into the `/admin` preHandler + mutations. `node:test` coverage per query.
- **Frontend (`packages/admin`):** extend Dashboard + new Growth/Engagement/Ops pages using **Recharts**; every chart gets a **date-range selector, loading/empty/error states, and an "as of {Africa/Lagos} timestamp"**. `adminKeys` factory. Match existing `ui.tsx`/`data-table.tsx`/`cn()` — no second design language.
- **Seed script:** realistic demo data (signups over time, jobs w/ mixed status, `llm_calls` rows) so the dashboard is reviewable without prod.
- **Redirects:** none needed — all new routes are additive; no existing admin URL changes.

---

## 8. Finalized technical design (Oracle-reviewed)

### 8.1 Org + token attribution for LLM calls
- **Mechanism: `AsyncLocalStorage`** — new `lib/llm-context.ts` (`runWithLlmContext`, `getLlmContext`) carrying `{ orgId, userId, jobId, source }`. Only **3 seams**: Fastify `onRequest` (`enterWith` after authContext), BullMQ worker wrapper (`runWithLlmContext({ orgId: job.data.orgId, jobId })`), and the `server.ts` sink reads `getLlmContext()`. `lib/llm.ts` public API stays untouched (keeps decoupling + test seams). One-time audit: enqueue sites must put `orgId` on job payloads.
- **Tokens:** extend `ChatResponse` to parse `usage.{prompt,completion}_tokens`; add `tokensIn/tokensOut` (nullable) to `LlmCallRecord`; **emit records from all three transports** (`chatJsonValidated` already; **add to `chatTools` + `chatStream`** — the agent path). Streaming needs `stream_options:{include_usage:true}`. Nullable throughout (some proxies strip `usage`). Agent tool loop = N calls = N rows; dashboards **SUM**.

### 8.2 Pricing & cost
- `LLM_PRICES` **config map** (code-reviewed source of truth) mirrored into a seeded **`llm_prices`** table (`model_version, input_per_1k, output_per_1k, effective_from, effective_to`) for SQL joins.
- **Cost computed at query time, not stored** (prices get corrected retroactively). `LEFT JOIN`+`COALESCE` so unknown models don't drop rows (alert on null price). Bucketing: `date_trunc('day', created_at AT TIME ZONE 'Africa/Lagos')` — requires `created_at timestamptz` (it is).

### 8.3 Migrations (additive only)
1. `llm_calls.org_id` nullable text FK → `organization(id)` `ON DELETE SET NULL`. **No backfill** (`org_id IS NULL` = pre-instrumentation/platform bucket).
2. Two **partial** indexes (separate files, `transaction:false`, `CREATE INDEX CONCURRENTLY`): `llm_calls (org_id, created_at DESC) WHERE org_id IS NOT NULL` and `llm_calls (org_id, model_version, created_at DESC) WHERE org_id IS NOT NULL` — per-org time buckets + per-org cost-by-model.
3. `llm_prices` table (seeded from `LLM_PRICES`).
4. `started_at`/`completed_at timestamptz` on `takeoff_jobs`, `programme_import_jobs`, `boq_import_jobs` — worker stamps them at `processing`/terminal transitions (approx `updated_at−created_at` fallback for legacy rows).
5. `admin_audit_log`: `id bigserial, admin_user_id FK user, action, target_type?, target_id?, method, path, route?, ip?, status_code?, metadata jsonb?, created_at timestamptz`. Indexes: `(admin_user_id, created_at DESC)`, `(action, created_at DESC)`, `(target_type,target_id) WHERE target_id IS NOT NULL`, `(created_at DESC)`.

### 8.4 Audit logging
- **`onResponse` hook** (not `preHandler` — captures `status_code`, adds **zero latency** via `done()` first, then fire-and-forget insert). Covers **all** `/admin` reads+writes. Per-route `config.audit=false` opt-out for noisy polling; `config.auditAction`/`auditTargetType` for rich labels. Impersonation start/stop logged explicitly. Mirror the `finance_events` writer style.

### 8.5 New/changed endpoints (all SQL-aggregated, no N+1, Africa/Lagos)
`GET /admin/metrics/overview` (headline 5–7 + PoP + sparkline series), `/admin/metrics/growth` (signups, activation funnel, cohort retention), `/admin/metrics/engagement` (DAU/WAU/MAU, stickiness, feature adoption, agent usage), `/admin/metrics/ai-ops` (job success by type, latency, token burn platform + per-org, cost, model mix, validation status). Extend `/admin/overview` "value tracked" + highest-budgeted project. Fix `/admin/jobs` to include takeoff/precon.

### 8.6 Frontend (`packages/admin`)
`adminKeys` factory in `src/api/`; Recharts; new Growth/Engagement/Ops pages + extended Dashboard; shared `DateRangePicker` + `AsOf` timestamp + loading/empty/error on every chart; reuse `ui.tsx`/`data-table.tsx`/`cn()`. New audit-log tab on org/user detail.

**Build order:** (1) migrations + `llm_prices` seed → (2) llm-context + token capture + 3-transport emit → (3) audit-log hook → (4) metric query layer + tests → (5) admin endpoints → (6) `adminKeys` + Recharts pages → (7) demo seed → (8) changelog.

---

## 9. Changelog — what shipped (implemented + verified)

### Kept
- All 11 admin screens (users, orgs, projects + detail drill-downs, leads, maintenance, feature flags). Batched-count queries left intact (no N+1).

### Improved
- **Overview dashboard**: replaced flat all-time counts with 5–7 headline KPIs — Signups (+ PoP delta + sparkline), Active users (WAU + stickiness), AI jobs (+ success rate), AI spend (USD + tokens), Total value tracked (labelled *logged, not revenue*), Highest-budgeted project. Kept newest-users/projects.
- **`/admin/jobs`**: now unions `takeoff_jobs` in addition to programme/boq imports (previously omitted the real AI jobs).
- **Query keys**: introduced `adminKeys` factory; migrated overview key off inline arrays.

### Added
- **New pages**: Growth (signups area + activation funnel w/ per-step conversion), Engagement (DAU/WAU/MAU + stickiness + active-users line), AI Operations (token-burn stacked area + cost line, per-org cost table, per-job-type health w/ success rate + avg latency).
- **New endpoints**: `/admin/metrics/{overview,growth,engagement,ai-ops}`, `/admin/audit-log`. All SQL-aggregated via Knex, `date_trunc` at **Africa/Lagos**, no JS rollups.
- **AI cost/token tracking** (per-org + platform): `AsyncLocalStorage` LLM context, token `usage` capture across all 4 LLM transports (agent path was previously untracked), `llm_calls.org_id` + `tokens_in/out` now populated, `llm_prices` versioned table, cost computed at query time.
- **Admin audit log**: `admin_audit_log` table + fire-and-forget `onResponse` hook auditing every admin read+write + impersonation (zero added latency); audit-log views on org/user detail.
- **Job latency**: `started_at`/`completed_at` on takeoff/programme/boq jobs, written at status transitions.
- **Charts**: shared `DateRangePicker` (7d/30d/90d) + `AsOf` (Africa/Lagos) + `ChartCard` (loading/empty/error) on every chart. Recharts added.
- **Demo seed** (`20260782_admin_demo_metrics`): 60 days of realistic users/sessions/llm_calls/jobs so the dashboard is reviewable without prod.

### Cut
- Nothing removed. Raw finance totals demoted from headline to a labelled "value tracked (logged, not revenue)" tile. SaaS **Revenue page skipped** — no billing/subscription data exists (money is logged, not transacted).

### Verification
- 6 additive migrations applied on a fresh 124-migration DB; schema objects verified.
- Backend `tsc` clean (excluding unrelated in-flight WIP); **95/95 backend tests pass** (metric-math test caught + fixed a funnel edge-case bug).
- All 9 metric queries executed against real Postgres + demo data (correct curves).
- Admin `tsc` + `vite build` pass; **no `any`**.
- **Browser QA (Playwright)** end-to-end: signed in as admin, drove Overview/Growth/Engagement/AI-Ops + org detail against the live API. Caught & fixed 5 real defects only usage revealed: double-×100 stickiness (842%→8%), double-×100 success rate (8666%→86.7%), USD-as-Naira AI cost (₦1→$0.70), collapsed chart containers (fixed height), and residual `any` in Recharts formatters. Final: 0 console errors, all charts render, audit log captures requests, per-org AI cost breakdown live.

---

## 10. Three-pass gap review (post-implementation hardening)

Ran 3 adversarial passes (correctness / edge-cases / integration+scale) via Oracle + explore + direct DB probing. Findings and resolutions:

| ID | Gap | Pass | Fix | Verified |
|---|---|---|---|---|
| — | **Cron insight analysis had `orgId=null`** — `periodic-scheduler` bypassed `service.trigger`, so scheduled AI cost was unattributed. | 3 | Resolve org from project at enqueue; attach to `AnalysisJobData`. | tsc |
| — | **5 AI job payloads carried no `orgId`** — background LLM cost (precon, insights, boq) attributed to null. | 3 | Added `orgId` to TakeoffJobData/PreconGenerateJobData/AnalysisJobData/ProgrammeImportJobData/BoqImportJobData + every enqueue site. Queue wrapper already reads it. | tsc; explore confirmed **NONE remaining** |
| B2 | **Failed provider calls emitted no `llm_calls` row** — timeouts/429/5xx invisible → undercounted failures + retried spend. | 2 | try/catch in `chatTools`/`chatStream`/`chatVision`; emit `validation_status='failed'` on throw (partial stream usage preserved). | tests |
| B4 | **Overlapping price rows → double-counted cost + inflated tokens** (LEFT JOIN could match 2 price rows). | 2 | Rewrote `aiTokenSeries`/`aiCostByOrg` with `LEFT JOIN LATERAL … LIMIT 1` (pick-one) + DB **partial unique index** (one open-ended price per model). | DB: overlapping row now **rejected**; totals unchanged |
| C | **Missing indexes** on `session.updatedAt` (DAU/WAU/MAU) + `user.createdAt` (signups) → full scans at scale. | 3 | Two `CREATE INDEX CONCURRENTLY` migrations. | indexes present |
| M1 | **Funnel credited stale org proposals** to fresh signups (no time bound). | 2 | Added `p.created_at >= range.from` / `t.created_at >= range.from`. | DB: proposal step corrected 180→150 |
| B3 | `chatJsonValidated` recorded model via `activeModelName()` at record-time (could drift). | 1 | Snapshot `modelVersion` at call start. | tests |
| M6 | `orderByRaw("cost_usd DESC")` — fragile alias/escaping. | 1 | `.orderBy("cost_usd","desc")`. | tests |

**AsyncLocalStorage correctness proven** (new `llm-context.test.ts`, 4 tests): context propagates request→LLM-call, **isolates concurrent requests/jobs (no org bleed under load)**, no stale leak, survives `setImmediate` (inline-queue mode).

**Confirmed-correct (no change needed):** price-join produces no double-count/silent-drop with valid data; unpriced/unknown model → tokens still counted, cost=0 (correct failure mode); audit `onResponse` hook + `req.user` populated; `done()`-first zero-latency ordering.

**Documented tradeoffs — NOW ALL RESOLVED (second hardening pass):**

| ID | Was | Fix | Verified |
|---|---|---|---|
| M4 | DAU/WAU/MAU used `session.updatedAt` (coarse proxy) | Added `user.last_activity_at` column + index; **throttled** write in auth hook (1/user/5min — no per-request write); metrics read it. | 59-day curve, peak 7 |
| M3 | Active-user windows anchored on `range.to` | Anchor on `now()` — proper rolling DAU/WAU/MAU. | 7 / 27 / 94 |
| M5 | Stuck `processing` jobs invisible | `aiJobHealth` now returns `stuck` = COUNT(status='processing' AND started_at < now()−1h). | stuck:2 |
| M2 | Funnel credited org-level actions to all members | Per-user attribution via `proposals.created_by` + `takeoff_jobs.requested_by`. | proposal step 150→5 (truthful) |
| — | Unpriced model = silent $0 | `ai-ops` now returns `uncostedTokens` + `unpricedModels[]`. | mechanism confirmed |

Migrations `20260785` (last_activity_at) + `20260786` (its index) added. All verified against demo data; 99/99 tests pass; backend + admin tsc clean.

### Post-hardening verification
- Backend `tsc` clean (my changeset); **99/99 tests pass** (95 + 4 new context tests).
- 3 new migrations applied; all indexes + price guard verified in DB.
- LATERAL cost queries re-verified against demo data — identical totals, now overlap-proof.
