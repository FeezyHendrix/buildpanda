import type { Knex } from "knex";

/**
 * The budget, and what each payable invoice was booked against.
 *
 * `invoice_budget_allocations` was only ever DELETED — the re-run cleanup in
 * `20260775_marbella_modern.ts` clears it and nothing puts anything back — so
 * no invoice named the budget line it landed on and the Budget page could not
 * say what any spend bought.
 *
 * Only the seven PAYABLE vendor and material invoices are allocated. A
 * receivable certificate is value certified TO the employer, not cost the
 * contractor incurred; booking one against a budget category would count the
 * same money twice against the position `20260794c` just reconciled.
 *
 * The categories and monthly periods are rescaled here too. Their figures date
 * from when this project's contract was 45,300,500 and were never moved when it
 * became 120,000,000, so the Budget page quoted a 41,300,500 budget while the
 * Phases page quoted 109,000,000 and the contract said 122,000,000 — three
 * budgets for one project. Nothing in this file moves money; a budget is a
 * statement of intent and an allocation is a bookkeeping attribution of an
 * invoice that already exists.
 */

const PROJECT_ID = "sample-project";

function money(n: number): string {
  return n.toFixed(2);
}

interface Allocation {
  category: string;
  amount: number;
}

interface InvoiceAllocation {
  number: string;
  /** The invoice's own ex-VAT value; the allocations below sum to exactly this. */
  value: number;
  lines: Allocation[];
}

/**
 * The split follows the stage attribution in `20260794_finance_depth`, so the
 * Budget page and the Phases page describe the same works rather than two
 * different projects: substructure materials and the ground-floor formwork sit
 * with Foundation's category, the frame steel and block work with the shell's,
 * plumbing first-fix with M&E, tiling with finishes, and the scaffolding and
 * engineer's fees with preliminaries.
 *
 * The 12mm/16mm steel delivery is deliberately split across two categories:
 * one bulk order covered the ground beams and the column cages, and pretending
 * it was all frame steel would push Concrete Frame past its planned figure and
 * report an overrun that did not happen.
 */
const ALLOCATIONS: InvoiceAllocation[] = [
  {
    number: "MAT-INV-2026-011",
    value: 2_100_000,
    lines: [
      { category: "bc2", amount: 1_620_000 },
      { category: "bc1", amount: 480_000 },
    ],
  },
  {
    number: "MAT-INV-2026-014",
    value: 9_910_000,
    lines: [
      { category: "bc2", amount: 5_420_000 },
      { category: "bc1", amount: 2_400_000 },
      { category: "bc5", amount: 2_090_000 },
    ],
  },
  { number: "SUB-INV-2026-005", value: 210_000, lines: [{ category: "bc6", amount: 210_000 }] },
  { number: "SUB-INV-2026-008", value: 500_000, lines: [{ category: "bc6", amount: 500_000 }] },
  { number: "SUB-INV-2026-012", value: 1_250_000, lines: [{ category: "bc1", amount: 1_250_000 }] },
  { number: "MAT-INV-2026-018", value: 1_440_000, lines: [{ category: "bc2", amount: 1_440_000 }] },
  { number: "SUB-INV-2026-016", value: 618_000, lines: [{ category: "bc4", amount: 618_000 }] },
];

/**
 * Fully settled invoices the earlier seed left at Approved: each carries a
 * recorded payment equal to its whole value, so Approved contradicts its own
 * payment record. They are payable, so this moves nothing in the certified or
 * paid position — those derive from receivable certificates only.
 */
const SETTLED_IN_FULL = ["SUB-INV-2026-005", "SUB-INV-2026-012"];

/**
 * The budget rescaled onto the current contract. Categories total 109,000,000,
 * the sum of the stage expected costs — NOT the 122,000,000 adjusted contract,
 * because a budget category holds cost and the contract sum carries the
 * contractor's margin on top of it.
 *
 * Each category is the cost of the work the phases already describe, and the
 * two reconcile in both directions:
 *   p1 10,500,000 = bc1 9,300,000 + prelims 1,200,000
 *   p2 39,600,000 = bc2 35,100,000 + prelims 4,500,000
 *   p3 27,000,000 = bc3 11,000,000 + bc4 13,000,000 + prelims 3,000,000
 *   p4 23,400,000 = bc5 16,000,000 + bc4 5,000,000 + prelims 2,400,000
 *   p5  8,500,000 = bc5 4,600,000 + bc4 2,000,000 + prelims 1,900,000
 *
 * `committed` and `actual` are rescaled with them: leaving 45.3m-era spend
 * under a 109m budget would report every category as barely started. They sum
 * to the 20,103,600 committed and 19,240,000 actual the stage attribution
 * records, so the Budget page and the Phases page count the same money.
 */
const CATEGORIES = [
  { id: "bc1", planned: 9_300_000, committed: 4_500_000, actual: 5_400_000 },
  { id: "bc2", planned: 35_100_000, committed: 8_600_000, actual: 11_500_000 },
  // Roofing is bought but not yet billed, which is what p3 says too.
  { id: "bc3", planned: 11_000_000, committed: 1_480_000, actual: 0 },
  { id: "bc4", planned: 20_000_000, committed: 618_000, actual: 0 },
  { id: "bc5", planned: 20_600_000, committed: 3_265_600, actual: 0 },
  { id: "bc6", planned: 13_000_000, committed: 1_640_000, actual: 2_340_000 },
];

/**
 * The monthly budget curve, identical to the `programme_cost_phasing` curve in
 * `20260794b` so the cash-flow chart and the programme never plot two
 * different budget lines. The seeded periods stopped at June on the old scale;
 * the programme runs to October, so four months are added.
 *
 * Actuals sit under the planned curve every month — the project is running
 * behind, which is the same thing the live LD exposure says.
 */
const PERIODS: Array<{ period: string; planned: number; actual: number }> = [
  { period: "2026-01", planned: 3_000_000, actual: 2_600_000 },
  { period: "2026-02", planned: 6_500_000, actual: 3_900_000 },
  { period: "2026-03", planned: 11_000_000, actual: 4_700_000 },
  { period: "2026-04", planned: 14_500_000, actual: 4_400_000 },
  { period: "2026-05", planned: 15_500_000, actual: 3_640_000 },
  { period: "2026-06", planned: 14_000_000, actual: 0 },
  { period: "2026-07", planned: 13_500_000, actual: 0 },
  { period: "2026-08", planned: 12_000_000, actual: 0 },
  { period: "2026-09", planned: 11_000_000, actual: 0 },
  { period: "2026-10", planned: 8_000_000, actual: 0 },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>("id");
  if (!project) return;

  if (!(await knex.schema.hasTable("invoice_budget_allocations"))) return;
  if (!(await knex.schema.hasTable("project_budget_categories"))) return;

  // Roofing & Waterproofing (bc3) is deliberately absent from the plan above:
  // the roofing order is committed but nothing has been invoiced against it
  // yet, which is exactly what the phase figures say about Roofing & MEP.
  const categories = new Set(
    await knex("project_budget_categories").where({ project_id: PROJECT_ID }).pluck<string[]>("id"),
  );
  if (categories.size === 0) return;

  // The earlier seed gives invoices random uuids, so they are resolved by
  // number. Restricting to payable is belt and braces: a certificate must
  // never acquire a budget allocation, whatever it is numbered.
  const hasDirection = await knex.schema.hasColumn("project_invoices", "direction");
  const invoiceQuery = knex("project_invoices")
    .where({ project_id: PROJECT_ID })
    .whereIn("number", ALLOCATIONS.map((allocation) => allocation.number));
  if (hasDirection) invoiceQuery.andWhere({ direction: "payable" });
  const invoices = await invoiceQuery.select<Array<{ id: string; number: string }>>("id", "number");
  const invoiceId = new Map(invoices.map((invoice) => [invoice.number, invoice.id]));

  const rows: Array<Record<string, unknown>> = [];
  for (const allocation of ALLOCATIONS) {
    const id = invoiceId.get(allocation.number);
    if (!id) continue;
    allocation.lines.forEach((line, index) => {
      if (!categories.has(line.category)) return;
      rows.push({
        id: `fd_iba_${allocation.number}_${index}`,
        invoice_id: id,
        budget_category_id: line.category,
        amount: money(line.amount),
        created_at: knex.fn.now(),
      });
    });
  }

  // Sweeps the whole prefix rather than the ids about to be written, so a row
  // dropped from the plan does not survive the next run.
  await knex("invoice_budget_allocations").where("id", "like", "fd_iba%").del();
  if (rows.length > 0) await knex("invoice_budget_allocations").insert(rows);

  // A paid invoice is what the Budget page counts as spend against a category,
  // so the two invoices whose receipts already cover them in full say so.
  const settledQuery = knex("project_invoices")
    .where({ project_id: PROJECT_ID })
    .whereIn("number", SETTLED_IN_FULL);
  if (hasDirection) settledQuery.andWhere({ direction: "payable" });
  await settledQuery.update({ status: "Paid" });

  for (const category of CATEGORIES) {
    await knex("project_budget_categories")
      .where({ project_id: PROJECT_ID, id: category.id })
      .update({
        planned: money(category.planned),
        committed: money(category.committed),
        actual: money(category.actual),
      });
  }

  if (!(await knex.schema.hasTable("project_budget_periods"))) return;
  // The seeded months are updated in place and the missing ones added, because
  // `period` is unique per project — a blind insert would collide. The months
  // this seed owns are cleared first so they are not counted as already there
  // and then left un-inserted on a re-run.
  await knex("project_budget_periods").where("id", "like", "fd_bp%").del();
  const existing = new Set(
    await knex("project_budget_periods").where({ project_id: PROJECT_ID }).pluck<string[]>("period"),
  );
  const newPeriods = [];
  for (const entry of PERIODS) {
    if (existing.has(entry.period)) {
      await knex("project_budget_periods")
        .where({ project_id: PROJECT_ID, period: entry.period })
        .update({ planned: money(entry.planned), actual: money(entry.actual) });
    } else {
      newPeriods.push({
        id: `fd_bp_${entry.period}`,
        project_id: PROJECT_ID,
        period: entry.period,
        planned: money(entry.planned),
        actual: money(entry.actual),
        created_at: knex.fn.now(),
      });
    }
  }
  if (newPeriods.length > 0) await knex("project_budget_periods").insert(newPeriods);
}
