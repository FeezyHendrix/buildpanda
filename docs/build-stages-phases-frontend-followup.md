# Build Stages — Frontend Follow-Up Once Building Phases API Lands

> Companion to `build-stages-phases-backend.md`. That doc specs the backend
> work; this one is the frontend checklist for the pass that comes *after*
> it ships. Nothing here is urgent today — the current frontend is a working
> demo (`pages/project/stages.tsx`) built entirely on a local mock because
> there's no `building_phase_id` yet. The backend shipping doesn't break or
> auto-fix anything on the frontend; it just makes the mock below obsolete
> and swappable for the real thing. Budget this as one focused follow-up
> task, not a redesign — none of the UI/UX (collapsed edit row, demarcated
> metric cards, drag-and-drop interaction, search behavior) needs to change
> visually.

## 1. What's mock today, and why

Everything phase-related in `stages.tsx` is frontend-only because the
`stages` table has no `building_phase_id` column:

- **`phases` state** — a local `string[]` seeded from `PHASE_ORDER`
  (`Pre-Construction`, `Sub-structure`, `Services`, `MEP`, `Finishes`),
  mutated via `setPhases`. Not persisted — resets on reload.
- **`phaseAssignment` / `phaseAssignCounter` refs + `phaseByStageId` memo** —
  a round-robin "which phase does this stage belong to" simulation. A
  stage's phase is decided once, the first time its id is seen, and cached
  in a `useRef<Map<string, string>>` so it survives reordering/searching
  without visibly corrupting (see §3 — this was a real bug that got patched
  locally, twice). It is still not the stage's real phase; it's a stand-in.
- **`grouped` memo** — builds the phase-grouped list the accordion renders
  from the mock assignment above.
- **`handleCreatePhase`** — appends to local `phases` state. Not persisted.
- **`startInlinePhaseEdit` / `commitInlinePhaseEdit`** — renames a phase in
  local `phases` state and patches the `phaseAssignment` ref's stale values
  so already-assigned stages don't get orphaned by the rename. Not
  persisted.
- **Drag-and-drop reorder (`StageRow`'s `handleDrop` → `onMove` → `move` in
  the parent)** — calls the *existing* flat `PATCH .../stages/reorder`, so a
  drag only reorders the global stage list. It has no concept of "move this
  stage within Sub-structure" because there's no phase-scoped reorder
  endpoint yet.

## 2. What gets deleted once the API lands

- `phases` local state and `PHASE_ORDER` constant.
- `phaseAssignment`, `phaseAssignCounter` refs and the `phaseByStageId` memo
  in their entirety — this whole apparatus exists solely to fake a
  `building_phase_id`. Once stages carry a real one, grouping is a plain
  `.filter()` / group-by on that field, no assignment logic needed.
- The manual grouping logic inside the `grouped` memo (status/progress
  derivation from a stage list can stay — only the *assignment* part goes).
- The rename-patches-stale-ref-values workaround in `commitInlinePhaseEdit` —
  unnecessary once the server is the source of truth for phase names.

## 3. What gets rewired to real endpoints

| Today (mock) | After (real API) |
|---|---|
| `phases` state, seeded from `PHASE_ORDER` | `useBuildingPhases(projectId, buildingId)` — new hook, `GET /projects/:projectId/building-phases` |
| `handleCreatePhase` → `setPhases(prev => [...prev, name])` | `useCreateBuildingPhase()` mutation → `POST /building-phases`, invalidate the phases query |
| `commitInlinePhaseEdit` → `setPhases(prev => prev.map(...))` | `useUpdateBuildingPhase()` mutation → `PATCH /building-phases/:phaseId` (request/response shape already in `build-stages-phases-backend.md` §5) |
| `StageRow`'s `handleDrop` → flat `onMove`/`reorderStages.mutate` | Send `buildingPhaseId` on reorder once the phase-scoped reorder endpoint ships (`{ stageIds, buildingPhaseId }`), so a drag genuinely reorders *within* a phase instead of the whole flat list |
| **Add New Stage** drawer's **Building Phase** `Select` — populated from local `phases` | Populated from `useBuildingPhases()`; **+ Add Building Phase** link calls the real create mutation |
| Stage creation — phase membership implied by round-robin, never actually sent to the backend | `createStage.mutate({ ..., buildingPhaseId })` — a real, required field |

## 4. Known bugs in the mock that a real column removes structurally

Both of these were patched locally in `stages.tsx` (persistent
`phaseAssignment` ref instead of deriving from live array position/index) —
worth knowing about since the patches themselves become dead code to remove
per §2, not something to preserve or port forward:

1. **Search/filter reshuffle** — grouping used to be computed from the
   *filtered* array's index, so searching changed which phase a matching
   stage appeared under (or made its real phase show "no stages").
2. **Drag-and-drop reshuffle** — reordering refetches `stages` in a new
   order; grouping computed from live array index reshuffled every stage's
   phase, not just the one dragged.

A real `building_phase_id` means grouping is a stable, persisted fact rather
than a derived index — this class of bug becomes structurally impossible,
not just patched around.

## 5. Suggested order of work for the follow-up pass

1. `api/stages.ts` — add `buildingPhaseId` to `StageInput` and list params;
   add `api/building-phases.ts` (or extend `api/stages.ts`) for the new
   endpoints.
2. `hooks/use-stages.ts` / new `hooks/use-building-phases.ts` —
   `useBuildingPhases`, `useCreateBuildingPhase`, `useUpdateBuildingPhase`.
3. `pages/project/stages.tsx` — swap mock state/refs for the new hooks per
   §2–3, delete the dead assignment logic, wire `buildingPhaseId` through
   stage create/reorder.
4. `upsert-stage-dialog.tsx` (Add New Stage drawer) — Building Phase select
   sourced from real data.
5. Manual QA: rename a phase, add a phase, drag-reorder within and across
   phases, search while a phase has 0 real stages — confirm none of §4's
   bugs resurface now that grouping isn't index-derived.

## 6. Explicitly NOT changing

- Visual design: collapsed single-input edit row, demarcated `MetricCard`
  title/data split, drag handle icon and cursor states, search bar and
  status-filter pills.
- `PriorityBadge`/`StatusBadge` styling, table column layout.
- Any of `docs/build-stages-phases-backend.md`'s schema/API contracts — this
  doc assumes that spec ships as written.
