import type { Knex } from "knex";

/**
 * Dates each expense inside the phase it was attributed to.
 *
 * The expense fixture was written as "N days ago", so every cost landed in the
 * last four months regardless of when the work happened. That put the whole
 * spend curve in a spike at the right-hand edge while the programme showed
 * Foundation finished in February and the Shell half built by April — a
 * project that had apparently spent nothing for its first five months and then
 * everything at once. Cost is a record of work done, so it belongs in the
 * month the work was done.
 *
 * Phase attribution comes from `20260794_finance_depth.ts`. This only moves
 * `transacted_at`; no amount, category or attribution changes, so every total
 * the Budget and Phases pages report is untouched.
 */

const PROJECT_ID = "sample-project";

/** Where an expense sits inside its phase, as a fraction of the phase window. */
function spreadWithin(start: string, end: string, index: number, count: number): string {
  const from = Date.parse(`${start}T09:00:00Z`);
  const to = Date.parse(`${end}T09:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from || count <= 0) return `${start}T09:00:00Z`;
  // Evenly spaced and never on the boundary: work starts after the phase opens
  // and the last invoice lands before it closes.
  const step = (to - from) / (count + 1);
  return new Date(from + step * (index + 1)).toISOString();
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;
  if (!(await knex.schema.hasTable("project_transactions"))) return;
  if (!(await knex.schema.hasColumn("project_transactions", "stage_id"))) return;

  const phases = await knex("project_phases")
    .where({ project_id: PROJECT_ID })
    .whereNotNull("start_date")
    .whereNotNull("end_date")
    .select("id", "start_date", "end_date");

  for (const phase of phases) {
    const start = String(phase["start_date"]).slice(0, 10);
    const end = String(phase["end_date"]).slice(0, 10);

    // Ordered by the existing date so the original sequence of spend survives
    // the move; only the window it sits in changes.
    const rows = await knex("project_transactions")
      .where({ project_id: PROJECT_ID, stage_id: phase["id"] })
      .orderBy("transacted_at", "asc")
      .select("id");

    for (const [index, row] of rows.entries()) {
      await knex("project_transactions")
        .where({ id: row["id"] })
        .update({ transacted_at: spreadWithin(start, end, index, rows.length) });
    }
  }
}
