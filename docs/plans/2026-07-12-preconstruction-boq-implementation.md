# Preconstruction Drawings→BOQ Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PDF/DWG drawings in → AI-measured, QS-reviewed, priced BOQ out, with bid-pack export — per `docs/plans/2026-07-12-preconstruction-boq-design.md`.

**Architecture:** New backend module `modules/preconstruction` (routes → service → repository, factory functions). Measurement engine consumes pdfjs operator lists (CTM-tracked) → pseudo-layers by stroke style → dimension-text self-calibration with unit inference → deterministic measurement (parallel-pair walls, arc doors, tag counts, flood-fill floor areas). Review = row-scoped optimistic versioning + append-only audit + realtime channel. Frontend = new `preconstruction` page under house conventions.

**Tech stack:** Fastify + Knex (existing), `pdfjs-dist` 6.0 (existing), `xlsx` (existing), `@fastify/websocket` hub (existing `plugins/realtime.ts`), React + React Query + Tailwind (existing).

**Conventions:** `writing-backend-code` and `writing-frontend-code` skills are binding. `node:test` runner. Types in `types.ts` only; SQL in `repository.ts` only; schemas inline `as const`; enums as const arrays; migrations with up+down and CHECK enums; IDs via `generateId`.

**Verify each phase:** `pnpm --filter @buildpanda/backend test` green + commit.

---

## Phase 1 — Data model, module skeleton, upload

### Task 1: Migration
Create `packages/backend/src/db/migrations/20260712_preconstruction.ts` with tables (all IDs `t.string("id").primary()`):
- `precon_sessions`: id, project_id FK, status CHECK(`uploading|generating|reviewing|output|failed`), title, created_by, timestamps.
- `precon_sheets`: id, session_id FK, file_id (documents ref), page_number int, code, title, kind CHECK(`floor-plan|elevation|section|detail|schedule|unknown`), scale_mm_per_pt float null, scale_confidence float null, dim_unit CHECK(`mm|cm|m`) null, status CHECK(`pending|measured|unmeasurable`), snap_index jsonb null.
- `precon_bills`: id, session_id FK, title, sort int.
- `precon_boq_rows`: id, bill_id FK, sort int, row_type CHECK(`heading|work_section|spec_note|item|provisional_sum`), element_group, code, description, unit, qty_gross numeric, deductions jsonb (`[{label, qty, geometryId}]`), qty numeric, rate numeric, amount numeric, rate_source, confidence CHECK(`high|low`) null, status CHECK(`ai_generated|needs_review|verified|rejected`) null, version int default 1, measurement_basis text, verified_by, verified_at.
- `precon_geometries`: id, row_id FK, sheet_id FK, kind CHECK(`area|linear|count|deduction`), vertices jsonb, source CHECK(`ai|manual`), quantity numeric, unit.
- `precon_audit_events`: id, session_id FK, row_id, actor, action, before jsonb, after jsonb, created_at.
- `precon_summary_settings`: session_id PK/FK, prelims_pct default 5, contingency_pct default 5, vat_pct default 7.5.
- `precon_rate_cards`: id, org_id, name, region, currency default 'NGN'.
- `precon_rates`: id, rate_card_id FK, code_prefix, description_pattern, unit, rate numeric.
- `precon_compliance_docs`: id, org_id, file_id, doc_type, expiry_date null.
Run `pnpm --filter @buildpanda/backend db:migrate` against dev DB; verify `down` with rollback.

### Task 2: types.ts
`modules/preconstruction/types.ts`: const arrays (SESSION_STATUSES, SHEET_KINDS, ROW_TYPES, ROW_STATUSES, GEOMETRY_KINDS, DIM_UNITS, CONFIDENCES) + Row interfaces (snake_case) + DTOs (camelCase) + request body types + engine types (`ExtractedSheet`, `Segment`, `TextRun`, `StyleGroup`, `CalibrationResult`, `MeasuredBoqItem`).

### Task 3: repository.ts + service.ts + routes.ts skeleton
- Repository: session CRUD, sheets bulk insert/list, bills+rows bulk insert, rows list by session (join bills), row byId, versioned update (`where id+version`, returns count), audit append, settings get/upsert.
- Service: `createSession` (project-scoped), `getSnapshot(sessionId)` (session + sheets + bills + rows + settings + progress counts), DTO mappers.
- Routes (`/projects/:projectId/precon/...`): POST sessions (multipart upload → file-storage like takeoff routes), GET session snapshot. `requireAuth` + `assertCanAccessProject`/`assertCanModifyProject`. Register in `server.ts` behind feature flag `preconstruction` (add to `feature-flags/definitions.ts`).
- Test: service unit tests with fake repo (snapshot mapping, status transitions).
- Commit: `feat(precon): data model, module skeleton, session upload`.

## Phase 2 — Measurement engine

All engine files under `modules/preconstruction/engine/`, pure functions, no db/HTTP. Port the validated prototype (design doc §2) with these exact algorithms:

### Task 4: pdf-extract.ts
`extractSheet(page) -> {segments, curves, texts, styles}` — walk operator list tracking CTM stack (save/restore/transform), pdfjs 6.0 packed path format (op 0=moveTo 3 floats, 1=lineTo, 2=curveTo 7 floats, 3=close). Segments carry `{x1,y1,x2,y2,len,width,color}`; texts `{str,x,y,w,rotated}`. Unit test with a synthetic operator list (hand-built fnArray/argsArray).

### Task 5: calibrate.ts
Strict dimension matching: horizontal numeric texts 100–20000 ↔ horizontal segments (len 6–600pt, midpoint aligned ±max(4, len·0.25), perpendicular offset 0.8–10pt). Cluster ratios at 3% tolerance; confidence = biggest cluster share. Unit inference: multiplier ∈ {1,10,1000} minimizing distance to standard scales [20,25,50,75,100,125,200,250,500]. Also vertical dimensions (rotated text ↔ vertical segments). Tests: synthetic dims at 1:50cm and 1:100mm; noise rejection.

### Task 6: cluster.ts + classify.ts
- Grid-gap clustering of segments into drawing regions per page (connected 50pt-cell occupancy); classify region: floor-plan (has door arcs/room text/high orthogonal density) vs elevation/section/detail (fallback heuristics + title text beneath region).
- Pseudo-layer labeling: heaviest-pen group with parallel pairs → `walls`; pens owning dimension-matched segments → `dimensions`; light gray → `background`. Others `unknown`.

### Task 7: measure.ts
Per floor-plan region: parallel-pair walls (H/V sweep, gap 120–280mm, overlap ≥0.4m, each segment pairs once → centreline; blockwork m² = centreline × wallHeight 2.7 default); door arcs (bezier→circle fit via start/mid/end, r 600–1200mm, dedupe centres <300mm); tags `/^([WD])-? ?(\d{1,2})$/` counted per type; window opening groups. Floor areas: 50mm grid over region bbox, stamp wall segments (thickness from pair gap), flood-fill from alphabetic room-label texts inside region, closing radius 1 cell ×3 passes; emit m² per room name. Openings: door/window tags within 400mm of a wall pair → deduction entries (leaf width by tag schedule defaults: door 0.9×2.1, window 1.2×1.2 assumed, flagged low confidence). Tests: synthetic plans (rectangle room 4×3m in 225 walls → centreline, area, counts exact).

### Task 8: boq-draft.ts
Deterministic BESMM scaffolding: Bill 1 Preliminaries (static clause spec_note rows from a const template), Bill 2 Measured Works with element groups (Substructure/Frame/Walls/Windows and Doors/Finishes), work_section headings (F10 blockwork, L11 windows, L20 doors, M screeds…), spec_note preamble lines, then measured items (with geometry provenance, gross/deductions/net, confidence, measurement_basis, status `ai_generated`). Rows carry stable sort. Test: assemble from fixture MeasuredBoqItems, assert structure order + net math (gross − Σdeductions = qty always).

### Task 9: job.ts (generate worker)
Queue `precon-generate` via existing QueueManager. Per session: stream stored file to temp (copy takeoff `withTempDwg` shape), open with pdfjs, per page → extract → calibrate → cluster/classify → measure → persist sheet (scale/conf/status + snap index of segment endpoints) + partial results; after all pages → boq-draft → price (Phase 5 hook, no-op now) → bills/rows insert → session `reviewing`. Per-sheet try/catch (one bad page ≠ failed session); zero-paths → sheet `unmeasurable`. Publish progress events to realtime channel after each stage. DWG files: route into existing `runTakeoffEngine` and adapt result into the same row shape. Golden-file test: run engine (not job) against `_qa`-stored copy of the 36472 sample PDF page 2 fixture if present, else skip (fixture check at test start); assert scale 17.68±0.5, unit cm, tag counts (W11=7, D5=3), wall centreline 300–450m.
Commit per task: `feat(precon): <engine stage>`.

## Phase 3 — Review backend

### Task 10: versioned row PATCH
`PATCH /projects/:projectId/precon/rows/:rowId` body `{version, changes{description?, qty?, rate?, unit?}}` → service: transactional versioned update; recompute amount; append audit event; on version miss throw `ConflictError` (add to lib/errors if missing → 409) with current row in payload. Broadcast `row.updated` on channel. Tests: fake repo version-miss path; integration two-writer 409.

### Task 11: verify/reject
`POST .../rows/:rowId/verify|reject` → status transition rules (verify from ai_generated|needs_review; reject anytime non-verified), stamp verified_by/at, audit, broadcast. Progress = computed counts in snapshot.

### Task 12: geometry edit + server-side quantities
`PUT .../rows/:rowId/geometry` `{version, vertices, kind}` + `POST .../rows/:rowId/deductions` — service recomputes qty from vertices × sheet scale (shoelace area / polyline length / count), updates gross/net, audit, broadcast. Never trust client quantities. Unit tests for shoelace + length math at scale.

### Task 13: realtime channel
Extend `plugins/realtime.ts` subscribe handler: channels `precon:<sessionId>` authorize via project participation (session→project lookup), reusing hub. Service publishes `{type, rowId, version, changes, actor}`. Integration test: subscribe + patch → message received.

## Phase 4 — Frontend (load `writing-frontend-code` first)

### Task 14: route + API layer
`packages/frontend`: route `projects/:projectId/preconstruction` (+ session id param), stepper shell (existing tab/stepper components), React Query hooks (`usePreconSession`, mutations with version passing + 409 handling → toast + refetch), websocket subscription merging into query cache (copy messaging's pattern).

### Task 15: Upload + Generate steps
Upload: drawing dropzone (existing upload components) → create session; compliance vault list. Generate: progress stages fed by realtime events; "what Panda AI found" feed from sheet/measure events.

### Task 16: Review — cost panel
Virtualized grouped BOQ table (row_type-aware rendering), status dots, measurement breakdown card (gross → deductions → net), inline qty/rate edit with version, verify/reject buttons, review progress bar, draft total. House components/tokens only.

### Task 17: Review — viewer
pdfjs canvas page render per sheet tab; SVG overlay from geometries (status-coloured); shared pan/zoom transform; row⇄polygon two-way selection. Manual tools v1: area (polygon), linear (polyline), count (pins), deduction (rect) — vertices posted, server computes; snap-to-vertex from sheet snap_index; ortho lock (shift).

## Phase 5 — Pricing

### Task 18: rates
Rate card + rates CRUD (org-scoped routes), seed a starter NGN card. Pricer in engine hook: match `code_prefix` + unit (+ description similarity tie-break), set rate/amount/rate_source; unmatched → unpriced. "Save rate to library" endpoint from review edits. Summary settings endpoints; computed summary (prelims % → construction sum → contingency → VAT → grand total) in snapshot. Tests: matcher precedence; summary arithmetic vs Moniepoint numbers.

## Phase 6 — Output & integration

### Task 19: Excel export
`GET .../sessions/:id/export.xlsx` via `xlsx`: Cover Page, Preliminaries, bills with element summaries, General Summary (Moniepoint layout, S/N letters generated). Test: export → re-parse → totals reconcile with snapshot.

### Task 20: bid pack + proposals + Panda AI
ZIP endpoint (BOQ xlsx + vault docs) using existing archiver if present else store-only zip; "send to proposals" → create proposal + copy rows to `proposal_boq_items` via proposals service; Panda AI agent tools: `get_precon_boq_summary` (totals, progress, top items) + SYSTEM_PROMPT mention. Feature-flag gate checked end-to-end; CHANGELOG entry.

**Done criteria:** all backend tests green; engine golden test passes on sample PDF; frontend builds (`pnpm build:frontend`); manual flow: upload sample PDF → generate → review shows sheets+rows+overlays → verify → export xlsx opens.
