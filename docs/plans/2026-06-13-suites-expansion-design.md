# BuildPanda Suites Expansion — Design & Implementation Plan

## Summary

This plan adds two new project "suites" — **Interiors** and **Facilities** — alongside the existing **Build** suite, as three workspaces inside the one app. The entire expansion rests on a single backbone decision: a project is discriminated by a new `projects.project_type` column (`build | interior | facility`, default `build`, auto-backfilled). A facility/interiors project **is** a `projects` row — it reuses `project_participants`, `project_documents`, `finances`, `project_invoices`, `approvals`, `comments`, `notifications`, `files`, and the existing RBAC catalog verbatim. There are no parallel project tables.

New suite content (Interiors **selections**, Facilities **assets**, **work orders**, **preventive-maintenance schedules**) lands as net-new modules following the `materials-equipment` four-file scaffold (`types/repository/service/routes`), each mounted under the existing `/projects/:id/...` namespace and each enforcing a **single reusable suite guard** that returns 404 when a project's `project_type` does not match the module's suite — so a build project's id is indistinguishable from "not found" on an interiors route.

The plan is explicitly **incrementally shippable**: the backbone + an empty-but-correct suite shell ships first and de-risks the discriminator and guard, then exactly one content module (Interiors selections) proves the scaffold, then Facilities assets + work orders, and only last the PM recurrence engine (which hard-depends on `work_orders` existing).

This document folds in every blocker and major from the three critique passes. The most consequential corrections versus the raw specs:

| Corrected | Was (in raw specs) | Now |
|---|---|---|
| Invoice FK target | `.inTable("invoices")` | `.inTable("project_invoices")` (the real table) |
| `project_type` migration | 4 conflicting files (`20260613`/`20260614`/`20260622`) | **ONE** backbone-owned migration `20260624_project_type.ts` (dated after the newest applied `20260623`) |
| Migration date floor | `20260613`/`20260614` (sort **before** applied `20260620`–`20260623` → never run) | All new migrations dated `20260624+` |
| Resource key casing | mixed `work_orders` / `workOrders` | camelCase everywhere (`workOrders`, `pmSchedules`) to match existing `dailyLog`/`teamMembers` |
| PM idempotency | `claim.rowCount` (undefined in Knex+pg → always false-skips) | `.onConflict(...).ignore().returning("id")` + `claim.length === 0` |
| Sidebar nav arrays | imported from `project-sidebar.tsx` (private `const`, circular) | extracted to leaf `lib/nav-entries.ts` |
| `selections` resource | two definitions (`view,manage` vs `+decide`) | one: `view,manage`; sign-off reuses `approvals:decide` (homeowner-only) |
| `work_orders` schema | defined twice incompatibly (facilities vs PM) | facilities-core owns it; PM only `alterTable`s back-link columns |
| Suite switcher active state | derived from `localStorage`/pathname inside `/project/*` | derived from `project.projectType` |
| `project_documents` coupling | facilities adds `asset_id`/`work_order_id` columns | rejected; facilities uses jsonb `image_file_ids` (same pattern as interiors) |
| `vendor` participant role | granted broad read via `requireProjectAccess` | deferred to v2 + hardened (see Deferred) |

---

## Architecture

### project_type backbone

`projects` gains `project_type text NOT NULL DEFAULT 'build'` with a `CHECK (project_type IN ('build','interior','facility'))`. Postgres applies the column DEFAULT to all existing rows at `ADD COLUMN` time, so every existing project is backfilled to `build` with **no separate UPDATE**. This single migration is owned by the backbone layer; the suite specs depend on it and never re-declare it.

Discriminator values are **singular** (`build`/`interior`/`facility`, mirroring the existing `build`); the suite ids and URL namespaces are the **plural** human-facing form (`build`/`interiors`/`facilities`). The singular↔plural mapping lives in exactly two places: `PROJECT_TYPE_TO_SUITE` (frontend `lib/suite-config.tsx`) and the per-module `SUITE` constant (backend). Note: the create-wizard's existing `"build"|"renovate"|"invest"` union is a **separate concept** (homeowner intent, stored in `projects.setup` jsonb) and is NOT the discriminator.

`project_type` is **immutable after creation** (resolves critique missing-piece). The projects update route never accepts `project_type`; there is no path to flip a project's suite, so child rows can never be orphaned/exposed in the wrong suite.

The discriminator surfaces on `ProjectRow.project_type` (DB) → `Project.projectType` (API DTO) → frontend `Project` interface, enabling the layout, sidebar, switcher, and suite dashboards to branch.

### Suite routing

Three suites are **workspaces in one app** with a top-bar switcher. Three thin workspace-dashboard routes (`/build`, `/interiors`, `/facilities`) are added beside the existing `/dashboard` and `/sales`. The **project workspace stays at the single `/project/:projectId` layout** for all suites — there is no `/build/project/...` vs `/interiors/project/...` duplication. This deliberately avoids triplicating the ~40-child flat route table and the alias-double-mount footguns. The suite is derived from the loaded project's `projectType` inside `ProjectLayout`; the switcher only swaps the workspace dashboard/list, not the project deep-link.

### Gating guard — `requireProjectSuite(id, suite)` (404 on mismatch)

**One canonical implementation** (resolves the four-way divergence blocker). A request decorator in `auth-context.ts`, composed on top of `requireProjectAccess` so it inherits the full read-access check (owner / org member / active participant) and reuses the already-loaded `ProjectRow` (no second DB query). On a `project_type` mismatch it throws `NotFoundError("Project")` — the identical error path as a missing project — so a wrong-suite id is indistinguishable from non-existent. There is no `assertInterior` / `assertProjectType` / inline variant; all four suite modules call this one decorator.

**Scope limit (stated explicitly, resolves the "guard is a security boundary" overclaim):** the 404 guard covers only the net-new suite routes (`selections`, `assets`, `work-orders`, `pm-schedules`). The **reused** subsystem routes (`documents`, `files`, `invoices`, `finances`, `approvals`, `materials`) remain suite-agnostic and will serve a facility/interiors project's data without a `project_type` 404. The guard is workspace-isolation / UX-grade, not a cross-subsystem security boundary. Where suite isolation at those endpoints matters (e.g. external vendor access), that is separate, explicit work — captured in **Deferred**.

**Write/permission composition (resolves the homeowner-write contradiction):** the guard is orthogonal to read/write/permission and to service-layer ownership checks. Patterns:
- Read route: `const project = await request.requireProjectSuite(id, "interior");`
- Company write route: `requireProjectSuite(id, "facility")` then `requireProjectWrite(id)` (404 before 403, so a wrong-suite project's existence is never leaked to a non-writer).
- **Homeowner-write paths (e.g. selection sign-off) use `assertCanActAsClient`, NOT `requireProjectWrite`** — because a `client` participant is not a writer and would be 403'd before any suite logic. Selection sign-off routes load the project via `projectsRepository.findById` and call `assertCanActAsClient`, exactly as the approvals decision route does today.
- Granular: `requireProjectSuite(...)` then `requireProjectPermission(id, "selections", "manage")`.

Service-layer ownership scoping (`row.project_id === projectId` → `NotFoundError`) is still required in every module — the suite guard does not cover child-entity cross-project leakage.

### Reused vs new

**Reused verbatim (no edits):** `files` + `lib/file-storage.ts` (uploads, `openStoredFile`), `documents` (versioning, project-scoped inline view), `approvals` + `assertCanActAsClient` (homeowner sign-off), `invoices`/`finances` (cost, `finances:approve` gate), `comments` (on approvals), `participants` reads + `auth-context` guards, `notifications` repository (new emit call sites), `lib/ids.ts` (`generateId`), `lib/errors.ts`, `lib/schemas.ts` (`idParams`), the BullMQ `QueueManager.startRepeating` infra.

**New:** one backbone migration (`project_type`); the `requireProjectSuite` decorator; modules `selections`, `assets`, `work-orders`, `facilities-pm`; resource keys `selections`/`assets`/`workOrders`/`pmSchedules`; frontend `lib/suite-config.tsx`, `lib/nav-entries.ts`, suite-dashboard page, suite-step.

---

## Data Model

All DDL below follows the project-domain conventions exactly: `text("id").primary()` (app-generated via `generateId`), `project_id notNullable + CASCADE`, optional FKs `nullable + SET NULL`, money/qty as `decimal(14,2)` (stored as strings, coerced in services), enums as `text` + top-of-file `as const` array + local `check()` helper + named raw `CHECK` (`<table>_<col>_check`), `[project_id, ...]` composite indexes, `useTz` timestamps defaulting to `knex.fn.now()`, `down()` = `dropTableIfExists` children-before-parents. The `user` table is **singular** (`.inTable("user")`). The invoices table is **`project_invoices`**.

### Migration 1 — `20260624_project_type.ts` (backbone, fully idempotent)

```ts
import type { Knex } from "knex";

const PROJECT_TYPES = ["build", "interior", "facility"] as const;
function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn("projects", "project_type");
  if (!hasCol) {
    await knex.schema.alterTable("projects", (table) => {
      // DEFAULT backfills every existing row to 'build' at ADD COLUMN time.
      table.text("project_type").notNullable().defaultTo("build");
    });
  }
  // Guard the constraint too (resolves duplicate-constraint blocker on re-run/replay).
  await knex.raw("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check");
  await knex.raw(
    `ALTER TABLE projects ADD CONSTRAINT projects_project_type_check CHECK (project_type IN (${check(PROJECT_TYPES)}))`,
  );
  // Composite index (better than single-column: per-suite lists filter by type+org).
  // Explicit name avoids Postgres 63-char default-name overflow.
  const hasIdx = await knex.schema.hasColumn("projects", "organization_id");
  if (hasIdx) {
    await knex.schema.alterTable("projects", (table) => {
      table.index(["project_type", "organization_id"], "projects_type_org_idx");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropIndex(["project_type", "organization_id"], "projects_type_org_idx");
  });
  await knex.raw("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check");
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("project_type");
  });
}
```

### Migration 2 — `20260625_selections.ts` (Interiors)

```ts
import type { Knex } from "knex";

const SELECTION_STATUS = [
  "Proposed", "ClientReview", "Approved", "Rejected", "Ordered", "Delivered", "Installed",
] as const;
function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("selections", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("category").notNullable();
    table.text("room");                          // denormalized label, nullable (no rooms table — see note)
    table.text("space");
    table.text("vendor");
    table.text("sku");
    table.decimal("unit_price", 14, 2).notNullable().defaultTo(0);
    table.decimal("quantity", 14, 2).notNullable().defaultTo(1);
    table.decimal("total", 14, 2).notNullable().defaultTo(0);   // service-computed = unit_price * quantity
    table.text("currency").notNullable().defaultTo("NGN");
    table.integer("lead_time_days");
    table.text("spec_notes");
    table.jsonb("image_file_ids").notNullable().defaultTo("[]"); // ordered files.id array (image-first)
    table.text("status").notNullable().defaultTo("Proposed");
    table.text("approval_id").references("id").inTable("approvals").onDelete("SET NULL");
    table.text("invoice_id").references("id").inTable("project_invoices").onDelete("SET NULL"); // real table name
    table.text("phase_id").references("id").inTable("project_phases").onDelete("SET NULL");
    table.text("requested_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "sort_order"]);
    table.index(["project_id", "category"]);
    table.index(["approval_id"]);
    table.index(["invoice_id"]);
  });
  await knex.raw(`ALTER TABLE selections ADD CONSTRAINT selections_status_check CHECK (status IN (${check(SELECTION_STATUS)}))`);
  await knex.raw("ALTER TABLE selections ADD CONSTRAINT selections_currency_check CHECK (currency IN ('NGN', 'USD'))");
  await knex.raw("ALTER TABLE selections ADD CONSTRAINT selections_quantity_check CHECK (quantity > 0)");

  await knex.schema.createTable("selection_alternates", (table) => {
    table.text("id").primary();
    table.text("selection_id").notNullable().references("id").inTable("selections").onDelete("CASCADE");
    // project_id dropped (resolves redundant-FK critique): scope derives from the parent selection,
    // which is always loaded for the ownership check. No denormalized column to drift.
    table.text("title").notNullable();
    table.text("vendor");
    table.text("sku");
    table.decimal("unit_price", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.integer("lead_time_days");
    table.text("spec_notes");
    table.jsonb("image_file_ids").notNullable().defaultTo("[]");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["selection_id", "sort_order"]);
  });
  await knex.raw("ALTER TABLE selection_alternates ADD CONSTRAINT selection_alternates_currency_check CHECK (currency IN ('NGN', 'USD'))");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("selection_alternates"); // child first
  await knex.schema.dropTableIfExists("selections");
}
```

**Room/space:** denormalized nullable `text` columns, **not** a `rooms` table (YAGNI — no grounded consumer needs room identity; "by room" rollups are `GROUP BY room`; the upgrade path to an `interior_rooms(id, project_id, name)` + nullable `room_id` FK is preserved if per-room sign-off/budgets ever appear).

### Migration 3 — `20260626_facilities.ts` (Facilities: assets + work orders) — owns `work_orders`

```ts
import type { Knex } from "knex";

const ASSET_STATUS = ["Operational", "NeedsService", "Down"] as const;
// Reconciled status machine (superset covering both facilities-core and PM needs):
const WO_STATUS = ["Open", "Scheduled", "Assigned", "InProgress", "OnHold", "Resolved", "Closed"] as const;
const WO_PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
const SVC_TYPE = ["Inspection", "Repair", "Maintenance", "Replacement"] as const;
const WO_SOURCE = ["manual", "pm_schedule"] as const;
function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  // ── assets (created before work_orders for the asset_id FK) ──
  await knex.schema.createTable("assets", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("category").notNullable();
    table.text("location");
    table.text("make");
    table.text("model");
    table.text("serial_number");
    table.text("status").notNullable().defaultTo("Operational");
    table.text("install_date");                   // display-string date
    table.text("warranty_expiry");
    table.text("notes");
    table.jsonb("document_file_ids").notNullable().defaultTo("[]"); // manuals: files.id array (no project_documents coupling)
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "category"]);
    table.index(["project_id", "warranty_expiry"]);
  });
  await knex.raw(`ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK (status IN (${check(ASSET_STATUS)}))`);

  // ── work_orders (canonical owner — PM only alterTables back-links later) ──
  await knex.schema.createTable("work_orders", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    table.text("location");
    table.text("category").notNullable().defaultTo("General");
    table.text("priority").notNullable().defaultTo("Normal");
    table.text("status").notNullable().defaultTo("Open");
    table.text("reported_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("assigned_to_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("due_date");                       // SLA target (display-string date)
    table.text("scheduled_for");                  // PM occurrence due date (display-string date)
    table.text("source").notNullable().defaultTo("manual"); // manual | pm_schedule
    table.timestamp("resolved_at", { useTz: true });
    table.timestamp("closed_at", { useTz: true });
    table.decimal("estimated_cost", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual_cost", 14, 2).notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("invoice_id").references("id").inTable("project_invoices").onDelete("SET NULL"); // real table name
    table.jsonb("photo_file_ids").notNullable().defaultTo("[]"); // work-order photos: files.id array
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "priority"]);
    table.index(["project_id", "due_date"]);
    table.index(["assigned_to_id"]);
    table.index(["asset_id"]);
  });
  await knex.raw(`ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (status IN (${check(WO_STATUS)}))`);
  await knex.raw(`ALTER TABLE work_orders ADD CONSTRAINT work_orders_priority_check CHECK (priority IN (${check(WO_PRIORITY)}))`);
  await knex.raw("ALTER TABLE work_orders ADD CONSTRAINT work_orders_currency_check CHECK (currency IN ('NGN', 'USD'))");
  await knex.raw(`ALTER TABLE work_orders ADD CONSTRAINT work_orders_source_check CHECK (source IN (${check(WO_SOURCE)}))`);

  // ── asset_service_history ──
  await knex.schema.createTable("asset_service_history", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("asset_id").notNullable().references("id").inTable("assets").onDelete("CASCADE");
    table.text("work_order_id").references("id").inTable("work_orders").onDelete("SET NULL");
    table.text("service_type").notNullable().defaultTo("Maintenance");
    table.text("summary").notNullable();
    table.text("performed_by");
    table.text("serviced_at").notNullable();
    table.text("status_after");
    table.decimal("cost", 14, 2).notNullable().defaultTo(0);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "serviced_at"]);
    table.index(["asset_id", "serviced_at"]);
  });
  await knex.raw(`ALTER TABLE asset_service_history ADD CONSTRAINT asset_service_history_type_check CHECK (service_type IN (${check(SVC_TYPE)}))`);

  // ── work_order_comments (mirrors approval_comments) ──
  await knex.schema.createTable("work_order_comments", (table) => {
    table.text("id").primary();
    table.text("work_order_id").notNullable().references("id").inTable("work_orders").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["work_order_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("work_order_comments");
  await knex.schema.dropTableIfExists("asset_service_history");
  await knex.schema.dropTableIfExists("work_orders"); // before assets (FK asset_id)
  await knex.schema.dropTableIfExists("assets");
}
```

Naming note: the `assets` table is a **project resource** distinct from `modules/assets` (the email-logo static route). The route folder for assets logic is `modules/facility-assets` (see Implementation Plan) to avoid namespace confusion; the table and resource key remain `assets`.

### Migration 4 — `20260627_facilities_pm.ts` (PM — alterTable back-links only; depends on `work_orders`)

```ts
import type { Knex } from "knex";

const FREQ_UNITS = ["day", "week", "month"] as const;
const WO_PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  // Add ONLY the PM back-link columns to the existing work_orders (owned by 20260626).
  await knex.schema.alterTable("work_orders", (table) => {
    table.text("pm_schedule_id").references("id").inTable("pm_schedules").onDelete("SET NULL");
    table.text("pm_occurrence_key");
    table.index(["pm_schedule_id"]);
  });
  // NOTE: the FK above requires pm_schedules to exist first; create it before the alterTable
  // in the actual file ordering. Shown in logical groups here for readability.

  await knex.schema.createTable("pm_schedules", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    table.text("location");
    table.integer("frequency_value").notNullable().defaultTo(1);
    table.text("frequency_unit").notNullable().defaultTo("month");
    table.integer("lead_days").notNullable().defaultTo(0);       // notify window
    table.integer("horizon_occurrences").notNullable().defaultTo(1); // generation horizon (decoupled from lead)
    table.text("default_assignee_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("default_priority").notNullable().defaultTo("Normal");
    table.text("anchor_date").notNullable();
    table.text("next_due").notNullable();
    table.text("last_generated_occurrence");
    table.boolean("active").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["active", "next_due"], "pm_schedules_active_next_due_idx");
    table.index(["project_id", "active"]);
    table.index(["asset_id"]);
  });
  await knex.raw(`ALTER TABLE pm_schedules ADD CONSTRAINT pm_schedules_freq_unit_check CHECK (frequency_unit IN (${check(FREQ_UNITS)}))`);
  await knex.raw("ALTER TABLE pm_schedules ADD CONSTRAINT pm_schedules_freq_value_check CHECK (frequency_value > 0)");
  await knex.raw("ALTER TABLE pm_schedules ADD CONSTRAINT pm_schedules_lead_days_check CHECK (lead_days >= 0)");
  await knex.raw("ALTER TABLE pm_schedules ADD CONSTRAINT pm_schedules_horizon_check CHECK (horizon_occurrences > 0)");
  await knex.raw(`ALTER TABLE pm_schedules ADD CONSTRAINT pm_schedules_priority_check CHECK (default_priority IN (${check(WO_PRIORITY)}))`);

  await knex.schema.createTable("pm_checklist_items", (table) => {
    table.text("id").primary();
    table.text("pm_schedule_id").notNullable().references("id").inTable("pm_schedules").onDelete("CASCADE");
    table.text("label").notNullable();
    table.boolean("required").notNullable().defaultTo(false);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["pm_schedule_id", "sort_order"]);
  });

  await knex.schema.createTable("work_order_checklist_items", (table) => {
    table.text("id").primary();
    table.text("work_order_id").notNullable().references("id").inTable("work_orders").onDelete("CASCADE");
    table.text("label").notNullable();
    table.boolean("required").notNullable().defaultTo(false);
    table.boolean("done").notNullable().defaultTo(false);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["work_order_id", "sort_order"]);
  });

  // Idempotency ledger: UNIQUE (pm_schedule_id, occurrence_key) is the sole double-create guard.
  await knex.schema.createTable("pm_generation_log", (table) => {
    table.text("id").primary();
    table.text("pm_schedule_id").notNullable().references("id").inTable("pm_schedules").onDelete("CASCADE");
    table.text("occurrence_key").notNullable();
    table.text("work_order_id").references("id").inTable("work_orders").onDelete("SET NULL");
    table.timestamp("generated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["pm_schedule_id", "occurrence_key"], { indexName: "pm_gen_log_schedule_occurrence_uq" });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pm_generation_log");
  await knex.schema.dropTableIfExists("work_order_checklist_items");
  await knex.schema.dropTableIfExists("pm_checklist_items");
  await knex.schema.alterTable("work_orders", (table) => {
    table.dropColumn("pm_schedule_id");
    table.dropColumn("pm_occurrence_key");
  });
  await knex.schema.dropTableIfExists("pm_schedules");
}
```

*(In the actual file, create `pm_schedules` **before** the `work_orders` alterTable that FKs it; the groups above are logical.)*

### Migration 5 — `20260628_suite_notification_types.ts` (ONE coordinated CHECK extension)

All new notification literals land in a **single** migration (resolves the drop/recreate clobber where three independently-authored migrations each hardcode a full list and the last one silently drops the others' literals). The full list is the union of all existing literals plus the new ones. Mirror every literal into the `NotificationType` union in `modules/notifications/types.ts` in the same PR.

```ts
import type { Knex } from "knex";

// Union of existing NOTIFICATION_TYPES + all new suite literals (single source of truth).
const TYPES = [
  "update_posted", "update_action_required", "inspection_scheduled",
  "milestone_released", "milestone_disputed", "document_uploaded",
  "selection_review_requested",  // interiors
  "work_order_assigned",         // facilities + PM (added ONCE)
  "work_order_resolved",         // facilities
] as const;
function check(v: readonly string[]): string { return v.map((x) => `'${x}'`).join(", "); }

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check");
  await knex.raw(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (${check(TYPES)}))`);
}
export async function down(knex: Knex): Promise<void> {
  const OLD = TYPES.filter((t) => !["selection_review_requested", "work_order_assigned", "work_order_resolved"].includes(t));
  await knex.raw("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check");
  await knex.raw(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (${check(OLD)}))`);
}
```

---

## Interiors Suite

### Module `modules/selections/` (4-file scaffold)

`types.ts` (snake_case `SelectionRow`/`SelectionAlternateRow` with money/qty as `string`, camelCase `Selection`/`SelectionAlternate` DTOs, `SelectionStatus` union), `repository.ts` (`selectionsRepository(db)` with aliased base + `leftJoin project_phases`, insert-then-refetch, KPI aggregate helpers), `service.ts` (mappers via `num()`/`money()`/`toIso()`, `SELECTION_FORWARD` transition map, business rules), `routes.ts` (default `FastifyPluginAsync`, registered in `server.ts`). ID prefixes `generateId("sel")` / `generateId("alt")`.

**Status machine** (service-enforced via `SELECTION_FORWARD`, `ConflictError` on illegal):

```
Proposed ──submit──▶ ClientReview ──client Approve──▶ Approved ──order──▶ Ordered ──▶ Delivered ──▶ Installed
   ▲ │                    │ │                            │
   │ └──Reject───────────▶Rejected◀──client Reject───────┘
   └──────re-propose──────┘
```

- Company writers drive `Proposed→ClientReview` (`submit`), `Approved→Ordered` (gated `finances:approve`), `Ordered→Delivered→Installed`.
- Homeowner drives the decision at `ClientReview` → `Approved`/`Rejected` only.

### Image-first

`image_file_ids` is a jsonb ordered array of `files.id` (first element = hero/thumbnail). On create and on any patch that changes the array, the service validates each id via `files.findById` → `NotFoundError("File")` if missing, `ForbiddenError` if `file.owner_id !== userId` (mirrors `documents/service.ts`). Inline viewing reuses the **documents project-scoped pattern**, not owner-scoped `/files/:id/download`: `GET /projects/:id/selections/:selectionId/images/:fileId/view` asserts selection∈project + interior, asserts `fileId ∈ image_file_ids`, then `openStoredFile(file.storage_path)` and streams with `content-type`. *Documented caveat (resolves confused-deputy minor): attaching a `fileId` grants every project reader inline view of any file the attaching writer owns, regardless of the file's origin project — the only gate is uploader-ownership at attach time. Project-scoping files is captured in Deferred.*

### Approval reuse — ONE decision entry point (resolves the two-path-divergence blocker)

Selection sign-off does **not** reimplement approvals; it orchestrates the `approvals` module, with **exactly one decision entry point**:

1. `submit` (company writer): `Proposed→ClientReview`; calls `approvalsService.create(projectId, { title: \`Selection: ${title}\`, category: "Interiors Selection", description }, userId)`; stores `approval.id` in `selections.approval_id`; emits `selection_review_requested` to the active `client` participant.
2. **The homeowner decides exclusively via the selections `/decision` route** — the raw `PATCH /projects/:id/approvals/:approvalId` route is **not advertised for selection approvals** (the frontend never links to it for selections). The `/decision` route: loads the project via `projectsRepository.findById`, calls `assertCanActAsClient` (passes for an active `client`; replicates the approvals route's bypass of `requireProjectWrite` so the homeowner isn't 403'd), then resolves the linked approval via `approvalsService.update`, then `selections.decide` reconciles `selections.status`.
3. **`selections.decide` is a pure idempotent function of the linked approval's resolved status:** it loads the selection, reads its stored `approval_id`, verifies the approval being resolved **is exactly that approval** (not any project approval — resolves the "approvals carry no type discriminator, client could approve a finance approval" major), maps `Approved→Approved` / `Rejected→Rejected`, and **no-ops if the selection is already in the target state**. `SELECTION_FORWARD` permits `ClientReview→Approved` and `ClientReview→Rejected`; the no-op guard means a repeated call never hits an illegal transition.
4. **Comments reuse:** discussion happens on the linked approval via existing `POST /projects/:id/approvals/:approvalId/comments` (gated `comments:post`). No selection-comments table.

This is why `selections` needs only `selections:view/manage` for org roles plus the homeowner's existing `approvals:decide` — no `selections:decide` action.

### Procurement link

`Approved→Ordered` via `POST .../order`, gated `requireProjectPermission(id, "finances", "approve")` (never `requireProjectWrite` alone — money transitions need the stricter gate). Body: `invoiceId` (link existing) or `createInvoice:true` (service calls the invoices service keyed to `projectId`: `vendorName = vendor`, `amount = total`, `currency`). Stores the id in `selections.invoice_id`. No new money tables.

**Cross-module wiring caution (resolves the deep-coupling minor):** the selections service composes `filesRepository`, `approvalsService`, `invoicesService`, and `projectsRepository`. The implementation must document and verify the exact side effects it triggers — specifically that `approvalsService.update` does not double-emit a notification that `selections.submit` already emitted. Prefer composing at the repository layer where a full service's business rules aren't needed.

### Alternates

Lightweight competing options (`generateId("alt")`), not independently approvable. `promoteAlternate` copies vendor/sku/unitPrice/leadTime/specNotes/imageFileIds onto the parent and recomputes `total`. Scope derives from the parent selection (no denormalized `project_id`).

### Interiors KPIs (SQL-cheap off `selections`)

`GET /projects/:id/selections/summary` returns: status funnel (`GROUP BY status`), pending client decisions (`status='ClientReview'`), committed spend (`SUM(total) WHERE status IN ('Approved','Ordered','Delivered','Installed')`), proposed spend, longest open lead time, by-room rollup (`GROUP BY room`), by-category rollup, install progress %.

---

## Facilities Suite

### Modules `modules/facility-assets/` + `modules/work-orders/` + `modules/facilities-pm/`

All 4-file scaffolds. ID prefixes: `ast` (asset), `svc` (service history), `wo` (work order), `woc` (comment), `pms` (pm schedule), `pmlog` (gen log), `woci` (wo checklist item).

**Asset ↔ work-order relationship:** one asset → many work orders (`work_orders.asset_id` nullable SET NULL; a WO can exist without an asset); one asset → many service-history rows (CASCADE). Resolving a WO with `asset_id` auto-appends an `asset_service_history` row (`service_type:'Repair'`, `work_order_id` link, `cost` from `actual_cost`) and may flip the asset `status`. `getAsset` denormalizes `openWorkOrders` count, `lastServicedAt`, and `manuals` (from `document_file_ids`).

**Work-order status machine** (service-enforced, `ConflictError` on illegal):

```ts
const WO_FORWARD = {
  Open:       ["Scheduled", "Assigned", "InProgress", "OnHold", "Closed"],
  Scheduled:  ["Assigned", "InProgress", "OnHold", "Open", "Closed"],
  Assigned:   ["InProgress", "OnHold", "Open", "Closed"],
  InProgress: ["OnHold", "Resolved", "Closed"],
  OnHold:     ["InProgress", "Assigned", "Closed"],
  Resolved:   ["Closed", "InProgress"],
  Closed:     [],
};
```
Side effects in `updateWorkOrder`: into `Resolved` → stamp `resolved_at` + append service history; into `Closed` → stamp `closed_at`; first assignment auto-bumps `Open→Assigned`.

**Cost gating (resolves missing-piece):** any WO PATCH that sets `invoice_id` or `actual_cost`, or the `/order`-style link/create path, is gated by `requireProjectPermission(id, "finances", "approve")` — **not** `requireProjectWrite` — so spend is never approvable by a plain company member. Cost reuses the `finances` resource; no `workOrders` cost action exists.

**Manuals/photos (resolves shared-table coupling major):** stored as jsonb `document_file_ids` (assets) / `photo_file_ids` (work orders) arrays of `files.id`, served via a project-scoped inline-view route — the **same pattern as interiors**, NOT by adding `asset_id`/`work_order_id` columns to the shared `project_documents` table.

**Assignment + notifications (resolves recipient-leak major):** before stamping `assigned_to_id` and before emitting any notification, the service **validates the target user is an org member of the project's organization OR an active `project_participant`** — rejects otherwise (`BadRequestError`). Only then emits `work_order_assigned` to the assignee (and `work_order_resolved` to `reported_by_id` on resolution). No notification is ever sent to a user not authorized to view the project. `notificationsRepository(db).create()` is the first emit call site (notifications was emit-unwired); recipient is the validated `assigned_to_id`, no fan-out helper.

### Recurrence engine (Facilities PM)

**Strategy: scheduled daily-semantics worker, reusing the existing `QueueManager.startRepeating` infra** — the `proposals/expiry-job.ts` hourly sweep (`INTERVAL_MS = 60*60*1000`, `manager.startRepeating(queue, intervalMs, processor, data)`) is the verbatim template. Chosen over lazy-on-read because PM work orders must materialize even when nobody opens a page, the lead/notify window needs a deterministic trigger, and a single serialized writer makes idempotency clean. Runs hourly; the sweep body is idempotent so same-day re-ticks find every occurrence already logged and skip.

**Idempotency (resolves the `rowCount` blocker):** `pm_generation_log` UNIQUE `(pm_schedule_id, occurrence_key)` is the sole guard. Per occurrence, inside one Knex transaction:

```ts
const claim = await trx("pm_generation_log")
  .insert({ id: generateId("pmlog"), pm_schedule_id: s.id, occurrence_key: occ })
  .onConflict(["pm_schedule_id", "occurrence_key"]).ignore()
  .returning("id");          // RETURNING with ON CONFLICT DO NOTHING → [] on conflict, [{id}] on insert
if (claim.length === 0) return null;   // already materialized → skip (NOT rowCount, which is undefined in knex+pg)
// ...insert work_order (source='pm_schedule', pm_schedule_id, pm_occurrence_key, scheduled_for, copy checklist)...
// ...update pm_generation_log.work_order_id...
```
`occurrence_key` = the ISO due date, deterministic from `anchor_date + k·(frequency_value, frequency_unit)`, so re-runs map to the same key. Two overlapping sweeps or a crash-replay converge to exactly one WO per occurrence.

**Generation horizon decoupled from lead window (resolves the mass-materialization major):** `horizon_occurrences` (default 1) controls how many upcoming occurrences a single tick may create; `lead_days` controls only when the assignee is notified. The sweep does **not** advance `next_due` past occurrences it only wants to notify about. A weekly schedule with `lead_days=30` notifies early but still creates one WO per occurrence, not four at once. Catch-up after an outage walks every missed occurrence (bounded by `maxCatchUp`, default 24) so nothing is silently lost.

**Sweep tenant re-validation (resolves the background-RBAC-bypass major):** `materializeOccurrence` re-loads the schedule's project and asserts `project_type === 'facility'` (deactivates the schedule otherwise), and re-validates `default_assignee_id` is still an active org member/participant before stamping it/notifying (nulls it and falls back to project `owner_id` otherwise). Background-generated work orders inherit no request-context RBAC and self-enforce tenant + assignment validity.

**Worker wiring:** `modules/facilities-pm/job.ts` exports `runPmSweep(db)` and `registerPmSweepWorker(db, manager)`; registered in `plugins/queue.ts` alongside `registerProposalExpiryWorker`. A manual `POST /projects/:id/pm-schedules/:scheduleId/run` shares the same idempotent path for on-demand/testing. *(BullMQ repeatable-job de-dup on redeploy is a known latent infra issue shared with the proposal-expiry job; captured in Open Questions.)*

### Facilities KPIs

`GET /projects/:id/facilities/dashboard`: assets by status (Down = alert tile), open work orders, overdue (SLA breach via `[project_id, due_date]` index), critical/high open, unassigned, resolved-this-week / MTTR, warranties expiring ≤90d (via `[project_id, warranty_expiry]` index), assets needing service, period spend.

---

## RBAC, Navigation & Terminology

### Capability matrix (ONE authoritative set, camelCase to match existing keys)

Four net-new resource keys, added to `statement` **and** to the three tier presets (adding to `statement` alone grants built-in roles zero actions). Keys use camelCase to match existing `dailyLog`/`teamMembers`/`orgProfile`.

| Resource | Actions | Suite |
|---|---|---|
| `selections` | `view`, `manage` | interiors |
| `assets` | `view`, `manage` | facilities |
| `workOrders` | `view`, `manage`, `assign`, `complete` | facilities |
| `pmSchedules` | `view`, `manage` | facilities |

`selections` has **no `decide` action** — homeowner sign-off reuses the existing `approvals:decide` via `assertCanActAsClient` (homeowner-only). This resolves both the two-definitions blocker and the dead-architect-grant major (architect cannot pass `assertCanActAsClient`, so granting architect a decide capability would be inert; architect sign-off is out of scope, captured in Open Questions).

**Org-role grants** (which preset each action lands in):

| resource:action | `constructionFull` | `constructionContributor` | `constructionReadOnly` |
|---|---|---|---|
| `selections:view` | ✓ | ✓ | ✓ |
| `selections:manage` | ✓ | ✓ | — |
| `assets:view` | ✓ | ✓ | ✓ |
| `assets:manage` | ✓ | — | — |
| `workOrders:view` | ✓ | ✓ | ✓ |
| `workOrders:manage` | ✓ | ✓ | — |
| `workOrders:assign` | ✓ | ✓ | — |
| `workOrders:complete` | ✓ | ✓ | — |
| `pmSchedules:view` | ✓ | ✓ | ✓ |
| `pmSchedules:manage` | ✓ | — | — |

Custom org roles need no migration (`organizationRole.permission` is free-form JSON; pre-existing custom roles simply lack the new keys until re-saved in the role builder). A unit test asserts every `statement` key is referenced by ≥1 route and every route resource string exists in `statement` (resolves the casing-mismatch silent-ForbiddenError class).

**Consistency requirement:** the backend `statement` + presets and the duplicated frontend `lib/permissions.ts` (`statement`, presets, `PROJECT_RESOURCES`) + `role-builder-dialog.tsx` (`RESOURCE_LABELS`, `ACTION_LABELS` for `assign`/`complete`) must change in the **same PR** — the role-builder must never surface an action the backend doesn't enforce, and stale custom roles must be re-saved to gain new capabilities.

### Participant role overlay

For v1, the new resources are **company-only** (org roles). The new `vendor` participant role is **deferred** (see Deferred) — adding it now would, by construction, over-expose every project read route to an external party, because `assertCanAccessProject` returns true for any active participant regardless of role and the many `requireProjectAccess` routes (invoices, finances, documents, materials) never consult the participant overlay. v1 ships no external-stakeholder access to facilities. Interiors homeowners reuse the existing `client` overlay (`selections:view` added to the `client` entry in `PARTICIPANT_PERMISSIONS`; decide power via the already-present `approvals:[view,decide]`).

### Nav-by-suite

The sidebar gains a `project.projectType` switch **paralleling** the existing `isClient` (relationship) branch — the two are orthogonal (a homeowner in an interiors project still gets the curated client portal). The company branch renders nav groups from `SUITE_CONFIG[suite].navGroups`. **One sidebar architecture** (resolves the two-competing-mechanisms major): `SUITE_CONFIG.navGroups` built from the leaf `lib/nav-entries.ts` arrays — not the rbac spec's separate-ENTRIES-branch approach.

| Nav group / entry | build | interiors | facilities |
|---|---|---|---|
| Overview, Updates | ✓ | ✓ | ✓ |
| Stages, Schedule, Milestone payments | ✓ | ✓ | hidden |
| Daily log, Inspections, Permits | ✓ | hidden | ✓ |
| **Selections** (group) | — | added | — |
| **Assets**, **Work Orders**, **PM Schedules** | — | — | added |
| Materials & Equipment, Finance, Documents | ✓ | ✓ | ✓ |
| Approvals, Queries | ✓ | ✓ | ✓ |
| Team & Admin | ✓ | ✓ | ✓ |

### Terminology

A `projectType → terms` map (`lib/suite-terminology.ts`), resolved once in `ProjectLayout` and threaded via Outlet context (`t(suite, key)`), so pages render suite labels without per-page conditionals.

| key | build | interiors | facilities |
|---|---|---|---|
| project noun | Project | Space | Facility |
| client/participant | Homeowner | Client | Facility manager |
| workItem | Activity | Selection | Work order |
| schedule | Schedule | Design timeline | Maintenance |
| materials | Materials & equipment | Materials & finishes | Parts & supplies |
| documents | Documents | Drawings & specs | Asset docs |

---

## Frontend Changes

- **`lib/nav-entries.ts` (NEW, leaf):** the `NAV_ENTRIES`, `SCHEDULE_ENTRIES`, `SITE_CONTROL_ENTRIES`, `MATERIALS_ENTRIES`, `FINANCE_ENTRIES`, `TEAM_ADMIN_ENTRIES`, `CLIENT_ENTRIES` arrays **moved out of** `project-sidebar.tsx` (they are private `const` today — confirmed) and exported here, with a single unified `NavEntry` type (`helper` optional). Both `suite-config.tsx` and `project-sidebar.tsx` import from this leaf → no circular dependency (resolves the circular-import blocker).
- **`lib/suite-config.tsx` (NEW):** `SUITE_CONFIG` (per-suite `projectType`, `href`, `label`, `matches`, `navGroups` composed from `nav-entries.ts`, `terms`), `PROJECT_TYPE_TO_SUITE`, `suiteForPathname`, `t()`.
- **`components/organisms/project-sidebar.tsx`:** import entries from `nav-entries.ts`; accept `suite` prop; render company nav from `SUITE_CONFIG[suite].navGroups`; keep the `isClient` branch and the `finances` exact-match active-state special-case; add exact-match special-casing for any new parent slug that is a prefix of a child (`selections`, `work-orders`).
- **`components/molecules/suite-switcher.tsx`:** drive `SUITES` from `SUITE_CONFIG` + keep the Sales entry; **remove `/project/*` from every suite's `matches`**; inside `/project/*` derive active suite from **`project.projectType`** (passed via context), not pathname/localStorage (resolves the contradictory-chrome major). One switcher component (not a separate `workspace-switcher.tsx`).
- **`layouts/project-layout.tsx`:** derive `suite` from `project.projectType`; extend Outlet context to `{ project, access, suite }`; pass `suite` to the sidebar and the switcher; mount `SuiteSwitcher` in the navbar.
- **`lib/project-types.ts`:** add `projectType: "build"|"interior"|"facility"` to the runtime `Project` interface.
- **`lib/permissions.ts` + `components/molecules/role-builder-dialog.tsx`:** mirror the four resources, presets, `PROJECT_RESOURCES`, and labels (same PR as backend).
- **`lib/route-guards.tsx`:** `homePathFor()` / `LAST_SUITE_KEY` resolve via `SUITE_CONFIG[last].href`.
- **`App.tsx`:** three `RequireCompany` suite-home routes (`/build`, `/interiors`, `/facilities`) rendering `<SuiteDashboard suite=…/>`; flat child routes under `/project/:projectId` for `selections`, `selections/:selectionId`, `facilities/assets`, `facilities/work-orders`, `facilities/work-orders/:workOrderId`, `facilities/pm-schedules`.
- **`pages/suite-dashboard.tsx` (NEW):** per-suite dashboard; calls the projects list with `?projectType=` filter (backend filter added — see Implementation Plan).
- **`components/molecules/suite-step.tsx` (NEW) + `pages/project/create.tsx` + `hooks/use-projects.ts`:** suite picker as create step 0 (reuses `OptionCard`); `CreateProjectInput.suite` → `project_type`.
- **Capability gating (resolves missing-piece):** `computeAccess()` in `participants/index.ts` gains suite-specific capability flags (`canManageSelections`, `canManageWorkOrders`, `canAssignWorkOrders`, etc.); pages/sidebar consume them via `useProjectContext().access.capabilities` exactly as `materials.tsx` consumes `canManage`.

---

## Implementation Plan

Dependency-ordered, each milestone a shippable PR-sized unit. Backbone first; suites layer on. The single biggest sequencing rule: **the `project_type` migration lands alone, first, before any suite module** — and every new migration is dated `20260624+` (after the newest applied `20260623`) or it will never run.

### Milestone 1 — Backbone: `project_type` discriminator + DTO

- Add `packages/backend/src/db/migrations/20260624_project_type.ts` (idempotent column + guarded CHECK + composite index).
- Edit `packages/backend/src/modules/projects/types.ts`: `ProjectType` union; `project_type` on `ProjectRow` + `NewProjectRecord`; `projectType` on `Project`; `suite?` on `CreateProjectInput`.
- Edit `packages/backend/src/modules/projects/service.ts`: `toProject()` maps `projectType`; `buildCreate()` writes `project_type: input.suite ?? "build"`.
- Edit `packages/backend/src/modules/projects/routes.ts`: create-body schema accepts optional `suite` enum (`["build","interior","facility"]`); GET list accepts `?projectType=` enum filter using `projects_type_org_idx`. **Do not** accept `project_type` on the update route (immutability).
- Edit `packages/frontend/src/lib/project-types.ts`: `projectType` on `Project`.
- Modules touched: `projects`. **Verify:** GET /projects/:id and GET /projects return `projectType` (contract test); existing build projects unaffected.

### Milestone 2 — Backbone: `requireProjectSuite` guard

- Edit `packages/backend/src/plugins/auth-context.ts`: add `requireProjectSuite(id, suite)` decorator + `declare module` entry; import `ProjectType`. Composes on `requireProjectAccess`, throws `NotFoundError("Project")` on mismatch.
- Add a unit test: guard returns 404 for wrong suite, 404 for missing, the row for a match.
- Modules touched: `auth-context`. **No route consumers yet** — pure infra.

### Milestone 3 — Backbone: frontend suite shell (empty-but-correct)

- Add `packages/frontend/src/lib/nav-entries.ts` (extract + export entry arrays, unify `NavEntry`).
- Add `packages/frontend/src/lib/suite-config.tsx` and `packages/frontend/src/lib/suite-terminology.ts`.
- Edit `project-sidebar.tsx` (import from leaf; `suite` prop; render `navGroups`), `suite-switcher.tsx` (`SUITE_CONFIG`-driven; active from `projectType`; drop `/project/*` match), `project-layout.tsx` (derive suite, extend context, mount switcher), `route-guards.tsx` (`SUITE_CONFIG[last].href`).
- Edit `App.tsx`: three suite-home routes + `pages/suite-dashboard.tsx`.
- **Verify:** build projects render identical Build nav; switcher reflects open project's suite; interiors/facilities workspaces show empty-but-correct nav.

### Milestone 4 — Backbone: project-creation suite picker

- Add `suite-step.tsx`; edit `create.tsx` (step 0; keep `build|renovate|invest` only for build suite) and `use-projects.ts` (`CreateProjectInput.suite`).
- **Verify:** creating an interiors/facilities project persists `project_type`; created project lands in the correct suite nav.

### Milestone 5 — Interiors content (proves the scaffold)

- Add migration `20260625_selections.ts`.
- Add `modules/selections/{types,repository,service,routes}.ts`; register in `server.ts`. Guard every handler with `requireProjectSuite(id, "interior")`; sign-off route uses `projectsRepository.findById` + `assertCanActAsClient`; `/order` uses `finances:approve`. POST returns 201; import `idParams` from `lib/schemas.ts`.
- Add `selections` to backend `statement` + 3 presets + `PARTICIPANT_PERMISSIONS.client`; mirror to frontend `permissions.ts` + `role-builder-dialog.tsx`. Add `computeAccess` flags (`canManageSelections`).
- Add `selection_review_requested` emit in `submit` (recipient = active `client` participant); add the literal to `NotificationType` (the CHECK migration is Milestone 8).
- Frontend: `pages/project/selections.tsx` (+ detail), nav entries in `suite-config.tsx` interiors group, App routes.
- **Verify:** selection lifecycle (submit → homeowner decide → order); image upload + project-scoped inline view; wrong-suite project 404s on `/selections`.

### Milestone 6 — Facilities content: assets + work orders

- Add migration `20260626_facilities.ts` (assets → work_orders → service history → comments; `project_invoices` FK; jsonb file arrays).
- Add `modules/facility-assets/` and `modules/work-orders/`; register in `server.ts`; guard `requireProjectSuite(id, "facility")`. WO assignment validates assignee is org member/participant before stamp + notify; cost paths gated `finances:approve`; resolve auto-appends service history.
- Add `assets`/`workOrders` to `statement` + presets; mirror to frontend; `computeAccess` flags.
- Add `work_order_assigned`/`work_order_resolved` emits; add literals to `NotificationType`.
- Frontend: facilities asset/work-order pages, nav group, App routes, KPI dashboard.
- **Verify:** asset register CRUD; WO lifecycle + service-history closure; notification only to authorized assignee; cost requires `finances:approve`.

### Milestone 7 — Facilities PM recurrence engine

- Add migration `20260627_facilities_pm.ts` (`pm_schedules`, `pm_checklist_items`, `work_order_checklist_items`, `pm_generation_log`; `alterTable work_orders` back-link columns). Depends on `work_orders` from Milestone 6.
- Add `modules/facilities-pm/{types,recurrence,repository,service,routes,job}.ts`; register routes in `server.ts` and worker in `plugins/queue.ts`. Idempotency via `onConflict(...).ignore().returning("id")` + `claim.length === 0`; horizon decoupled from lead; sweep re-validates `project_type==='facility'` + assignee authorization.
- Add `pmSchedules` to `statement` + presets; mirror to frontend; `computeAccess` flag.
- Frontend: PM schedule CRUD page, nav entry, App route.
- **Verify (test):** sweep run twice for the same occurrence creates exactly one work order; weekly schedule with `lead_days=30` creates one WO per occurrence; catch-up after a simulated outage backfills bounded missed occurrences.

### Milestone 8 — Coordinated notification-type CHECK migration

- Add migration `20260628_suite_notification_types.ts` (single union list: existing + `selection_review_requested` + `work_order_assigned` + `work_order_resolved`). Ensure `NotificationType` union already contains all three (added in Milestones 5–7).
- **Verify:** all three emit sites insert without CHECK violation; down() restores the pre-suite list.

*(Milestone 8's literals are referenced by emit code in 5–7 but the union list must be applied as one migration to avoid the drop/recreate clobber; in practice the emit code tolerates the literal being constraint-allowed only once this migration runs, so order 5→6→7→8 with the migration dated last.)*

---

## Testing Strategy

- **Migration idempotency:** run `20260624_project_type.ts` up→down→up; assert existing rows backfilled to `build`, CHECK present once, no duplicate-constraint error on replay.
- **Guard:** unit-test `requireProjectSuite` (match → row, wrong suite → 404, missing → 404, identical error shape to missing).
- **Contract:** `GET /projects/:id` and `GET /projects?projectType=interior` return/filter `projectType`; build projects unchanged.
- **Selections state machine:** legal/illegal transitions (`ConflictError`); `decide` idempotency (repeat call no-ops; verifies the resolved approval matches `selections.approval_id`, rejects an unrelated project approval).
- **Image scoping:** attach validates `owner_id === userId`; inline-view rejects a `fileId` not in `image_file_ids`.
- **PM recurrence (critical):** double-sweep → exactly one WO per occurrence; weekly + `lead_days=30` → one WO per occurrence (not 4); bounded catch-up after outage; sweep skips a schedule whose project is no longer `facility`; assignee re-validation nulls a now-unauthorized assignee.
- **WO cost gating:** member without `finances:approve` cannot set `invoice_id`/`actual_cost`.
- **Notification authorization:** assigning to a non-member/non-participant rejects; no notification emitted to an unauthorized user.
- **RBAC consistency test:** every `statement` key referenced by ≥1 route; every route resource string exists in `statement`; backend and frontend catalogs agree.
- **Frontend:** sidebar renders correct nav per `projectType`; switcher active state reflects open project; capability flags hide manage buttons for non-managers.

---

## Migration & Rollout Safety (zero-impact for existing build projects)

- **Auto-backfill, no downtime:** `ADD COLUMN ... NOT NULL DEFAULT 'build'` backfills every existing row in one statement; no separate UPDATE, no lock-heavy table rewrite of data (Postgres stores the default in catalog for the add). Every existing project is a `build` project and renders identical Build nav — the sidebar's company branch maps `build` → the same groups it has today.
- **Additive only:** all suite tables are net-new and CASCADE off `projects`; no existing table is altered except `projects` (one column) and `work_orders` (PM back-links, on a table that itself is net-new in this expansion). The `project_documents` shared table is **not** touched (coupling rejected).
- **Guard is non-breaking:** `requireProjectSuite` is only added to net-new routes. Existing routes are untouched; build projects never hit a suite guard.
- **Immutable discriminator:** the update route rejects `project_type`, so no build project can be flipped into a suite it has no data for.
- **Notification CHECK:** extended via a single coordinated drop/recreate that includes all existing literals — existing notifications keep validating.
- **Worker safety:** the PM sweep runs in both Redis and inline (no-Redis dev) modes via the existing `startRepeating`; it only touches `pm_schedules` rows (none exist for build projects).
- **Rollback:** each migration's `down()` is a strict inverse (drop children before parents, drop constraint before column); the project_type `down()` drops the index, constraint, then column, returning `projects` to its pre-expansion shape.

---

## Deferred (post-v1)

- **`vendor` participant role + facilities external access.** Adding `vendor` to `project_participants.role` now would over-expose every `requireProjectAccess` route (invoices, finances, documents, materials) to an external party, because `assertCanAccessProject` admits any active participant and those coarse routes never consult the participant overlay. Proper delivery requires: a participant-tier gate (non-`client` roles pass `requireProjectAccess` only for an explicit resource allowlist) OR converting facilities read routes to `requireProjectPermission`; a concrete row-level scoping column (`assigned_to_id` → resolve the vendor's `user_id` and filter, or add `assigned_participant_id`); and an audit confirming documents/finances/materials deny vendors. Until then v1 ships company-only facilities access.
- **Selection alternates UX extras:** moodboards, per-image captions/roles (would promote `image_file_ids` to a child table), per-alternate independent approval.
- **Rooms as entities:** `interior_rooms(id, project_id, name)` + nullable `selections.room_id` FK, only if per-room sign-off, per-room budgets, or floor plans become real (denormalized `room`/`space` text is a strict subset, lossless upgrade).
- **Project-scoped files:** add `project_id` to `files` (or validate upload context) so attaching a `fileId` cannot surface a file from another project; current gate is uploader-ownership only.
- **Architect selection sign-off:** would require changing the role-hardcoded `assertCanActAsClient` (or a capability-driven `selections:decide` path) — out of scope; v1 is homeowner-only.
- **Suite isolation at reused subsystem routes:** a `project_type` 404 on `documents`/`invoices`/`finances`/`approvals`/`materials` for wrong-suite ids (today the guard covers only net-new routes).
- **True cron for the PM worker:** add a `repeatCron?: string` option to `QueueManager.startRepeating` (`repeat: { pattern }`) for a wall-clock 06:00 run; the hourly-tick + idempotent body is sufficient for v1.
- **Selection comments / WO escrow / milestone-style WO cost release:** reuse approvals comments and invoices/finances for now.

---

## Open Questions

1. **PM cadence wall-clock:** is hourly-tick-with-day-gate acceptable for v1, or is a fixed 06:00 run required (needs the `repeatCron` infra extension)?
2. **BullMQ repeatable-job de-dup on redeploy:** the existing proposal-expiry job has the same latent issue (a new repeatable with the same key may stack in Redis without removing the old). PM's correctness tolerates duplicate schedulers (idempotent body), but should we add explicit `removeRepeatable` on startup for both jobs?
3. **Architect sign-off on interiors selections:** confirmed out of scope for v1 (homeowner-only via `assertCanActAsClient`). Is delegated-designer sign-off a near-term requirement that should reshape `assertCanActAsClient`?
4. **Facilities client participant:** should a `client` (homeowner) ever be added to a facility project? They get nothing in the overlay there, but the coarse approvals endpoint would still accept their decisions — recommend disallowing `client` on facility projects, or scoping it explicitly.
5. **`workOrders` cost approval granularity:** v1 reuses `finances:approve`. Do facilities need a distinct cost-approval capability separate from build/finance spend?
6. **Suite dashboard project list scale:** the `?projectType=` filter uses `projects_type_org_idx`; confirm the backend list route applies it server-side (not client-side over-fetch) for tenants with many projects.
7. **Module folder naming for assets:** the table/resource is `assets` but the existing `modules/assets` is the email-logo route — this plan uses `modules/facility-assets` for the new module. Confirm no tooling assumes folder name == resource name.
