import type { Knex } from "knex";

// Pre-construction fixture: a 4-bedroom detached duplex at Lekki Phase 1,
// Lagos, measured from a seven-page architectural set. Revision B of the
// drawings supersedes revision A, so the take-off exists twice — the earlier
// session is kept and points at the one that replaced it, which is what the
// revisions screen compares.
//
// Bills, rows and geometries live in 20260798b_precon_bill.ts, the programme
// in 20260798c_precon_programme.ts and the organisation's rate library in
// 20260798d_precon_library.ts; all four hang off the ids below.

const PROJECT_ID = "sample-project";
const SESSION_ID = "pcs_seed_lekki_b";
const SESSION_R1_ID = "pcs_seed_lekki_a";
const SHEET_PREFIX = "psh_seed_";
const PDF_NAME = "Lekki-Duplex-Architectural-Set-RevB.pdf";
const PDF_PATH = "precon/seed/lekki-duplex/Lekki-Duplex-Architectural-Set-RevB.pdf";
const PDF_PATH_R1 = "precon/seed/lekki-duplex/Lekki-Duplex-Architectural-Set-RevA.pdf";

// Rows the seeded change sets act on; the ids are minted in 20260798b.
const ROW_EXTERNAL_BLOCKWORK = "pbr_seed_super_block_ext";
const ROW_WATER_FEATURE = "pbr_seed_ext_water_feature";

// A4 at 1:100 read by pdf.js: one PostScript point is 25.4/72 mm on paper,
// so 0.3528mm × 100 = 35.28mm on the building.
const MM_PER_PT_1_100 = 35.28;
const MM_PER_PT_1_50 = 17.64;
const MM_PER_PT_1_20 = 7.06;

type SheetSeed = {
  n: number;
  page: number;
  code: string;
  title: string;
  kind: string;
  status: string;
  scale: number | null;
  scaleConfidence: number | null;
  error?: string;
  viewports?: unknown[];
};

const SHEETS: SheetSeed[] = [
  { n: 1, page: 1, code: "A-101", title: "Ground Floor Plan", kind: "floor-plan", status: "measured", scale: MM_PER_PT_1_100, scaleConfidence: 0.94 },
  { n: 2, page: 2, code: "A-102", title: "First Floor Plan", kind: "floor-plan", status: "measured", scale: MM_PER_PT_1_100, scaleConfidence: 0.94 },
  // No scale bar and no dimension string survived the plot, so nothing on this
  // sheet can be measured; the roof was taken off the section instead.
  { n: 3, page: 3, code: "A-103", title: "Roof Plan", kind: "roof-plan", status: "unmeasurable", scale: null, scaleConfidence: null, error: "No scale bar or dimension string found on this sheet." },
  { n: 4, page: 4, code: "A-201", title: "Front and Rear Elevations", kind: "elevation", status: "measured", scale: MM_PER_PT_1_100, scaleConfidence: 0.88 },
  { n: 5, page: 5, code: "A-301", title: "Section A-A", kind: "section", status: "measured", scale: MM_PER_PT_1_50, scaleConfidence: 0.81 },
  // A schedule carries counts, not geometry: it is read, never measured.
  { n: 6, page: 6, code: "A-401", title: "Door and Window Schedule", kind: "schedule", status: "pending", scale: null, scaleConfidence: null },
  {
    n: 7,
    page: 7,
    code: "A-501",
    title: "Foundation and DPC Details",
    kind: "detail",
    status: "measured",
    scale: MM_PER_PT_1_20,
    scaleConfidence: 0.72,
    // A details sheet plots two scales side by side, so each drawing gets its
    // own window rather than the sheet scale being applied everywhere.
    viewports: [
      { id: "vp_seed_strip", label: "Detail 1 — Strip foundation (1:20)", rect: [36, 402, 318, 748], scaleMmPerPt: MM_PER_PT_1_20 },
      { id: "vp_seed_dpc", label: "Detail 2 — DPC junction (1:50)", rect: [330, 402, 612, 748], scaleMmPerPt: MM_PER_PT_1_50 },
    ],
  },
];

const STRUCTURE_CONTEXT = {
  structureClass: "building",
  buildingType: "Detached residential duplex",
  storeys: 2,
  structuralSystem: "reinforced-concrete-frame",
  foundationType: "strip",
  confidence: "high",
  signals: [
    "Column grid dimensioned at 3600mm centres on A-101",
    "Strip footing with 450mm wide toe detailed on A-501",
    "Two dimensioned floor plans and a two-storey section in the set",
  ],
};

const PROGRESS_LOG = [
  { at: "2026-09-08T09:12:04.000Z", phase: "reading", message: "Read 7 pages; 6 carry vector geometry." },
  { at: "2026-09-08T09:13:41.000Z", phase: "structure", message: "Reinforced concrete frame on strip footings, two storeys." },
  { at: "2026-09-08T09:15:02.000Z", phase: "schedules", message: "Door and window schedule on A-401 parsed: 14 doors, 19 windows." },
  { at: "2026-09-08T09:19:37.000Z", phase: "building", message: "Measured 5 sheets; A-103 skipped — no scale found." },
  { at: "2026-09-08T09:24:18.000Z", phase: "pricing", message: "Priced against Lagos Mainland & Island 2026 rate card." },
  { at: "2026-09-08T09:25:06.000Z", phase: "draft", message: "Draft bill ready for review: 45 lines, 12 flagged." },
];

export async function seed(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("precon_sessions"))) return;

  // Sessions belong to the bidding organisation, so without one there is
  // nothing to hang the take-off off; re-run after the first sign-up.
  const org = await knex("organization")
    .where("id", "not like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  if (!org) return;

  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>("id");
  const actor = await knex("user").orderBy("createdAt", "asc").first<{ id: string }>("id");

  // A take-off feeds a proposal's BOQ; prefer the proposal for the sample
  // project, fall back to any proposal in the org, and leave the link empty
  // when the proposals seed has not run.
  const proposal = (await knex("proposals")
    .where({ org_id: org.id })
    .modify((q) => {
      if (project) q.orderByRaw("CASE WHEN project_id = ? THEN 0 ELSE 1 END", [PROJECT_ID]);
    })
    .orderBy("number", "asc")
    .first<{ id: string }>("id")) ?? null;

  // A take-off is measured against one drawing revision. Rev B of the
  // take-off hangs off the current plan; Rev A hangs off the plan that one
  // superseded, which is what makes the older session show as stale rather
  // than quietly carrying its quantities forward.
  type PlanRow = { id: string; revision_status: string | null; supersedes_plan_id: string | null };
  const plans = proposal
    ? await knex("proposal_plans")
        .where({ proposal_id: proposal.id })
        .orderBy("sort", "asc")
        .select<PlanRow[]>("id", "revision_status", "supersedes_plan_id")
    : [];
  const currentPlan = plans.find((row) => row.revision_status === "current" && row.supersedes_plan_id) ?? plans[0] ?? null;
  const supersededPlan = currentPlan?.supersedes_plan_id
    ? (plans.find((row) => row.id === currentPlan.supersedes_plan_id) ?? null)
    : (plans.find((row) => row.revision_status === "superseded") ?? null);

  await knex("precon_change_sets").where("id", "like", "pcx_seed_%").del();
  // The cascade off the session clears sheets, bills, rows, geometries,
  // programme tasks and summary settings written by the sibling seeds.
  await knex("precon_sessions").where("id", "like", "pcs_seed_%").del();

  await knex("precon_sessions").insert([
    {
      id: SESSION_ID,
      org_id: org.id,
      project_id: project?.id ?? null,
      proposal_id: proposal?.id ?? null,
      plan_id: currentPlan?.id ?? null,
      takeoff_kind: "pdf",
      status: "reviewing",
      phase: "draft",
      title: "Lekki Duplex — full take-off (Rev B)",
      error: null,
      progress_log: JSON.stringify(PROGRESS_LOG),
      scope: JSON.stringify({ kind: "full", elements: [] }),
      structure_context: JSON.stringify(STRUCTURE_CONTEXT),
      programme_start_date: "2026-10-05",
      revision: 2,
      superseded_by: null,
      created_by: actor?.id ?? null,
      created_at: "2026-09-08T09:12:00.000Z",
      updated_at: "2026-09-18T16:40:00.000Z",
    },
    {
      id: SESSION_R1_ID,
      org_id: org.id,
      project_id: project?.id ?? null,
      proposal_id: proposal?.id ?? null,
      plan_id: supersededPlan?.id ?? currentPlan?.id ?? null,
      takeoff_kind: "pdf",
      status: "output",
      phase: "draft",
      title: "Lekki Duplex — full take-off (Rev A)",
      error: null,
      progress_log: JSON.stringify(PROGRESS_LOG.slice(0, 4)),
      scope: JSON.stringify({ kind: "full", elements: [] }),
      structure_context: JSON.stringify(STRUCTURE_CONTEXT),
      programme_start_date: null,
      revision: 1,
      superseded_by: SESSION_ID,
      created_by: actor?.id ?? null,
      created_at: "2026-08-21T11:04:00.000Z",
      updated_at: "2026-08-22T08:30:00.000Z",
    },
  ]);

  await knex("precon_sheets").insert(
    SHEETS.map((sheet) => ({
      id: `${SHEET_PREFIX}${sheet.n}`,
      session_id: SESSION_ID,
      file_name: PDF_NAME,
      // One uploaded PDF, seven pages: every sheet points at the same object.
      storage_path: PDF_PATH,
      page_number: sheet.page,
      code: sheet.code,
      title: sheet.title,
      kind: sheet.kind,
      status: sheet.status,
      scale_mm_per_pt: sheet.scale,
      scale_confidence: sheet.scaleConfidence,
      dim_unit: sheet.scale === null ? null : "mm",
      snap_index: null,
      viewports: sheet.viewports ? JSON.stringify(sheet.viewports) : null,
      error: sheet.error ?? null,
      created_at: "2026-09-08T09:12:30.000Z",
      updated_at: "2026-09-08T09:24:00.000Z",
    })),
  );

  // Rev A was measured from the two plans only, which is why its bill is
  // thinner than Rev B's.
  await knex("precon_sheets").insert(
    SHEETS.slice(0, 2).map((sheet) => ({
      id: `${SHEET_PREFIX}r1_${sheet.n}`,
      session_id: SESSION_R1_ID,
      file_name: "Lekki-Duplex-Architectural-Set-RevA.pdf",
      storage_path: PDF_PATH_R1,
      page_number: sheet.page,
      code: sheet.code,
      title: sheet.title,
      kind: sheet.kind,
      status: "measured",
      scale_mm_per_pt: MM_PER_PT_1_100,
      scale_confidence: 0.9,
      dim_unit: "mm",
      snap_index: null,
      viewports: null,
      error: null,
      created_at: "2026-08-21T11:04:30.000Z",
      updated_at: "2026-08-21T11:20:00.000Z",
    })),
  );

  if (await knex.schema.hasTable("precon_summary_settings")) {
    await knex("precon_summary_settings").insert([
      // Preliminaries are priced as real lines in Bill No. 1, so adding a
      // percentage on top of the measured works would charge for them twice.
      { session_id: SESSION_ID, prelims_pct: (0).toFixed(2), contingency_pct: (5).toFixed(2), vat_pct: (7.5).toFixed(2) },
      { session_id: SESSION_R1_ID, prelims_pct: (0).toFixed(2), contingency_pct: (7.5).toFixed(2), vat_pct: (7.5).toFixed(2) },
    ]);
  }

  if (await knex.schema.hasTable("precon_change_sets")) {
    await knex("precon_change_sets").insert([
      {
        id: "pcx_seed_rate",
        session_id: SESSION_ID,
        proposal_id: null,
        surface: "bill",
        prompt: "The blockwork rate is stale — Dangote went up in August. Reprice the 225mm external walling at ₦9,600 per square metre.",
        plan_json: JSON.stringify([
          "Find the 225mm sandcrete block walling line in Bill No. 3",
          "Set its rate to ₦9,600/m² and recompute the amount",
        ]),
        changes: JSON.stringify([
          {
            op: "update",
            entity: "boq_row",
            id: ROW_EXTERNAL_BLOCKWORK,
            before: { rate: 8900 },
            after: { rate: 9600 },
            label: "225mm sandcrete block walling to external walls · rate",
          },
        ]),
        status: "applied",
        applied_result: JSON.stringify({
          applied: 1,
          skipped: 0,
          changes: [{ index: 0, outcome: "applied", undo: { kind: "update", id: ROW_EXTERNAL_BLOCKWORK, before: { rate: 8900 } } }],
        }),
        created_by: actor?.id ?? null,
        created_at: "2026-09-15T10:02:00.000Z",
        applied_at: "2026-09-15T10:02:41.000Z",
      },
      {
        id: "pcx_seed_strike",
        session_id: SESSION_ID,
        proposal_id: null,
        surface: "bill",
        prompt: "The client has dropped the water feature from the forecourt. Take it out of the external works bill.",
        plan_json: JSON.stringify([
          "Find the decorative water feature line in Bill No. 5",
          "Reject it so it stays in the bill for the record but carries no money",
        ]),
        changes: JSON.stringify([
          {
            op: "update",
            entity: "boq_row",
            id: ROW_WATER_FEATURE,
            before: { status: "needs_review" },
            after: { status: "rejected" },
            label: "Decorative water feature to forecourt · status",
          },
        ]),
        status: "applied",
        applied_result: JSON.stringify({
          applied: 1,
          skipped: 0,
          changes: [{ index: 0, outcome: "applied", undo: { kind: "update", id: ROW_WATER_FEATURE, before: { status: "needs_review" } } }],
        }),
        created_by: actor?.id ?? null,
        created_at: "2026-09-17T14:31:00.000Z",
        applied_at: "2026-09-17T14:31:22.000Z",
      },
      {
        id: "pcx_seed_curing",
        session_id: SESSION_ID,
        proposal_id: null,
        surface: "programme",
        prompt: "Give the first-floor slab a fortnight to cure before the blockwork starts above it.",
        plan_json: JSON.stringify([
          "Find 'First floor columns and roof beams' in the programme",
          "Extend the lag on its predecessor from 7 to 14 days",
        ]),
        changes: JSON.stringify([
          {
            op: "update",
            entity: "programme_task",
            id: "ppt_seed_col2",
            before: { predecessors: [{ taskId: "ppt_seed_beam", type: "FS", lagDays: 7 }] },
            after: { predecessors: [{ taskId: "ppt_seed_beam", type: "FS", lagDays: 14 }] },
            label: "First floor columns and roof beams · predecessors",
          },
        ]),
        status: "proposed",
        applied_result: null,
        created_by: actor?.id ?? null,
        created_at: "2026-09-19T08:55:00.000Z",
        applied_at: null,
      },
    ]);
  }

  // A DWG job that already produced this register should point at it rather
  // than sit unlinked; only jobs with no session of their own are adopted.
  if ((await knex.schema.hasTable("takeoff_jobs")) && (await knex.schema.hasColumn("takeoff_jobs", "session_id"))) {
    await knex("takeoff_jobs")
      .whereNull("session_id")
      .where((builder) => {
        builder.where({ project_id: PROJECT_ID });
        if (proposal) builder.orWhere({ proposal_id: proposal.id });
      })
      .update({ session_id: SESSION_ID });
  }
}
