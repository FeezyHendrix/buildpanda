# Build Stages — Building Phases Backend Changes

> Required to support the new Figma: phase-grouped stages, phase-level progress, inline phase editing, and the **Add New Stage** / **Add Building Phase** drawers.

## 1. Summary

Current `stages` table is flat: `id, project_id, name, status, start_date, end_date, progress_percent, sort_order`.  
Figma groups stages under **Building Phases** (`Pre-Construction`, `Sub-structure`, `Services`, `MEP`, `Finishes` …) with per-phase progress, stage counts, reorder, and inline rename. `Building Phase` is a new first-class entity; `Stage` gains a `building_phase_id` FK.

No breaking change to existing stages — add phase table, add nullable FK, backfill a default phase per project.

**Why this is urgent, not cosmetic:** the current frontend groups stages into
phases by round-robin index (`stages[idx % phases.length]`) purely for demo
purposes, since there is no real `building_phase_id` to group by yet. This
round-robin has a real, user-visible bug: it computes `idx` from the
*filtered* stage list, so searching or status-filtering changes each matching
stage's index and can reassign it to a *different* phase than it showed under
before the search — e.g. search for a stage that's normally listed under
"Sub-structure" and it can appear grouped under "Pre-Construction" instead,
while "Sub-structure" shows "no stages" for that search. A second, worse
instance of the same bug: dragging a stage row to reorder it calls the
existing flat `PATCH .../stages/reorder`, which refetches `stages` in the new
order — reindexing *every* stage and reshuffling every stage's round-robin
phase, not just the one dragged, making the whole board look corrupted after
a single reorder. The frontend has patched both cases locally (`stages.tsx`):
`phaseByStageId` is now a persistent map keyed by stage id, assigned once the
first time a stage id is seen and never recomputed from the array's current
order, so reordering/searching/filtering no longer perturb existing
assignments; phase renames patch the map's stale values so already-assigned
stages don't get orphaned. This is still a demo assignment, not the stage's
real phase, and reorder is still only a flat list order — not "reorder within
a phase." Only a real `building_phase_id` column removes the class of bug
entirely (stable, persisted grouping instead of a derived index), and a
phase-scoped reorder endpoint (`{ stageIds, buildingPhaseId }`, §5) is needed
before drag-and-drop reordering can mean "move this stage within its phase"
rather than just the flat list.

## 2. Schema

### 2.1 New table `building_phases`

```sql
create table building_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade, -- null = whole project, matches stages.building_id pattern
  name text not null, -- e.g. "Pre-Construction"
  sort_order integer not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, building_id, name)
);
create index on building_phases(project_id, building_id, sort_order);
```

### 2.2 Alter `stages`

```sql
alter table stages add column building_phase_id uuid references building_phases(id) on delete set null;
create index on stages(building_phase_id, sort_order);
-- optional: enforce same project_id as phase via trigger or application check
```

`building_phase_id` is nullable for rollout; once backfilled it can be made `not null` if desired. `status` (`Pending`/`InProgress`/`Done`) stays on `stages`; phase status is **derived** (see §4).

## 3. Backfill

For each `project_id` (and `building_id` where stages are building-scoped):

```sql
insert into building_phases (project_id, building_id, name, sort_order)
select distinct project_id, building_id, 'General', 0 from stages
on conflict do nothing;

update stages s set building_phase_id = (
  select bp.id from building_phases bp
  where bp.project_id = s.project_id and coalesce(bp.building_id::text,'') = coalesce(s.building_id::text,'') and bp.name='General' limit 1
) where building_phase_id is null;
```

Replace `'General'` with a proper migration that creates the 5 default phases from the Figma (`Pre-Construction`, `Sub-structure`, `Services`, `MEP`, `Finishes`) if product wants them pre-seeded.

## 4. Derived fields (no new columns)

Phase-level data is computed, not stored — keeps `progressPercent` as source of truth on stages:

- `stageCount = count(stages where building_phase_id = phase.id)`
- `progressPercent = round(avg(stages.progress_percent))` or `sum(progress)/count` (match current overall calc) — `100%` when all stages `Done`, `0%` when all `Pending`, weighted if stages have different weights later
- `status` derived:
  - `Completed` if every stage `Done`
  - `In Progress` if any `InProgress` or mixed `Pending`/`Done`
  - `Not started` if every stage `Pending`
  - Frontend already maps `Pending` → `Not Started` badge.

If a phase has 0 stages, `progress=0`, `status=Not started`.

## 5. API — new / updated

### `GET /projects/:projectId/building-phases?buildingId=`
→ `BuildingPhase[] { id, projectId, buildingId, name, sortOrder, stageCount, progressPercent, status }` (last three derived in service).

### `POST /projects/:projectId/building-phases` `{ name, buildingId? }`
Returns `BuildingPhase`. Used by **Add Building Phase** drawer (`+ Add Building Phase` link in Add New Stage).

### `PATCH /projects/:projectId/building-phases/:phaseId` `{ name }`
Inline rename (pencil → input, Figma image 5 — the row collapses to *just* the
name input while editing; count/status/progress/edit-action hide until the
edit commits on Enter/blur or cancels on Escape).

Request:
```json
PATCH /projects/:projectId/building-phases/:phaseId
{ "name": "Sub-structure" }
```

Response `200`:
```json
{
  "id": "bp_123",
  "projectId": "proj_1",
  "buildingId": null,
  "name": "Sub-structure",
  "sortOrder": 1,
  "stageCount": 5,
  "progressPercent": 44,
  "status": "In Progress"
}
```

Errors: `404` if the phase doesn't belong to `:projectId` (or `:buildingId`
scope); `400` on empty/duplicate name (unique per `(project_id, building_id)`,
same constraint as create). Reorders via `sort_order` if drag-reorder of
phases is later needed.

### `DELETE /projects/:projectId/building-phases/:phaseId`
Block if `stageCount > 0` (or cascade `building_phase_id=null` — prefer block and prompt to move stages).

### Updated stage endpoints

- `POST /projects/:projectId/stages` now accepts `buildingPhaseId: string` (required after rollout). `Add New Stage` drawer sends `buildingPhaseId` from **Building Phase** `Select Phase`, `name` from **Building Stage** input.
- `PATCH /projects/:projectId/stages/:stageId` accepts `buildingPhaseId` for moving a stage between phases (drag across phase tables).
- `GET /projects/:projectId/stages?buildingId=&buildingPhaseId=` optional filter for phase tables.
- `PATCH /projects/:projectId/stages/reorder` already exists — extend to handle cross-phase reorder: body `{ stageIds, buildingPhaseId? }` or keep per-phase reorder (FE sends ordered ids per phase).
- `GET /projects/:projectId/stages` response can optionally include `buildingPhaseId` on each `Stage` so FE can group without N+1.

### Validation

- `name` trimmed, `1–80` chars, unique per `(project_id, building_id)`.
- `building_phase_id` must belong to same `project_id` (and `building_id` if both scoped) — 400 otherwise.
- Status values unchanged (`Pending`|`InProgress`|`Done`); `Progress` 0–100.

## 6. Permissions (match existing `schedule:manage`)

- `building-phases:*` reuses `canResourceAction(access,'schedule','manage')` — same gate as `stages:manage`. No new RBAC entry needed; add to `rbac-plan.md` if a finer `phase:manage` is desired later.

## 7. Frontend TODO once API lands

- `api/stages.ts` → add `buildingPhaseId` to `StageInput` and list params.
- `hooks/use-stages.ts` → add `useBuildingPhases` (+ create/update/delete), pass `buildingPhaseId` through.
- `pages/project/stages.tsx` → replace flat `stages` table with phase-grouped accordion — **done** (collapsible `Pre-Construction` etc., per-phase `Completed`/`In Progress` badges, `progress` bar, inline phase rename collapsing to just the name input, stage drag handles, per-phase stage tables, first phase open by default). Still TODO once the API lands: swap the local `phases` state + `phaseByStageId` round-robin mock for `useBuildingPhases` (real `GET`), point `startInlinePhaseEdit`/`commitInlinePhaseEdit` at the real `PATCH` (§5) instead of local `setPhases`, and drop the mock grouping now that each stage carries a real `buildingPhaseId`. **Add New Stage** drawer's **Building Phase** select and **+ Add Building Phase** link wire to real `building-phases` CRUD. Keep `useSetPageTitle` header and `Add Stage` action.
- `upsert-stage-dialog.tsx` → rename fields to Figma labels (`Building Phase`, `Building Stage`, placeholder `Placeholder`), keep `Status` `Select Status`, `Start Date`/`End Date` `DD/MM/YYYY` pickers, `Create New Stage`/`Save Changes` stacked footer.

## 8. Testing

- Migration up/down + backfill idempotency.
- `POST`/`PATCH`/`DELETE` building-phase authz (manage only).
- Stage create without `buildingPhaseId` → 400 after rollout, succeeds before.
- Move stage between phases updates both phases' `progress`/`status`.
- `stages.list` with `buildingPhaseId` filter returns only that phase's stages ordered by `sort_order`.

## 9. Rollout

1. Deploy migration + backfill (no code).
2. Deploy backend with new routes (FE still works — `buildingPhaseId` nullable).
3. Deploy frontend phase-grouped UI (sends `buildingPhaseId`).
4. Optionally enforce `building_phase_id not null` once no nulls remain.
