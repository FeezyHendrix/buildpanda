import type { Knex } from "knex";

// The programme drafted from the same drawings as the bill seeded in
// 20260798b_precon_bill.ts.
//
// Tasks carry durations and a dependency graph but no dates: the calendar is
// derived from precon_sessions.programme_start_date (5 Oct 2026) by a forward
// pass, so a slipped start moves the whole programme instead of freezing a
// date here. The lags are the real reason a Lagos duplex takes as long as it
// does — concrete has to cure before anything is built on it.

const SESSION_ID = "pcs_seed_lekki_b";
const VERIFIED_AT = "2026-09-18T16:22:00.000Z";

type Predecessor = { taskId: string; type: "FS" | "SS" | "FF" | "SF"; lagDays: number };

type TaskSeed = {
  id: string;
  name: string;
  wbs: string;
  level: number;
  parent?: string;
  group?: string;
  days: number;
  pred?: Predecessor[];
  milestone?: boolean;
  float?: number;
  critical?: boolean;
  basis?: string;
  conf?: "high" | "low";
  status?: "ai_generated" | "needs_review" | "verified" | "rejected";
  origin?: "ai" | "manual" | "prompt";
};

const fs = (taskId: string, lagDays = 0): Predecessor => ({ taskId, type: "FS", lagDays });
const ss = (taskId: string, lagDays = 0): Predecessor => ({ taskId, type: "SS", lagDays });

// Parents precede their children so the self-referencing foreign key holds on
// a single multi-row insert.
const TASKS: TaskSeed[] = [
  { id: "ppt_seed_mob", name: "Mobilisation and site establishment", wbs: "1", level: 1, group: "Preliminaries", days: 10, critical: true, float: 0, basis: "Hoarding, site office and temporary services from Bill No. 1", conf: "high", status: "verified" },

  { id: "ppt_seed_sub", name: "Substructure", wbs: "2", level: 1, group: "Substructure", days: 0, basis: "Summary of the substructure element", conf: "high", status: "verified" },
  { id: "ppt_seed_exc", name: "Excavation to reduce level and foundation trenches", wbs: "2.1", level: 2, parent: "ppt_seed_sub", group: "Substructure", days: 8, pred: [fs("ppt_seed_mob")], critical: true, float: 0, basis: "235.00m³ excavation at one 30-tonne excavator, 30m³/day", conf: "high", status: "verified" },
  { id: "ppt_seed_fdn", name: "Blinding, reinforcement and foundation concrete", wbs: "2.2", level: 2, parent: "ppt_seed_sub", group: "Substructure", days: 10, pred: [fs("ppt_seed_exc")], critical: true, float: 0, basis: "30.00m³ of grade 25 in two pours, with bar fixing between", conf: "high", status: "verified" },
  // Three days between the last footing pour and building on it: 7-day cube
  // strength is not needed to load a footing, but three days is the minimum
  // the engineer will sign off in Lagos heat.
  { id: "ppt_seed_fdnwall", name: "Foundation blockwork to DPC and laterite filling", wbs: "2.3", level: 2, parent: "ppt_seed_sub", group: "Substructure", days: 7, pred: [fs("ppt_seed_fdn", 3)], critical: true, float: 0, basis: "96.80m² of 225mm blockwork plus 82.50m³ of filling in layers", conf: "high" },
  { id: "ppt_seed_slab", name: "Ground floor slab", wbs: "2.4", level: 2, parent: "ppt_seed_sub", group: "Substructure", days: 6, pred: [fs("ppt_seed_fdnwall")], critical: true, float: 0, basis: "214.60m² slab: DPM, mesh, pour and cure", conf: "high" },
  { id: "ppt_seed_ms_sub", name: "Substructure complete", wbs: "3", level: 1, group: "Substructure", days: 0, pred: [fs("ppt_seed_slab")], milestone: true, critical: true, float: 0, basis: "Element complete; first valuation point", conf: "high", status: "verified" },

  { id: "ppt_seed_frame", name: "Superstructure frame and walls", wbs: "4", level: 1, group: "Frame", days: 0, basis: "Summary of the frame and block walling elements", conf: "high" },
  { id: "ppt_seed_col", name: "Ground floor columns", wbs: "4.1", level: 2, parent: "ppt_seed_frame", group: "Frame", days: 6, pred: [fs("ppt_seed_slab")], critical: true, float: 0, basis: "24 columns: bar fixing, formwork, pour and strike", conf: "high", status: "verified" },
  { id: "ppt_seed_beam", name: "First floor beams and suspended slab", wbs: "4.2", level: 2, parent: "ppt_seed_frame", group: "Frame", days: 12, pred: [fs("ppt_seed_col")], critical: true, float: 0, basis: "189.60m² of propped formwork, 28.40m³ of grade 25 in one pour", conf: "high", status: "verified" },
  { id: "ppt_seed_blk1", name: "Ground floor blockwork", wbs: "4.3", level: 2, parent: "ppt_seed_frame", group: "Internal and external walls", days: 9, pred: [ss("ppt_seed_col", 3)], float: 4, basis: "Masons follow the column gang three days behind", conf: "high" },
  // Fourteen days would be the textbook answer; seven is what the engineer
  // accepted here because the slab is back-propped, and it is the lag the
  // Panda AI change set seeded alongside is asking to reopen.
  { id: "ppt_seed_col2", name: "First floor columns and roof beams", wbs: "4.4", level: 2, parent: "ppt_seed_frame", group: "Frame", days: 8, pred: [fs("ppt_seed_beam", 7)], critical: true, float: 0, basis: "Seven-day curing lag on the suspended slab before loading it", conf: "low", status: "needs_review" },
  { id: "ppt_seed_blk2", name: "First floor blockwork", wbs: "4.5", level: 2, parent: "ppt_seed_frame", group: "Internal and external walls", days: 9, pred: [ss("ppt_seed_col2", 3)], float: 2, basis: "167.60m² of partitions plus the external skin at one floor", conf: "high" },

  { id: "ppt_seed_roof", name: "Roofing", wbs: "5", level: 1, group: "Roof", days: 0, basis: "Summary of the roof element", conf: "high" },
  { id: "ppt_seed_truss", name: "Roof trusses, wall plates and bracing", wbs: "5.1", level: 2, parent: "ppt_seed_roof", group: "Roof", days: 6, pred: [fs("ppt_seed_col2")], critical: true, float: 0, basis: "214.80m² of prefabricated trusses craned and set", conf: "low", status: "needs_review" },
  { id: "ppt_seed_cover", name: "Roof covering, fascia and rainwater goods", wbs: "5.2", level: 2, parent: "ppt_seed_roof", group: "Roof", days: 7, pred: [fs("ppt_seed_truss")], critical: true, float: 0, basis: "238.40m² of stone-coated sheets plus 62.40m of eaves", conf: "high" },
  { id: "ppt_seed_ms_shell", name: "Watertight shell", wbs: "6", level: 1, group: "Roof", days: 0, pred: [fs("ppt_seed_cover")], milestone: true, critical: true, float: 0, basis: "Building closed in; finishes can start", conf: "high", status: "verified" },

  { id: "ppt_seed_fin", name: "Finishes", wbs: "7", level: 1, group: "Wall finishings", days: 0, basis: "Summary of the finishes element", conf: "high" },
  { id: "ppt_seed_render", name: "Internal and external rendering", wbs: "7.1", level: 2, parent: "ppt_seed_fin", group: "Wall finishings", days: 14, pred: [fs("ppt_seed_cover"), fs("ppt_seed_blk2")], critical: true, float: 0, basis: "809.20m² of render at two gangs, 30m²/gang/day", conf: "high" },
  { id: "ppt_seed_tile", name: "Floor and wall tiling", wbs: "7.2", level: 2, parent: "ppt_seed_fin", group: "Floor finishings", days: 12, pred: [fs("ppt_seed_render", 3)], critical: true, float: 0, basis: "235.00m² of tiling; three days for the render to dry out first", conf: "high" },
  { id: "ppt_seed_paint", name: "Ceilings, painting and decoration", wbs: "7.3", level: 2, parent: "ppt_seed_fin", group: "Ceiling finishings", days: 12, pred: [ss("ppt_seed_tile", 5)], critical: true, float: 0, basis: "Ceilings and paint follow the tilers room by room", conf: "high" },

  { id: "ppt_seed_ext", name: "External works", wbs: "8", level: 1, group: "External works", days: 16, pred: [fs("ppt_seed_cover")], float: 12, basis: "Fence, driveway, paving and drainage once the scaffold is struck", conf: "high", origin: "manual" },
  { id: "ppt_seed_ms_pc", name: "Practical completion", wbs: "9", level: 1, days: 0, pred: [fs("ppt_seed_paint"), fs("ppt_seed_ext")], milestone: true, critical: true, float: 0, basis: "Handover, snagging list issued and keys released", conf: "high", status: "verified" },
];

export async function seed(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("precon_programme_tasks"))) return;
  const session = await knex("precon_sessions").where({ id: SESSION_ID }).first<{ id: string }>("id");
  if (!session) return;

  const verifier = await knex("user").orderBy("createdAt", "asc").first<{ id: string }>("id");

  await knex("precon_programme_tasks").where("id", "like", "ppt_seed_%").del();

  await knex("precon_programme_tasks").insert(
    TASKS.map((task, index) => {
      const verified = task.status === "verified";
      return {
        id: task.id,
        session_id: SESSION_ID,
        sort: index,
        name: task.name,
        element_group: task.group ?? null,
        wbs_code: task.wbs,
        outline_level: task.level,
        parent_task_id: task.parent ?? null,
        duration_days: task.days.toFixed(2),
        predecessors: JSON.stringify(task.pred ?? []),
        is_milestone: task.milestone ?? false,
        basis: task.basis ?? null,
        confidence: task.conf ?? null,
        status: task.status ?? "ai_generated",
        version: 1,
        total_float_days: task.float ?? null,
        is_critical: task.critical ?? false,
        origin: task.origin ?? "ai",
        verified_by: verified ? (verifier?.id ?? null) : null,
        verified_at: verified ? VERIFIED_AT : null,
        created_at: "2026-09-08T09:25:30.000Z",
        updated_at: "2026-09-18T16:22:00.000Z",
      };
    }),
  );
}
