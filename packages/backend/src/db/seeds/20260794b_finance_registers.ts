import type { Knex } from "knex";

/**
 * The registers that hang off the Sample Project's contract position, seeded
 * after `20260794_finance_depth` because they reference the stage values and
 * the time claims it writes.
 *
 * Same rule as its sibling: none of these rows is a transaction. A schedule of
 * values is an agreement on how a contract sum is billed, a pay application is
 * a claim, a dispute is a position someone has taken — each is a record, with
 * an actor, of something settled between people off-platform.
 */

const PROJECT_ID = "sample-project";
const MAIN_CONTRACT_ID = "fd_ct_main";
const CHANGE_ORDER_ID = "fd_ct_chg1";
const STAGE_IDS = ["p1", "p2", "p3", "p4", "p5"];

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function money(n: number): string {
  return n.toFixed(2);
}

/** Monthly billing lines per stage; `percent_complete` is cumulative work in place. */
const SOV = [
  { stage: "p1", period: "2026-01", percent: 45, amount: 5_400_000, billed: true, complete: 45 },
  { stage: "p1", period: "2026-02", percent: 55, amount: 6_600_000, billed: true, complete: 100 },
  { stage: "p2", period: "2026-03", percent: 45, amount: 19_800_000, billed: true, complete: 25 },
  { stage: "p2", period: "2026-04", percent: 55, amount: 24_200_000, billed: false, complete: 45 },
  { stage: "p3", period: "2026-05", percent: 50, amount: 15_000_000, billed: false, complete: null },
  { stage: "p3", period: "2026-06", percent: 50, amount: 15_000_000, billed: false, complete: null },
  { stage: "p4", period: "2026-07", percent: 50, amount: 13_000_000, billed: false, complete: null },
  { stage: "p4", period: "2026-08", percent: 50, amount: 13_000_000, billed: false, complete: null },
  { stage: "p5", period: "2026-09", percent: 60, amount: 6_000_000, billed: false, complete: null },
  { stage: "p5", period: "2026-10", percent: 40, amount: 4_000_000, billed: false, complete: null },
];

/** The programme's planned spend curve, summing to the 109,000,000 of stage estimates. */
const COST_PHASING: Array<[string, number]> = [
  ["2026-01", 3_000_000], ["2026-02", 6_500_000], ["2026-03", 11_000_000], ["2026-04", 14_500_000],
  ["2026-05", 15_500_000], ["2026-06", 14_000_000], ["2026-07", 13_500_000], ["2026-08", 12_000_000],
  ["2026-09", 11_000_000], ["2026-10", 8_000_000],
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects")
    .where({ id: PROJECT_ID })
    .first<{ id: string; organization_id: string | null }>("id", "organization_id");
  if (!project) return;

  const has = (table: string) => knex.schema.hasTable(table);
  const hasCol = (table: string, column: string) => knex.schema.hasColumn(table, column);

  // ---- The works contract and the change order raised off it ----
  if (await has("project_contracts")) {
    await knex("project_contracts").whereIn("id", [MAIN_CONTRACT_ID, CHANGE_ORDER_ID]).del();
    await knex("project_contracts").insert([
      {
        id: MAIN_CONTRACT_ID,
        project_id: PROJECT_ID,
        kind: "main",
        title: "Main contract — Sample Project (JCT SBC/Q 2016)",
        legal_entity: "Adeyemi Crew Ltd",
        total: money(120_000_000),
        status: "Signed",
        signed_at: isoDateDaysAgo(261),
      },
      {
        id: CHANGE_ORDER_ID,
        project_id: PROJECT_ID,
        kind: "change_order",
        change_request_id: "chg1",
        title: "Change order 01 — imported porcelain to ground floor",
        trade: "Finishes",
        legal_entity: "Adeyemi Crew Ltd",
        total: money(850_000),
        // chg1 is Approved and not yet Executed, so the order is agreed in
        // principle and still unsigned.
        status: "Pending",
      },
    ]);
    if (await hasCol("project_phases", "contract_id")) {
      await knex("project_phases")
        .where({ project_id: PROJECT_ID })
        .whereIn("id", STAGE_IDS)
        .update({ contract_id: MAIN_CONTRACT_ID });
    }
  }

  // ---- How each stage value is billed, month by month ----
  if (await has("stage_schedule_of_values")) {
    await knex("stage_schedule_of_values").where({ project_id: PROJECT_ID }).del();
    const hasProgress = await hasCol("stage_schedule_of_values", "percent_complete");
    await knex("stage_schedule_of_values").insert(
      SOV.map((line, idx) => ({
        id: `fd_sov${idx + 1}`,
        project_id: PROJECT_ID,
        stage_id: line.stage,
        period: line.period,
        percent: line.percent.toFixed(4),
        amount: money(line.amount),
        billed: line.billed,
        sort_order: idx,
        ...(hasProgress
          ? { percent_complete: line.complete === null ? null : line.complete.toFixed(4) }
          : {}),
      })),
    );
  }

  // ---- The pay application that claims against those stages ----
  if (await has("invoice_stage_lines")) {
    const application = await knex("project_invoices")
      .where({ project_id: PROJECT_ID, number: "PRG-INV-2026-002" })
      .first<{ id: string }>("id");
    await knex("invoice_stage_lines").where({ project_id: PROJECT_ID }).del();
    if (application) {
      // Application #7 claims 3,100,000 across the two stages the first-fix
      // mobilisation touched, 5% withheld on each — 155,000 in total, which is
      // the retention already carried on that certificate.
      const lines = [
        { stage: "p2", value: 44_000_000, period: 1_800_000, retained: 90_000 },
        { stage: "p3", value: 30_000_000, period: 1_300_000, retained: 65_000 },
      ];
      await knex("invoice_stage_lines").insert(
        lines.map((line, idx) => ({
          id: `fd_isl${idx + 1}`,
          project_id: PROJECT_ID,
          invoice_id: application.id,
          stage_id: line.stage,
          scheduled_value: money(line.value),
          this_period: money(line.period),
          stored_materials: money(0),
          retained: money(line.retained),
          sort_order: idx,
        })),
      );
    }
  }

  // ---- Change requests priced against the budget they draw on ----
  if (await has("change_request_budget_links")) {
    const ids = ["fd_crb1", "fd_crb2", "fd_crb3"];
    await knex("change_request_budget_links").whereIn("id", ids).del();
    const categories = await knex("project_budget_categories")
      .where({ project_id: PROJECT_ID })
      .whereIn("id", ["bc5", "bc6"])
      .pluck<string[]>("id");
    if (categories.includes("bc5")) {
      await knex("change_request_budget_links").insert([
        // chg1 is approved, so its cost is committed against finishes.
        { id: ids[0]!, change_request_id: "chg1", budget_category_id: "bc5", amount: money(850_000), committed: true },
        // chg2 is only submitted: priced against the budget, not yet committed.
        { id: ids[1]!, change_request_id: "chg2", budget_category_id: "bc5", amount: money(900_000), committed: false },
        ...(categories.includes("bc6")
          ? [{ id: ids[2]!, change_request_id: "chg2", budget_category_id: "bc6", amount: money(300_000), committed: false }]
          : []),
      ]);
    }
  }

  // ---- A held release is a contractual position, not a UI state ----
  if (await has("milestone_disputes")) {
    await knex("milestone_disputes").whereIn("id", ["fd_md1", "fd_md2"]).del();
    const milestones = await knex("milestone_payments")
      .where({ project_id: PROJECT_ID })
      .whereIn("id", ["m2", "m3"])
      .pluck<string[]>("id");
    const disputes = [
      {
        id: "fd_md1",
        milestone_id: "m3",
        raised_by_id: "seed-owner",
        raised_by_name: "Adeyi Client (Homeowner)",
        reason: "Slab edge on grid C is out of tolerance. The 65% interim release is disputed until the pour is re-surveyed.",
        status: "Open",
        created_at: isoDaysAgo(12),
        resolved_at: null,
      },
      {
        id: "fd_md2",
        milestone_id: "m2",
        raised_by_id: "seed-eng",
        raised_by_name: "Angela Bello (Structural)",
        reason: "Substructure certified before the blinding inspection record was filed.",
        status: "Resolved",
        created_at: isoDaysAgo(70),
        resolved_at: isoDaysAgo(64),
      },
    ].filter((dispute) => milestones.includes(dispute.milestone_id));
    if (disputes.length > 0) await knex("milestone_disputes").insert(disputes);
  }

  // Cost headings a Nigerian site books against that the preset list has no
  // room for. They belong to the org, not the project, so they need one.
  if (project.organization_id && (await has("custom_transaction_categories"))) {
    const ids = ["fd_cat1", "fd_cat2", "fd_cat3"];
    const org = project.organization_id;
    await knex("custom_transaction_categories").whereIn("id", ids).del();
    await knex("custom_transaction_categories").insert([
      { id: ids[0]!, org_id: org, label: "Dewatering", color: "#0EA5E9", created_by_id: null },
      { id: ids[1]!, org_id: org, label: "Crane & lifting", color: "#F59E0B", created_by_id: null },
      { id: ids[2]!, org_id: org, label: "Testing & commissioning", color: "#8B5CF6", created_by_id: null },
    ]);
  }

  if (await has("programme_cost_phasing")) {
    await knex("programme_cost_phasing").where({ project_id: PROJECT_ID, programme_version: 1 }).del();
    await knex("programme_cost_phasing").insert(
      COST_PHASING.map(([period, planned]) => ({
        project_id: PROJECT_ID,
        period,
        planned_cost: money(planned),
        programme_version: 1,
      })),
    );
  }
}
