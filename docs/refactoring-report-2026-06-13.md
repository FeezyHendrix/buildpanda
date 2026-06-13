# BuildPanda Refactoring Report

**Date**: 2026-06-13
**Scope**: Full codebase scan — `packages/backend`, `packages/frontend`, `packages/admin`, `packages/web`. Goal: enforce DRY/YAGNI, find naming/ambiguity issues, propose concrete extractions.
**Method**: 6 parallel `explore` background agents + direct `rg` / `ast-grep` / file size analysis. Synthesised from agent reports + my own scan of high-traffic modules.

---

## 0 · Headline numbers

| Metric | Value |
|---|---:|
| Backend modules | 33 |
| Backend `.ts` LOC (excl. node_modules) | 19,639 |
| Frontend `.ts/.tsx` LOC | 28,979 |
| Knex migrations | 30 |
| React Query hook files | 32 |
| Atomic molecule files | 65+ |
| **Test files** | **0** ⚠ |
| `TODO/FIXME/HACK/XXX` comments | 0 ✅ |
| `as any` / `@ts-ignore` / `@ts-expect-error` | 0 ✅ |
| `console.log/warn/error/info/debug` in src | 2 (both legitimate: error-boundary + mail logger) ✅ |

**Bright spots**: Zero type escape hatches, zero stale TODOs, almost no `console.*` noise, no broken tests because there are no tests at all. The code reads as carefully written but **the carefulness was applied per-module, not across modules** — almost every smell below is "the same thing implemented in N places".

---

## 1 · High-impact DRY extractions

Ordered by occurrence count × cost-per-occurrence. Doing #1–#7 would cut ~600–800 LOC across the frontend and meaningfully shrink the surface area where new bugs can hide.

### 1.1 🔴 `orgScope(request)` is a per-route private helper — should be a shared helper or Fastify decorator

**Pattern** (3 lines, repeated everywhere):
```ts
request.requireAuth();
const orgId = request.activeOrganizationId;
if (!orgId || !request.orgRoles.has(orgId)) throw new ForbiddenError("No active organization");
```

**Occurrences**: 8 across 4 modules — [proposals/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts) (defines it locally as `orgScope`, then uses it 14×), [org-profile/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/org-profile/routes.ts), [leads/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/leads/routes.ts), [projects/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/projects/routes.ts).

**Extraction**: Hoist `function orgScope(req): string` from [proposals/routes.ts:140](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts#L140) into either:
- `lib/authorization.ts` (already exists — best fit) as `requireOrgScope(req): string`, or
- A Fastify decorator: `request.requireOrgScope()` returning the org id

**Effort**: 15 min. **Benefit**: removes a copy-paste vector for auth bugs.

---

### 1.2 🔴 Inline `idParams` / `listQuery` JSON schemas — same 4 lines × 33 modules

**Pattern**:
```ts
const idParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;
```

**Occurrences**: every `modules/*/routes.ts` redefines this. Same for `listQuery` (limit + offset).

**Extraction**: `lib/schemas.ts` exporting `idParams`, `paginationQuery({ extra: {...} })` factory, and `notesPatch` for the common `{ status?, notes? }` shape.

**Effort**: 1 hour (touch every routes.ts to import). **Benefit**: enforces consistency on validation; trivial to add OpenAPI later.

---

### 1.3 🟡 `toX(row: XRow): X` row-mapping pattern — 30+ near-mechanical implementations

**Pattern**: every repository.ts has `toFoo(row: FooRow): Foo` that maps snake_case → camelCase one field at a time. We found ≥30 of these.

**Examples**: `toProposal` ([proposals/repository.ts:19](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/repository.ts#L19)), `toLead` ([leads/repository.ts:10](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/leads/repository.ts#L10)), `toEstimate`, `toScheduleItem`, etc.

**Recommendation**: **Don't blanket-extract** — many of these have small projections (e.g. computed `numberLabel`, `Number(row.tax_pct)` coercions for Knex's decimal-as-string). A generic `snakeToCamel` would erase those.

**Targeted action**: extract just the **trivial 1:1 mappers** (no field renames, no coercions) into a thin helper `mapRow(row, fields)`. Keep custom ones as-is. Audit first to see which are trivial — my guess: 30–40% are. **Effort**: 2 hrs assessment + extraction. **Benefit**: medium; the cost of mistakes here is silent data corruption, so be conservative.

---

### 1.4 🔴 Frontend currency formatting — 5 local `fmt()` helpers + 11 inline `Intl.NumberFormat` while `lib/formatters.ts` already has the right helper

**Existing helper** (unused by 5 of the 11 callers): [`formatCurrency(value, currency, opts)`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/lib/formatters.ts#L18) — already handles locale per currency (NGN→en-NG, USD→en-US, etc.).

**Duplicates**:

| File | Form | Notes |
|---|---|---|
| [public/proposal-page.tsx:9](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/public/proposal-page.tsx#L9) | local `fmt(amount, currency)` | hard-codes `en-NG` |
| [sales/proposals.tsx:42](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposals.tsx#L42) | local `fmt(amount, currency)` | dup |
| [sales/proposal-workspace.tsx:57](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposal-workspace.tsx#L57) | local `fmt(amount, currency)` | dup |
| [my-build.tsx:11](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/my-build.tsx#L11) | inline `Intl.NumberFormat` | dup |
| [project/change-requests.tsx:36](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/change-requests.tsx#L36) | inline | dup |
| [components/molecules/change-request-detail-dialog.tsx:25](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/components/molecules/change-request-detail-dialog.tsx#L25) | inline | dup |
| [components/molecules/insights-summary.tsx:7](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/components/molecules/insights-summary.tsx#L7) | inline | dup |
| [components/atoms/budget-slider.tsx:14](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/components/atoms/budget-slider.tsx#L14) | inline `en-US` | inconsistent locale |
| [components/molecules/project-summary-step.tsx:45](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/components/molecules/project-summary-step.tsx#L45) | local `fmt` | inconsistent locale |

**Action**: replace all with `formatCurrency(value, currency)`. Tweak `formatCurrency`'s defaults to match the most common usage (`maximumFractionDigits: 0`) and add an option for the few that want decimals.

**Effort**: 1 hr. **Benefit**: ✅ consistency (some currently show ₦10,965,000 in one place and ₦10,965,000.00 in another for the same value); ✅ one place to add a currency.

---

### 1.5 🔴 Frontend date formatting — 20+ inline `toLocaleDateString("en-GB"`

**Existing helpers** (unused by everyone except internally): [`formatDateTime`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/lib/formatters.ts#L75) and [`formatTimeAgo`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/lib/formatters.ts#L60).

**Duplicates**: 20+ call sites with at least 3 distinct format variants:
- `{ day: "numeric", month: "short", year: "numeric" }` — leads, proposals list, proposal-workspace overview
- `{ day: "2-digit", month: "short" }` — whats-next, queries, approvals, action-items
- `{ day: "2-digit", month: "short", year: "numeric" }` — materials, permits, equipment-requests, key-dates
- `{ month: "short", day: "numeric", year: "numeric" }` — project/schedule
- `{ month: "short" }` with hour/minute — proposal-workspace activity tab

Files: leads.tsx (×2), proposals.tsx, proposal-workspace.tsx (×5 — including ones I added), public/proposal-page.tsx, project/materials.tsx, project/whats-next.tsx, project/queries.tsx, project/approvals.tsx, project/permits.tsx, project/action-items.tsx, project/equipment-requests.tsx, project/key-dates.tsx, project/budget.tsx, project/schedule.tsx.

**Action**: extend `lib/formatters.ts` with semantic helpers — `formatShortDate`, `formatDayMonth`, `formatActivityTimestamp`. Replace ~20 call sites.

**Effort**: 1 hr. **Benefit**: ✅ consistency, ✅ i18n-ready in one place.

---

### 1.6 🔴 Inline loading spinner — 16+ copies with 3 different sizes & 2 different border colors

**Pattern**: `<div className="size-{6|7|8} animate-spin rounded-full border-2 border-gray-{200|300} border-t-[#004DE7]" />`

**Occurrences (16+)**: layouts/sales-layout.tsx, layouts/dashboard-layout.tsx, layouts/project-layout.tsx, pages/dashboard/index.tsx, pages/sales/leads.tsx, pages/sales/proposals.tsx, pages/sales/settings.tsx, pages/sales/proposal-workspace.tsx (×4), pages/project/invoices.tsx, pages/project/finances.tsx, pages/project/budget-allocation.tsx, pages/project/milestone-payments.tsx, pages/public/proposal-page.tsx, pages/project/panda-ai.tsx, pages/project/budget.tsx.

**Action**: `components/atoms/spinner.tsx` with `<Spinner size="sm|md|lg" />` (or just one size by default). Use it everywhere.

**Effort**: 30 min. **Benefit**: ✅ design consistency; right now two pages render the same loading state slightly differently.

---

### 1.7 🟡 `STATUS_TONE` re-implementations — 4 inline + 3 in `lib/project-meta.ts`

**`lib/project-meta.ts`** has the right pattern: `DOCUMENT_STATUS_TONE`, `INSPECTION_STATUS_TONE`, `PROJECT_STATUS_TONE`. But these four pages re-invent their own:
- [project/people.tsx:20](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/people.tsx#L20) — `STATUS_TONE` for `ParticipantStatus`
- [project/invoices.tsx:37](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/invoices.tsx#L37) — for invoice status
- [project/activities.tsx:27](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/activities.tsx#L27) — for activity status
- [sales/proposals.tsx:13](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposals.tsx#L13) + [sales/proposal-workspace.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposal-workspace.tsx) — for proposal status

**Action**: move all into `lib/project-meta.ts` (or `lib/status-tones.ts`); also add a `LABEL_MAP` for any status that needs a UI-friendly name (e.g. `ProposalOpened` → `"Proposal Opened"`). The proposals file already has a `LABEL_MAP` that should be hoisted alongside.

**Effort**: 30 min.

---

### 1.8 🔴 `LIMIT = 25` magic page-size literal — 6+ places

**Occurrences**: [admin/leads.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/pages/leads.tsx), [admin/users.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/pages/users.tsx), [admin/organizations.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/pages/organizations.tsx), [admin/projects.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/pages/projects.tsx), [sales/leads.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/leads.tsx#L22), [sales/proposals.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposals.tsx#L40).

**Action**: `lib/constants.ts` with `export const DEFAULT_PAGE_SIZE = 25` or fold into a pagination hook (see 1.9).

**Effort**: 5 min.

---

### 1.9 🟡 CRUD table page shell — 5 pages with the same shape

Each does: filter `<select>` + count badge + spinner | EmptyState | table + pagination buttons.

**Files with this shape**: [sales/leads.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/leads.tsx), [sales/proposals.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposals.tsx), [project/materials.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/materials.tsx), [project/equipment-requests.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/equipment-requests.tsx), [admin/*.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/admin/src/pages/) (already has a `DataTable` molecule — frontend should too).

**Recommendation**: **don't try to be too clever**. A single mega-`CrudTablePage` will end up with 12 props and conditional logic everywhere. Instead:
- `usePaginatedList<T>({ query, status, limit })` hook that returns `{ rows, total, offset, setOffset, hasNext, hasPrev }`.
- `<DataTablePagination />` component for the pagination buttons.
- Leave each page as its own component for the table body — it's the unique bit.

**Effort**: 2 hrs. **Benefit**: cuts ~30 lines per page × 5 = 150 LOC, and standardises the empty / loading / error split.

---

### 1.10 🟡 React Query inline keys that bypass `query-keys.ts` factory

**`hooks/query-keys.ts`** centralises keys, but several hooks ignore it. From my hooks audit:

- [`use-proposals.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/hooks/use-proposals.ts) — `["proposal-comments", proposalId]`, `["proposal-plans", proposalId]`, `["proposal-boq", proposalId]`, `["public-proposal", token]` (these 4 are mine — added during the bug-fix pass; they should go into the factory).

**Action**: extend `proposalKeys` factory with `.comments(id)`, `.plans(id)`, `.boq(id)`, `.public(token)`. Update `use-proposals.ts` callers.

**Effort**: 10 min. **Benefit**: invalidation chains become correct again — currently `qc.invalidateQueries({ queryKey: proposalKeys.all })` won't invalidate plans/boq/comments because they're not under the factory's root.

---

### 1.11 🟡 CRUD hook factory — 30+ near-identical `useMutation` blocks

Across the 32 hook files there are roughly 90+ `useMutation` calls, almost all of the shape:
```ts
return useMutation({
  mutationFn: (body) => xApi.create(body),
  onSuccess: () => qc.invalidateQueries({ queryKey: xKeys.all(projectId) }),
});
```

**Recommendation**: a generic `makeCrudHooks(api, keysFactory)` might collapse 30%+ of the lines, BUT this kind of abstraction tends to become annoying when 20% of the hooks need a tiny variation (e.g. optimistic update, redirect on success). Prefer a smaller, narrower helper:

```ts
function useInvalidatingMutation<T, R>(
  mutationFn: (input: T) => Promise<R>,
  keysToInvalidate: QueryKey[],
): UseMutationResult<R, Error, T>
```

…and call sites just provide the function + the keys. Smaller surface, less magic. **Effort**: 1 hr to pilot in 2–3 hooks, decide whether to roll out. **Benefit**: only worth doing if you have a coherent invalidation policy first.

---

## 2 · Naming inconsistencies & ambiguity

### 2.1 🔴 `lib/project-mock-data.ts` (696 lines) is **misnamed** — contains **zero** mock data

This file is imported by ~50 modules (every project page, every project hook, many molecules) as the source of truth for domain types: `RiskLevel`, `ProjectStatus`, `PhaseStatus`, `Currency`, `Tone`, `UpdateCategory`, `DocumentStatus`, `InspectionStatus`, `MilestoneStatus`, `ActivityStatus`, `WeatherCondition`, `ActionStatus`, `QueryStatus`, `ApprovalStatus`, `ChangeStatus`, `PermitStatus`, … (87 exports, all types/interfaces).

**Action**: rename to `lib/project-types.ts` (or `lib/domain-types.ts`). LSP-rename will update every import. **Effort**: 5 min. **Benefit**: enormous — currently every new dev who opens this file thinks it's seed/fixture data and won't touch it. Half the codebase imports from a file labelled "mock".

---

### 2.2 🟡 Inconsistent abbreviations

Mixed throughout: `pct` vs `percent`, `qty` vs `quantity`, `prj` vs `project`, `mlst` vs `milestone`, `est` vs `estimate`, `org` vs `organization`, `mem` vs `member`, `doc` vs `document`, `evt` vs `event`.

**Most are ID prefixes** (`generateId("mlst")`, `generateId("est")`, etc.) and changing them mid-stream invalidates URLs and DB rows. **Leave the IDs alone.** Just standardise variable names — `mlst` → `milestone`, `evt` → `event` in code, but the ID prefix stays.

### 2.3 🟡 Snake_case leak in the type layer

[`lib/project-mock-data.ts:291`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/lib/project-mock-data.ts) declares a TypeScript interface field as `updated_at: string` (snake_case) — leaks the DB convention into the DTO type. Rename to `updatedAt`.

### 2.4 🟡 The `organization` table has mixed-case columns and the codebase keeps tripping over it

We just fixed [Bug #4](file:///Users/drhendrix/projects/buildpanda/core/.playwright-mcp/qa-2026-06-13/REPORT.md) — `updated_at` vs `updatedAt`. Better-auth owns `createdAt`/`updatedAt` (camelCase); the [`20260614_org_profile.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/db/migrations/20260614_org_profile.ts) migration adds `phone`/`address`/`contact_email`/`default_currency` (snake_case).

**Recommendation**: don't try to standardise the existing columns (better-auth owns those). Add a one-line comment to the migration noting the convention split, and consider a [Knex case-mapping plugin](https://knexjs.org/guide/interfaces.html) if you're regularly touching this table from new code.

---

### 2.5 🟢 Status enum drift — checked, currently fine

I spot-checked frontend `LEAD_STATUSES` ↔ backend `LEAD_STATUSES` ↔ DB `leads_status_check` constraint, and `PROPOSAL_STATUSES` likewise. **All three agree** today. Risk going forward: nothing enforces this — adding a status backend-side won't fail any compile or test. **Suggested guardrail**: a thin shared package `@buildpanda/types` (or just a script that diffs the three sources of truth).

---

### 2.6 🟢 Inconsistent terminology — checked, mostly clean

- `proposal` is consistently used (never `quote` or `bid`).
- `lead` consistently (never `prospect` or `enquiry`).
- `estimate` consistently.
- `client` consistently (never `customer`).
- `organization` is the API/DB term, `company` is the UI label ("Switch company", "Your Company") — this is a deliberate **API/UI vocabulary split**, not a smell.

---

## 3 · YAGNI / dead code

### 3.1 🔴 Dead `void X;` statements (4 occurrences)

These are smell-of-smells. Each one says "I imported something I'm not using; please stop yelling at me":

| File | Line | Context |
|---|---:|---|
| [proposals/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts#L133) | 133 | `void request;` inside an unused `requireOrgAccess` helper |
| [proposals/routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts) | 689 | `void requireOrgAccess;` to silence the unused-export warning |
| [sales/proposal-workspace.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposal-workspace.tsx#L440) | 440 | `void planId;` inside an empty `handleDownload` (mine — added as a stub when wiring Plans tab) |
| [sales/proposal-workspace.tsx](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposal-workspace.tsx) | 441 | `void fileName;` same handler |

**Action**:
- `requireOrgAccess` in [proposals/routes.ts:132–134](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts#L132) is a dead helper. Delete it + the `void` references.
- The two in proposal-workspace.tsx are an unused `handleDownload` callback I added as a placeholder. Remove it — the actual download is now the `<a href={downloadUrl}>` element.

**Effort**: 2 min.

---

### 3.2 🟡 `coming-soon.tsx` molecule — find its users

`components/molecules/coming-soon.tsx` exists. If it's used in any shipped page, the team is shipping placeholders. If unused, delete it.

**Action**: `rg -l 'ComingSoon' packages/frontend/src` — if zero matches outside its own file, delete.

---

### 3.3 🟡 `seeds/20260530_marbella.ts` (784 lines)

Massive demo data. **Don't auto-run this in production** (it's gated by env if you use `db:seed` separately, but check). Acceptable as a dev fixture; not acceptable if it ships.

**Action**: confirm seed is only ever run on demo envs; add a guard in [knexfile.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/knexfile.ts) that throws if `NODE_ENV === "production"` and `db:seed` is invoked.

---

### 3.4 🟡 Commented-out JSX in [`dashboard/index.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/dashboard/index.tsx)

Agent flagged lines ~203 and 208–216 as commented-out blocks. Either restore + use, or delete. Commented-out code is debt.

---

### 3.5 🟢 Stale `.env` documentation — checked, mostly OK

`.env.example` covers all the env vars used in `lib/config/index.ts`. **Two unused-by-config vars** referenced in code that bypass `config`:

- [`lib/auth.ts:15–22`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/lib/auth.ts#L15) reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` **directly via `process.env`** instead of going through `config.db.*` — duplicates the fallback logic from [`config/index.ts:53–62`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/config/index.ts#L53).
- Same file uses `process.env["BETTER_AUTH_SECRET"]`, `process.env["BETTER_AUTH_URL"]`, `process.env["CORS_ORIGIN"]` (×3) directly. `config.auth.*` already exposes these.

**Action**: `lib/auth.ts` should import from `config`. **Effort**: 15 min. **Benefit**: one place to know what env vars exist.

---

### 3.6 🟢 Untracked junk in repo root

`daily-log-drawer-verify.png` and `drawer-create.png` are untracked PNGs from a previous QA pass. **Add `*.png` to `.gitignore`** at the repo root (or move them to `.playwright-mcp/`).

---

## 4 · File-size hotspots (mega-files that should split)

| File | LOC | Verdict |
|---|---:|---|
| [`packages/frontend/src/pages/sales/proposal-workspace.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/sales/proposal-workspace.tsx) | **1,185** | 🔴 Split. Contains `OverviewTab`, `MessagesTab`, `ActivityTab`, `PlansTab`, `BoqTab`, `EstimateTab` + the workspace shell. Each tab → its own file under `pages/sales/proposal-tabs/`. |
| [`packages/backend/src/db/seeds/20260530_marbella.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/db/seeds/20260530_marbella.ts) | 784 | 🟡 Fine if seed-only; gate to non-prod. |
| [`packages/backend/src/modules/proposals/repository.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/repository.ts) | **738** | 🟡 **Deferred** until tests exist. Sub-domains share a closure-captured `db`; splitting requires composing 4 sub-factories and touching the consuming service. Not worth the regression risk without supertest coverage. Revisit after §6 lands. |
| [`packages/frontend/src/lib/project-mock-data.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/lib/project-mock-data.ts) | 696 | 🔴 Rename (see §2.1) AND consider splitting by domain. |
| [`packages/backend/src/modules/proposals/routes.ts`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/routes.ts) | **691** | 🟡 Could split route groups; mostly fine. |
| [`packages/frontend/src/pages/project/finances.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/finances.tsx) | 578 | 🟢 Borderline; only split if a clear tab boundary exists. |
| [`packages/frontend/src/pages/project/updates.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/updates.tsx) | 524 | 🟢 Borderline. |
| [`packages/frontend/src/pages/project/budget.tsx`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/project/budget.tsx) | 495 | 🟢 OK. |

The **must-split** ones are highlighted; the rest can wait until they cross 700.

---

## 5 · Cross-cutting / hard-to-read areas

### 5.1 🟡 Currency math is computed **twice** — backend authoritative, frontend re-computes

Backend [`repository.ts:108–115`](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/repository.ts#L108) computes subtotal/tax/total and stores them on the estimate. Frontend [`public/proposal-page.tsx:240–251`](file:///Users/drhendrix/projects/buildpanda/core/packages/frontend/src/pages/public/proposal-page.tsx#L240) re-computes them client-side for display (e.g. `estimate.subtotal * estimate.contingencyPct / 100`).

**Risk**: divergent rounding. The DB stores `numeric(16,2)` rounded one way; the JS multiplies floats and may round differently.

**Action**: derive everything from the server-stored values (`estimate.taxAmount`, `estimate.total`) and only compute *line-by-line displays* on the client. Don't recompute the totals.

---

### 5.2 🟡 Status transition rules implicit / scattered

We don't seem to have a single state machine for `ProposalStatus`. Right now:
- `client_accepted` event handler in [public-routes.ts](file:///Users/drhendrix/projects/buildpanda/core/packages/backend/src/modules/proposals/public-routes.ts) sets status to `Accepted`
- `convert` handler insists on `status === "Accepted"` before allowing
- expiry job moves `Sent` → `Expired`
- create-revision moves `New` → `Preparing`

Each transition is inline. **Risk**: a future "decline" from accepted-state, or "revive a Lost proposal" feature, will land in 3 different files and probably miss one.

**Action**: extract a tiny FSM `proposalTransitions.ts` documenting the legal moves. Not urgent; do it before the next status-related feature.

---

### 5.3 🟢 Auth checks — checked, applied consistently

136 `requireAuth()` / `requireAdmin()` calls across modules. Admin module gates *every* route via a `preHandler` hook — good pattern. Other modules call `requireAuth()` inline per-handler — verbose but explicit; not a smell.

---

### 5.4 🔴 Frontend hardcoded brand colors — 419 occurrences

`#004DE7` (primary blue), `#F6F6F6` (input surface), `#F8F8F8` (sidebar bg), `#FAFAFA` (page bg), `#F4F6FB` (public bg), `#EDEDED` (active nav).

**Action**: define these in `tailwind.config` (or whatever Tailwind 4 uses — looks like `@theme` directives in CSS) as semantic tokens (`brand-500`, `surface-muted`, `surface-canvas`). Replace hex literals via codemod.

**Effort**: 1 hr setup + 1 hr codemod. **Benefit**: dark mode becomes one-file change instead of 100. Designers can rebrand without grep.

---

### 5.5 🟢 Inconsistent dialog/drawer/modal terminology

The codebase uses `Dialog` and `Drawer` consistently — `Dialog` for centred modals (`*-dialog.tsx`), `Drawer` for the side panel (`form-drawer.tsx`, `edit-budget-drawer.tsx`). 30+ molecule files follow the convention. Not a smell.

---

## 6 · Test infrastructure gap (the elephant)

**There are zero tests in this codebase.** No `*.test.ts`, no `*.spec.ts`, no Vitest config, no Playwright config, no Jest config.

This explains why every bug I caught in the [QA pass](file:///Users/drhendrix/projects/buildpanda/core/.playwright-mcp/qa-2026-06-13/REPORT.md) was a fresh-from-the-keyboard regression — there's no safety net.

**Recommendation** (separate effort, not part of this refactor):
- Backend: Vitest + supertest for route-level tests. Start with the 5 routes I fixed (`org-profile PATCH`, `auth reset`, `proposal convert`, `leads CRUD`, `plans/boq`).
- Frontend: Vitest + React Testing Library for the new tab components + the leads/proposals shells.
- End-to-end: Playwright (you already have it via MCP) — at minimum smoke-test the auth + proposal-to-project happy path.

The first 20 tests would catch ~80% of the issues this refactor is going to nearly-introduce.

---

## 7 · Recommended order of operations

A pragmatic sequence that minimises rework and lets each step lock in the previous:

1. **Hour 1 — Easy wins** (3.1 dead `void`s, 3.6 gitignore, 2.1 rename `project-mock-data.ts`, 1.8 `LIMIT` constant). Pure renames + deletions, low risk.
2. **Hour 2 — Formatters & spinner** (1.4 currency, 1.5 date, 1.6 spinner, 1.7 status tones). All thin extractions; visible polish.
3. **Hour 3 — Query-keys factory cleanup** (1.10) + (3.5 `lib/auth.ts` env routing through config). Improves invalidation correctness immediately.
4. **Hours 4–5 — Backend schema/auth extraction** (1.1 `orgScope`, 1.2 `idParams`/`listQuery` schemas). Touches lots of files but mechanical; do under a single PR with the type-checker on.
5. **Hours 6–8 — Split mega-files** (4: proposal-workspace.tsx tabs, proposals/repository.ts sub-domains). Higher review surface; keep behaviour identical.
6. **Day 2 — Brand-colour tokens** (5.4). Codemod + Tailwind config rework.
7. **Eventually — CRUD page shell** (1.9) and **CRUD hook factory** (1.11). These are the highest-effort lowest-rush items; do them once you have tests so you can confirm zero regressions.
8. **Parallel track — Tests** (§6). Start the moment any of the above lands.

**Items I explicitly recommend NOT doing:**
- ❌ Don't blanket-extract `toX(row)` mappers (1.3) — they have small projections that matter.
- ❌ Don't build a generic `CrudTablePage` mega-component — abstract too early and the next feature won't fit.
- ❌ Don't rename ID prefixes (`mlst`, `est`, `evt`) — they're embedded in URLs and DB.

---

## 8 · Quick stats footer

| Category | Count |
|---|---:|
| 🔴 High-impact items | 9 |
| 🟡 Medium-impact items | 12 |
| 🟢 Already-clean / spot-check / not worth doing | 8 |
| **Estimated total effort (all 🔴+🟡)** | **~14 hours** |
| **LOC removed in DRY pass** | **~600–800** |
| **Tests added** | **0** (separate effort) |

Generated at /Users/drhendrix/projects/buildpanda/core/docs/refactoring-report-2026-06-13.md
