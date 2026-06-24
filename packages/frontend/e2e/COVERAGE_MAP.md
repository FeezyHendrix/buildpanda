# BuildPanda E2E Coverage Map

> Generated from code (Phase A discovery). Modules are grouped by their domain
> namespace as declared in the frontend feature-flag keys (`pf("namespace.module", …)`
> in `packages/frontend/src/App.tsx`) and the Fastify route registrations in
> `packages/backend/src/server.ts`. "Stakes" are inferred from the code's
> behaviour — what breaks for the user/business if the flow fails.

## Architecture facts (do not generalize)

- **Frontend**: React Router SPA, dev server `:5173`, proxies `/api` → backend `:3000`
  (strips `/api`). Axios client `withCredentials: true`, baseURL `import.meta.env.VITE_API_BASE_URL || "/api"`.
- **Backend**: Fastify modular monolith, Knex + PostgreSQL. Routes mounted at root
  (NOT `/api`-prefixed); the frontend reaches them via the Vite proxy.
- **Auth**: Better Auth. Sign-in `POST /api/auth/sign-in/email` `{ email, password }`,
  sign-up `POST /api/auth/sign-up/email` `{ email, password, name }`. Session is a
  cookie (`better-auth.session_token`). Rate limit ~10/60s on sign-in.
- **Authorization** (`lib/permissions.ts`): Better Auth org roles `owner | admin | member | viewer`.
  Self-declared `accountType` (`construction_company`, `project_owner`, `project_manager`)
  is presentation only — power comes from org membership + project participation.
  Backend guards: `requireProjectAccess` (read) vs `requireProjectWrite` (mutate).
- **IDs**: `generateId("prefix")` (`lib/ids.ts`) everywhere. Test data MUST use this
  format. Prefixes seen: `prj`, `task`, `tcol`, `board`, `ai` (action items),
  `rfi`, `chg`/`cr`, `telink`, `tlink`, `subtask`, `member`, etc.
- **Seeding**: `db/seeds/20260530_marbella.ts` creates a `sample-project` with child
  records but **no users / org membership** — cannot authenticate on its own. The
  E2E harness therefore self-provisions users + org + project through the API.

## Role projects (Playwright)

| Role project | accountType | org role | What it can do |
|---|---|---|---|
| `owner` | construction_company | owner | Full construction suite (create/update/delete across all project modules) |
| `member` | project_manager | member | Contribute (create/respond), limited delete |
| `viewer` | project_owner | viewer | Read-only across project modules |

> ASSUMPTION (see ASSUMPTIONS.md): exact viewer/member capability boundaries are
> derived from the `constructionFull` / `constructionContributor` presets; specs
> assert the boundary the code declares, and a missing guardrail fails by design.

## Top-level surfaces

| Route | Module | Stakes | Highest-risk flow |
|---|---|---|---|
| `/auth/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` | auth | Account access; a broken sign-in locks every user out | Sign-in + email-verification gating |
| `/dashboard`, `/dashboard/settings/team`, `/settings/notifications` | dashboard | Org home + member management | Inviting/removing org members |
| `/my-build` | dashboard (project list) | The user's project list; org-scoped | Active-org scoping (no cross-org leak) |
| `/project/create` | projects | Creating a project bootstraps org + board | Project creation atomicity |
| `/import` | import wizard | Bulk data import (BoQ/programme) | Partial-import integrity |
| `/sales`, `/sales/leads`, `/sales/proposals`, `/sales/proposals/:id`, `/sales/settings` | sales (pre-construction) | Lead → proposal → convert pipeline; revenue | Proposal **convert** (proposal → project) |
| `/accept-invitation/:invitationId`, `/accept-project-invite/:token` | invites | Onboarding; a broken invite blocks collaborators | Token redemption + account-mismatch |
| `/p/:token`, `/share/:token` | public proposal / file share | External-facing; data exposure risk | Token scope (no over-exposure) |
| `/privacy`, `/data-policy` | static | Compliance pages | n/a (smoke only) |

## Project modules (`/project/:projectId/*`)

| Route | Namespace.module | Stakes (real failure cost) | Upsert/list flow | Highest-risk mutation |
|---|---|---|---|---|
| `overview` | project | Project at-a-glance | read-only dashboard | n/a |
| `settings` | project | Project config / archive | settings form | archive/delete project |
| `updates` | project.updates | Site progress log w/ media | post update (`FormDrawer` + RichText) | media attach + project scoping |
| `chat` / `messages` | collaboration.messaging | Team comms, @mentions → notifications | send message | mention fan-out / realtime |
| `panda-ai` | ai.insights | In-app assistant answers from live data | ask question | tool data correctness |
| `people` | collaboration.participants | Who can access the project | invite participant | participant role grant |
| `documents` | projects.documents | Document store | upload doc | upload + delete (audit) |
| `team` | project.team | Off-platform team members | upsert team member (`FormDrawer`) | team member CRUD |
| `inspections` | quality.inspections | Quality gates / sign-off | request inspection | inspection sign-off transition |
| `daily-log` | quality.dailyLogs | Daily site record (legal/audit) | create log + image | **void** (audit trail must archive, not delete) |
| `bim` | projects.bim | 3D/model coordination | upload model | model position integrity |
| `action-items` | workflow.actionItems | Tracked to-dos w/ comments | upsert (`FormDrawer`) + comments | status transition + comments |
| `tasks` | projects.schedule | Kanban board; assignment, priority, labels, entity links | upsert task (`FormDrawer`), column reorder, link entities | move/reorder + entity-link conflict (unique) |
| `queries` | workflow.queries | Site questions | upsert query + comments | status transition |
| `rfis` | workflow.rfis | Requests for information; cost/schedule flags | create RFI, respond, transition | RFI→change-event conversion; response transition |
| `approvals` | workflow.approvals | Formal sign-offs | request approval + comments | approval decision transition |
| `change-requests` | workflow.changeRequests | **Cost & time impact** to budget | upsert change request | cost_impact / time_impact_days integrity |
| `permits` | compliance.permits | Regulatory permits / expiry | upsert permit | expiry tracking |
| `key-dates` | compliance.keyDates | Milestone dates | upsert key date | date integrity |
| `whats-next` | project | Next-actions view | read-only | n/a |
| `finances` | commercial.finances | **Money**: funding, milestone payments | fund project, upsert milestone | **fund-project** + milestone release (atomic, currency) |
| `finances/budget-allocation`, `finances/budget` | commercial.budget | Budget split across phases | allocate budget | allocation sum integrity |
| `finances/milestone-payments`, `milestones`, `schedules/milestones` | commercial.finances | Milestone-based payments | upsert + release milestone | **release** (payment, irreversible) |
| `finances/invoices` | commercial.invoices | **Vendor invoices + payments** | upsert invoice, add payment | payment recording (balance integrity) |
| `materials`, `materials/orders`, `materials/requests` | commercial.materialsEquipment | Procurement orders | upsert material order | order status |
| `material-log` | commercial.materialsLedger | **On-hand stock ledger** | record in/out entry | ledger balance (stock can't go negative-wrong) |
| `equipment-requests`, `equipment-requests/:bucket` | commercial.materialsEquipment | Equipment requests | upsert request | request status |
| `schedules/activities`, `activities`, `activities/:id` | projects.schedule | Programme activities (Gantt) | upsert activity | dependency/date integrity |
| `schedules/project-chart`, `project-chart`, `schedule` | projects.schedule | Gantt chart | read-only render | n/a |
| `schedules/stages`, `stages` | projects.schedule | Project stages | upsert stage | stage ordering |
| `schedules/key-dates` | compliance.keyDates | (alias of key-dates) | upsert | date integrity |
| `schedules/daily-log` | quality.dailyLogs | (alias of daily-log) | create | void/archive |

## Highest-risk mutations (flagship "hammer" specs)

> `saveRouteAssignments` does **not** exist in this codebase (the brief's example
> was hypothetical). The real transactional / integrity-critical mutations,
> ranked, are below. Each gets a deep spec: assert the guardrail surfaces in the
> UI, the transaction rolls back atomically (verified via API/DB, not just the
> screen), and a valid retry succeeds.

1. **Finances — fund project / milestone release** (`modules/finances/service.ts`): money
   movement inside a transaction; partial write corrupts funded/available balances.
2. **Invoices — record payment** (`modules/invoices/service.ts`): payment must keep
   `amount_paid`/`balance_due` consistent; concurrent payments must not over-pay.
3. **Materials ledger — stock entry** (`modules/materials-ledger/service.ts`): on-hand
   stock derived from ledger; a half-applied in/out entry corrupts inventory truth.
4. **Tasks — entity-link uniqueness** (`modules/tasks`): unique `(task_id, entity_type,
   entity_id)`; concurrent identical links must yield exactly one (409 on the dup).
5. **Tasks — move/reorder columns** (`modules/tasks/service.ts`): position integrity
   under concurrent drags.
6. **Proposals — convert to project** (`modules/proposals/service.ts`): one-shot
   conversion; double-convert must not create two projects.
7. **Participants — invite/redeem** (`modules/participants`): token redemption must be
   idempotent; account-email mismatch must be blocked.
8. **Change requests — cost/time impact**: budget-affecting values must persist exactly;
   RFIs must NOT affect budget (only change requests do).
9. **Budget allocation**: allocations across phases must not exceed the total.
10. **Daily log — void**: must archive (audit trail), never hard-delete.

## Coverage status (delivered)

Green across owner / member / viewer (104 passing + 3 skipped, deterministic
with a 1-retry safety net for the heavy dnd-kit tasks board).

**Deep upsert + persistence specs (13 modules):** tasks (create persists + edit
round-trip + default columns), action-items (upsert + edit round-trip), invoices
(**flagship** — payment balance reconciliation verified at the API/DB layer),
change-requests, rfis, queries, permits, key-dates, materials, milestone-payments,
inspections, stages, equipment-requests. All use the FormDrawer upsert pattern
and assert the post-invalidation DOM.

**Navigation reachability smoke (19 routes):** overview, updates, documents,
inspections, daily-log, bim, materials, material-log, equipment-requests,
finances, finances/budget, finances/milestone-payments, schedules/project-chart,
schedules/activities, schedules/stages, approvals, people, panda-ai, settings —
each asserted to mount without the error boundary and present its main landmark.

So **every project module has at least reachability coverage**, and 13 have deep
upsert coverage.

**Cross-role authorization (the brief's "authorization is not presentation"):**
an owner shares a project with another user as an active `client` participant
(via a direct `project_participants` insert == accepted invite, in
`fixtures/seed.ts`); a second viewer browser context then verifies the
participant can READ the project but is offered NO create action. See
`specs/authorization.spec.ts`.

**Logged product defect (test.fixme, kept out of the green count):**
- **Budget allocation** — creating a category via the "Add budget allocation"
  drawer closes successfully (form + API accept name + costCode), but the page
  still shows the "No budget allocation yet" empty state; the category never
  appears. Either a missing precondition (a project budget total must be set
  first?) or a create→list invalidation/display gap. See `specs/budget.spec.ts`.

**Remaining (bespoke flows, not the generic recipe):** activities (a template-
grid picker, not a simple form), daily-log (a day-grouped model whose entry
dialog drives a RichText editor), documents / bim (file-upload flows needing file
fixtures), updates (the `UpsertUpdateDialog` is a standard FormDrawer, but the
current page has no visible control that opens it — `createOpen` is never set to
true — so it needs a trigger or a deep-link to test). The `team` module is
intentionally skipped while another workstream refactors it.

## Suite structure

```
packages/frontend/e2e/
  playwright.config.ts          # env-driven (mirrors config/index.ts), 1 project per role, sharding
  config/env.ts                 # required()/optional() loader, same shape as backend config
  fixtures/
    api-client.ts               # raw HTTP client to the backend (seed/teardown), cookie auth
    ids.ts                      # generateId("prefix") format, collision-proof suffix
    auth.ts                     # sign-up/sign-in a role, return session cookie
    seed.ts                     # provision org + project + entities per role, idempotent teardown
    test.ts                     # extended `test` with per-role storageState + seeded project
  global-setup.ts               # provision role users, save storageState to .auth/
  pages/
    base-drawer.pom.ts          # FormDrawer upsert pattern (open/fill/save/assert)
    <module>.pom.ts             # one per module
  specs/
    <module>.spec.ts            # one per module, @smoke + @regression + per-module tag
```
