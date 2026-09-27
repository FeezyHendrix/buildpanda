import type { Knex } from "knex";

/**
 * The Sample Project's contract position, so the Finance overview has figures
 * to render instead of empty panels. The Part B registers that hang off it
 * (contracts, schedule of values, disputes) are in the sibling `20260794b`.
 *
 * Nothing here moves money. Every row is the RECORD of something a human did
 * off-platform — a valuation agreed, a purchase order issued, an award decided
 * — carried with the actor and the date it happened. The figures reconcile to
 * the contract already seeded (sum 120,000,000 + variations 2,000,000 = an
 * adjusted contract of 122,000,000, NGN) so a QS reading the Overview, the
 * Phases tab and the payment ledger sees one story.
 */

const PROJECT_ID = "sample-project";
const EOT_APPROVED_ID = "fd_eot1";
const EOT_PENDING_ID = "fd_eot2";

/** Days the approved EOT moved the contract completion date by. */
const EOT_DAYS_AWARDED = 16;
/** Contract completion, as a lag on today, so the demo is always a live position. */
const DAYS_SINCE_COMPLETION = 21;

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function money(n: number): string {
  return n.toFixed(2);
}

/**
 * The Schedule of Values. Scheduled values sum to the adjusted contract
 * (122,000,000): the employer is billed the whole contract, variations
 * included. Expected cost is the contractor's own estimate and sits under the
 * scheduled value — the difference is the margin a GMP is built on.
 *
 * Foundation is deliberately tight (10,500,000 against 12,000,000 billed): its
 * recorded spend lands above it, so the Phases card has one real overrun to
 * show rather than five comfortable greens.
 */
const PHASES = [
  { id: "p1", value: 12_000_000, expected: 10_500_000, labour: 3_200_000, material: 5_600_000, hours: 1_800 },
  { id: "p2", value: 44_000_000, expected: 39_600_000, labour: 11_900_000, material: 21_800_000, hours: 6_400 },
  { id: "p3", value: 30_000_000, expected: 27_000_000, labour: 8_100_000, material: 14_900_000, hours: 4_300 },
  { id: "p4", value: 26_000_000, expected: 23_400_000, labour: 7_000_000, material: 12_900_000, hours: 3_900 },
  { id: "p5", value: 10_000_000, expected: 8_500_000, labour: 2_600_000, material: 4_700_000, hours: 1_400 },
];

/**
 * Expenses attributed to the stage that consumed them. Substructure work,
 * enabling plant and the one-off pre-contract costs belong to Foundation
 * (6,160,000); everything from the cement for the GF slab onwards is
 * Structural Shell (13,080,000). Together they are the whole expense register,
 * so no naira is left unattributed.
 */
const EXPENSE_STAGES: Array<[string, string[]]> = [
  ["p1", [
    "Granite chippings — 25 tonnes",
    "Sharp sand — 40 tonnes",
    "Site labour — week 1",
    "Site labour — week 2",
    "Excavator hire — 3 days",
    "Concrete pump hire — GF slab pour",
    "Formwork sub — GF slab",
    "Soil test report",
    "Building permit — annex extension",
    "Site office rental — month 1",
    "Site security — month 1",
  ]],
  ["p2", [
    "Cement delivery — 200 bags",
    "Reinforcement steel — 320 lengths",
    "Sandcrete blocks — 3,000 blocks",
    "Site labour — week 3",
    "Site labour — week 4",
    "Scaffolding hire — month 1",
    "Structural engineer — site visits",
    "Diesel — generator run",
    "Water tanker — 20,000L",
    "Site office rental — month 2",
    "Site security — month 2",
    "Material transport — Lekki delivery",
    "PPE and safety kit refill",
    "Petty cash reimbursement",
  ]],
];

/** Committed cost: an issued order is money promised to a stage, not yet spent. */
const PO_STAGES: Array<[string, string[]]> = [
  ["p1", ["PO-2026-008", "PO-2026-013"]],
  ["p2", ["PO-2026-017", "PO-2026-021"]],
  ["p3", ["PO-2026-029", "PO-2026-034"]],
  ["p4", ["PO-2026-039", "PO-2026-041"]],
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>("id");
  if (!project) return;

  const hasCol = (table: string, column: string) => knex.schema.hasColumn(table, column);

  // ---- Scheduled values and estimates, so a phase budget is not zero ----
  if (await hasCol("project_phases", "value")) {
    const hasEstimate = await hasCol("project_phases", "expected_cost");
    for (const phase of PHASES) {
      await knex("project_phases")
        .where({ project_id: PROJECT_ID, id: phase.id })
        .update({
          value: money(phase.value),
          ...(hasEstimate
            ? {
                expected_cost: money(phase.expected),
                labor_budget: money(phase.labour),
                material_budget: money(phase.material),
                estimated_labor_hours: phase.hours.toFixed(2),
              }
            : {}),
        });
    }
  }

  // ---- Cost attribution: without a stage_id the money belongs to nobody ----
  if (await hasCol("project_transactions", "stage_id")) {
    for (const [stageId, titles] of EXPENSE_STAGES) {
      await knex("project_transactions")
        .where({ project_id: PROJECT_ID })
        .whereIn("title", titles)
        .update({ stage_id: stageId, updated_at: knex.fn.now() });
    }
  }
  if (await hasCol("purchase_orders", "stage_id")) {
    for (const [stageId, numbers] of PO_STAGES) {
      await knex("purchase_orders")
        .where({ project_id: PROJECT_ID })
        .whereIn("po_number", numbers)
        .update({ stage_id: stageId });
    }
  }

  // ---- Dates and liquidated damages ----
  // The works ran past the contract date. An approved EOT moved completion by
  // 16 days and the job is still 5 days beyond that revised date, so the LD
  // figure the card shows is an EXPOSURE the employer could levy — 5 × 60,000
  // = 300,000 — not a deduction anyone has made.
  const completionDate = isoDateDaysAgo(DAYS_SINCE_COMPLETION);
  const revisedCompletion = isoDateDaysAgo(DAYS_SINCE_COMPLETION - EOT_DAYS_AWARDED);
  const commencementDate = isoDateDaysAgo(DAYS_SINCE_COMPLETION + 240);
  if (await hasCol("projects", "completion_date")) {
    await knex("projects").where({ id: PROJECT_ID }).update({
      completion_date: completionDate,
      ...((await hasCol("projects", "revised_completion_date"))
        ? { revised_completion_date: revisedCompletion }
        : {}),
      ...((await hasCol("projects", "start_date")) ? { start_date: commencementDate } : {}),
    });
  }

  // ---- Contract terms and the funding position ----
  // Funding reconciles to `payment_ledger`, which is the full register: three
  // recorded deposits (25m + 12m + 30m) and three recorded releases
  // (6m + 9.5m + 5.8m). `finance_events` shows a subset of the same movements
  // in the activity feed, so the ledger is the figure to trust.
  const termsPatch: Record<string, unknown> = {
    funds_deposited: money(67_000_000),
    funds_released: money(21_300_000),
  };
  if (await hasCol("project_finances", "liquidated_damages_rate")) {
    Object.assign(termsPatch, {
      // 0.05% of the adjusted contract per calendar day, capped at 5% of it —
      // the JCT-style figure the seeded contract notes already describe.
      liquidated_damages_rate: money(60_000),
      liquidated_damages_cap_percent: (0.05).toFixed(4),
      retention_cap_percent: (0.03).toFixed(4),
      commencement_date: commencementDate,
      completion_date: completionDate,
      employer_name: "Adeyi Family Trust",
      contractor_name: "Adeyemi Crew Ltd",
      contract_form: "jct",
    });
  }
  await knex("project_finances").where({ project_id: PROJECT_ID }).update(termsPatch);

  // ---- Extensions of time: a time claim IS a change request ----
  // `extension_of_time_claims` is the superseded register and nothing reads it,
  // so the award that moved the completion date lives here, where the Finance
  // overview counts approved and pending days from.
  if (!(await hasCol("change_requests", "days_awarded"))) return;
  await knex("change_requests").whereIn("id", [EOT_APPROVED_ID, EOT_PENDING_ID]).del();
  const hasApplied = await hasCol("change_requests", "days_applied");
  await knex("change_requests").insert([
    {
      id: EOT_APPROVED_ID,
      project_id: PROJECT_ID,
      title: "EOT 01 — Exceptional rainfall during April block work",
      description: "Six working days lost to rain; form-stripping and the follow-on lift could not proceed.",
      reason: "Exceptional adverse weather — a relevant event under the contract, not contractor risk.",
      status: "Approved",
      type: "eot_only",
      stage_id: "p2",
      cost_impact: money(0),
      time_impact_days: 21,
      days_awarded: EOT_DAYS_AWARDED,
      ...(hasApplied ? { days_applied: EOT_DAYS_AWARDED } : {}),
      currency: "NGN",
      submitted_at: isoDaysAgo(45),
      decided_at: isoDaysAgo(30),
      revisions: JSON.stringify([]),
    },
    {
      id: EOT_PENDING_ID,
      project_id: PROJECT_ID,
      title: "EOT 02 — Late concrete pump on the ground floor slab pour",
      description: "Pump arrived two hours late and the pour ran into the night shift.",
      reason: "Supplier default on a nominated plant hire.",
      status: "Submitted",
      type: "eot_only",
      stage_id: "p2",
      cost_impact: money(0),
      time_impact_days: 9,
      days_awarded: null,
      currency: "NGN",
      submitted_at: isoDaysAgo(8),
      revisions: JSON.stringify([]),
    },
  ]);

  // The delay events each claim is argued from; a claim citing no delay is an
  // assertion, not a claim.
  if (!(await knex.schema.hasTable("change_request_delays"))) return;
  const links = [
    { id: "fd_crd1", change_request_id: EOT_APPROVED_ID, delay_id: "ad-1" },
    { id: "fd_crd2", change_request_id: EOT_PENDING_ID, delay_id: "ad-2" },
  ];
  const live = await knex("activity_delays").whereIn("id", ["ad-1", "ad-2"]).pluck<string[]>("id");
  await knex("change_request_delays").whereIn("id", ["fd_crd1", "fd_crd2"]).del();
  const usable = links.filter((link) => live.includes(link.delay_id));
  if (usable.length > 0) await knex("change_request_delays").insert(usable);
}
