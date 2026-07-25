# Design: Preconstruction OS — Drawings → Reviewed BOQ → Bid Pack

Status: Validated in brainstorm, ready for implementation planning.
Date: 2026-07-12
Companion to: `2026-06-12-pre-construction-design.md` (the suite/leads/proposals
shell, since built). This doc covers the automated takeoff engine, the QS review
workspace, pricing, and bid-pack output.

## 1. Problem & goals

Contractors receive architectural drawings (almost always PDF) and must produce a
priced, professionally structured Bill of Quantities to bid. Today BuildPanda can
only run automated takeoff on DWG files (`panda-ai/automated-takeoff`), and BOQ
import only ingests already-prepared bills. The gap: **PDF drawings in → reviewed,
priced, exportable BOQ out**, with a human QS verifying every AI output.

Product shape (UX validated against the stitch mockups in
`screenshots/stitch_buildpanda_preconstruction_os/` — **UX reference only**; the
UI uses BuildPanda's existing design system and frontend conventions):

1. **01 Upload** — drawings + compliance documents.
2. **02 Generate** — Panda AI measures drawings, drafts the BOQ structure,
   preambles and work programme; progress streamed live.
3. **03 Review** — the core of the product: split-pane workspace (drawing viewer
   with measurement overlays ⇄ cost verification panel). Every AI row is a draft
   until a human verifies it ("No Blind Trust").
4. **04 Output** — bid pack: BOQ (Excel/PDF), preambles, programme, compliance
   docs from the vault, exported as ZIP or sent to Proposals.

Reference BOQ format: `Priced Moniepoint Dar-Es-salam Branch Abuja BoQ` (real
Nigerian QS bill) — multi-bill workbook, BESMM/SMM7 work sections, unpriced spec
notes interleaved with priced items, element summaries, General Summary with
prelims %, contingency %, VAT 7.5%, provisional sums.

## 2. Key technical findings (validated on a real drawing)

Tested against `36472-1._architectural_final.pdf` (14-page A3 ArchiCAD export):

- **Vector extraction beats rasterization.** CAD-exported PDFs are vector; pdfjs
  (`pdfjs-dist` 6.0, already a dependency) yields exact path geometry — 33,365
  paths on one page. No SVG intermediate needed: PDF → geometry directly via the
  operator list (with CTM/transform-stack tracking — coordinates are wrong
  without it).
- **Stroke style = pseudo-layer.** PDF loses DWG layer names, but CAD pens
  survive: the 33k paths collapse to **11 distinct (line-width, color) groups**
  that map to element types (heavy black = walls/linework, light gray = hatch/
  furniture, thin dark = dimensions…). Classification labels ~11 groups, not 33k
  paths.
- **Self-calibration from dimension text.** Match numeric dimension strings to
  the parallel line under them; ratio = scale. On the sample: 33 matches, 100%
  cluster agreement → 17.68 mm/pt = **1:50** with **unit inference** (dims were
  in cm; try mm/cm/m, keep the multiplier landing on a standard scale — 0.2%
  error). Cluster agreement is the confidence score.
- **Walls via parallel-pair detection**: two heavy parallel lines 120–280mm
  apart = a wall. Sample sheet: 369m centreline → 996 m² gross blockwork.
- **Doors two independent ways**: swing-arc circle-fit (r 600–1200mm, deduped by
  centre → 23 on sample) and tag text ("D5" × 3). Windows by tag ("W11" × 7).
  Cross-checking signals drives the confidence indicator.
- **Only part of a real BOQ is measurable.** Demolition, provisional sums,
  "Allow" items are QS judgment. Generate therefore produces measured items
  *plus* LLM-drafted structure (work sections, spec notes, prelims), all
  reviewable.

Prototype: scratchpad `proto2.mjs` from the brainstorm session (throwaway;
algorithms to be productionized in phase 2).

## 3. Architecture

New backend module `modules/preconstruction` (routes → service → repository).
The existing `panda-ai/automated-takeoff` engine moves in as the measurement
core behind a `TakeoffDoc` interface: entities (segments/arcs/text with
positions) + `groupName(entity)` — DWG returns CAD layer names, PDF returns
pseudo-layer labels. Everything downstream (wall measurement, signatures,
clustering) is shared.

### Data model (review-first — designed backwards from the Review screen)

- `precon_sessions` — one 4-step run per project: status
  (`uploading|generating|reviewing|output`), source files, totals.
- `precon_sheets` — one per drawing page: code ("ARC-101"), title, kind
  (floor-plan/elevation/section/detail), page number, calibrated scale +
  confidence, dimension unit.
- `precon_bills` — Preliminaries / Main Building / External Works…, ordered.
- `precon_boq_rows` — single ordered table per bill,
  `row_type: heading | work_section | spec_note | item | provisional_sum`,
  with element group. Only item/provisional rows carry qty/unit/rate/amount.
  AI-measured items also carry: gross qty, deductions (JSON:
  `{label, qty, geometryRef}`), net qty, confidence (`high|low`), status
  (`ai_generated|needs_review|verified|rejected`), `version` (optimistic
  concurrency), `measurement_basis` (human-readable audit line). S/N letters
  are generated at export, never stored.
- `precon_geometries` — provenance: `{row_id, sheet_id,
  kind: area|linear|count|deduction, vertices (sheet coords), source: ai|manual}`.
  Drives viewer overlays; what the QS redraws.
- `precon_audit_events` — append-only (same philosophy as `finance_events`):
  `{row_id, actor, action: measured|adjusted|verified|rejected, before, after}`.
  Renders "Measured by Panda AI · Reviewed by X."
- `precon_summary_settings` — prelims %, contingency %, VAT % (defaults
  5/5/7.5). Summaries always computed, never stored.
- `precon_rate_cards` / `precon_rates` — org-scoped rate library (region +
  quarter; work-section code + unit + description pattern → rate).
- `precon_compliance_docs` — vault: tags existing document records with type
  (CAC, tax clearance, PENCOM, BPP…) + expiry; reused across bids.

Drawings/compliance files reuse `documents`/`files` modules. Feature-flagged
rollout via `feature-flags`.

## 4. Step 02 — Generate (queue job, progress over realtime channel)

Per PDF, per page:

1. **Extract** — operator list → typed entities (segments/arcs/rects with
   stroke width+color; text runs with positions). Track the transform stack.
2. **Sheet classification** — title-block text names the tab; geometry density
   + text patterns classify sheet kind.
3. **Self-calibrate** — dimension-text matching as in §2; low agreement ⇒ sheet
   flagged, its items forced `needs_review`.
4. **Pseudo-layers** — group by stroke style; heuristics label (walls =
   parallel pairs at constant offset; dimension pens = pens dimension text sits
   on); **one LLM call per sheet** labels leftovers from a rendered image with
   groups highlighted. LLM names things; it never measures.
5. **Measure** — walls (centreline blockwork m²), doors (arcs + tags), windows
   (tags + opening groups), columns, sanitary; **floor areas** by rasterizing
   only the wall group at known scale and flood-filling from room-label text
   (morphological closing seals door openings) → m² per named room.
   Opening tags found within a wall run become **deduction entries** against
   that wall's gross (gross → deductions → net, the AI Measurement Breakdown).
6. **Draft structure** — LLM drafts bill/element/work-section skeleton, spec
   notes, prelims boilerplate around the measured items (BESMM-style).
7. **Price** — rate matcher (code + unit, description similarity tie-break);
   matched rows get rate/amount + `rate_source`; unmatched stay unpriced/amber.
8. **Persist** — every row with provenance, confidence, `ai_generated` status,
   audit event. Partial results persist per-sheet (one bad page ≠ lost file).

DWG files enter at step 4 equivalent with real layer names (existing engine).

## 5. Step 03 — Review

### Backend

- **Row-scoped optimistic concurrency**:
  `PATCH /projects/:id/precon/rows/:rowId {version, changes}` — transactional
  `WHERE version = ?`, increment on write; mismatch → 409 with current row
  (client offers refresh-and-reapply). No OT/CRDT — edits are row-scoped,
  conflicts rare, 409 makes collisions safe. (Multi-user item-level
  collaboration was the chosen model; true co-editing explicitly rejected.)
- **Verify/reject are distinct actions** (`POST .../rows/:rowId/verify`), not
  field edits: status transition + verified_by/at + audit event. Review
  progress = count over statuses, computed.
- **Geometry edits recompute quantities server-side** from vertices + sheet
  scale. The client never sends a self-computed quantity. One source of truth.
- **Realtime**: `precon:{sessionId}` channel on the existing hub
  (`plugins/realtime.ts`), membership = project participation. Mutations
  broadcast `{rowId, version, changes, actor}`; clients patch React Query
  caches. Presence is a later add on the same channel.

### Frontend (house conventions; mockups = UX only)

Route `projects/:id/preconstruction`, 4-step stepper. Review = two panes:

- **Viewer**: pdfjs canvas render per sheet (tabs from `precon_sheets`); SVG
  overlay in sheet coordinates for measurement polygons colored by status;
  shared sheet⇄screen transform for pan/zoom. Tools: select, area, linear,
  count, deduction; **snap-to-CAD-geometry** from a lazily-fetched per-sheet
  snap index (extracted vertices/intersections); ortho lock.
- **Cost panel**: virtualized BOQ table grouped by element; row types rendered
  distinctly; row ⇄ overlay two-way highlighting; measurement-breakdown card
  (gross → deductions → net, "Update & verify"); tabs for BOQ / Preambles /
  Work Programme; draft project total.

Panda AI awareness: add agent tools for BOQ totals, review progress, item
lookup (per the backend skill's Panda AI rule).

## 6. Step 04 — Output

- **Excel** via `xlsx` (existing dep) matching the Moniepoint layout: Cover
  Page, Preliminaries bill, measured bills with element summaries ("X to
  Summary"), General Summary (prelims % → Construction Sum → contingency % →
  provisional levies → VAT → Grand Total), provisional-sum schedules. PDF via
  the existing report pipeline.
- Vault docs attached; completeness % = verified rows + vault checklist;
  missing/expired docs flagged.
- Export ZIP; "Send to Proposals" creates a proposal from the session (existing
  `proposals` module + BOQ tables).

## 7. Error handling — degrade to Review, never fail silently

- **Scanned/raster PDF** (near-zero paths): sheets marked `unmeasurable`;
  manual takeoff tools still work; reason surfaced.
- **Low calibration confidence**: quantities produced but `needs_review`;
  manual two-click calibration affordance in the viewer.
- **LLM unavailable**: heuristic labels stand with low confidence; nothing
  blocks.
- **Job failures**: existing queue retry/markFailed pattern; per-sheet
  persistence.
- **Stale clients**: snapshot refetch on websocket reconnect; versions make
  reapply safe.

## 8. Testing

- **Golden files**: real PDFs as fixtures; assert scale (1:50 @ cm on the
  sample), wall centreline within tolerance, exact tag counts.
- **Unit**: calibration clustering + unit inference, parallel-pair walls, arc
  circle-fit, deduction math (gross − deductions = net, always).
- **Concurrency**: two writers, same row — one wins, one 409s.
- **Export**: generated Excel re-parsed; totals reconcile with DB.

## 9. Build order (each phase shippable behind the flag)

1. Data model + module skeleton + Upload.
2. Engine: extract → calibrate → pseudo-layers → walls/doors/windows/tags
   (productionize the validated prototype).
3. Review: BOQ table + viewer overlays + verify flow + realtime.
4. Manual tools (area/linear/count/deduction + snap) + floor areas.
5. Pricing + rates library + summary settings.
6. Preambles/programme drafts + Output/bid pack + Proposals hand-off.
