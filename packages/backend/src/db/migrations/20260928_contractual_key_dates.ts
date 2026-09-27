import type { Knex } from "knex";
import { CONTRACTUAL_LABEL_PATTERNS } from "../../modules/key-dates/contractual-labels.ts";

/**
 * Put the contract dates back in step with the revised completion date.
 *
 * `is_contractual` was added late, defaulting to false and with no backfill, so
 * an awarded extension of time moved whichever dates somebody had thought to
 * tick. On a live road job that meant "Practical completion" moved and "Defects
 * liability ends" did not — the project read 01 Apr 2027 while its own contract
 * dates read 30 Mar 2027 and 26 Mar 2028.
 *
 * This flags the dates the contract plainly owns, then re-derives every
 * contractual date from the date originally programmed plus the total days
 * awarded on the project, so the completion date and every contract date agree
 * on the same number of awarded days. Awards are calendar days: the contract
 * extends the time for completion, it does not re-plan the working week.
 */

const AWARDED_STATUSES = ["Approved", "Executed"] as const;

interface AwardRow {
  project_id: string;
  days: string | null;
}

interface ContractualKeyDateRow {
  id: string;
  project_id: string;
  target_date: string | Date;
  revised_from: string | Date | null;
}

function labelMatch(query: Knex.QueryBuilder): Knex.QueryBuilder {
  return query.where((q) => {
    for (const pattern of CONTRACTUAL_LABEL_PATTERNS) q.orWhereRaw("label ILIKE ?", [`%${pattern}%`]);
  });
}

/**
 * A DATE column is a calendar day. Drivers hand it over as a string or as a
 * Date at LOCAL midnight, and `toISOString()` on the latter moves the day west
 * of Greenwich, so the calendar parts are read locally.
 */
function toIso(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function shift(value: string | Date, addDays: number): string {
  const date = new Date(`${toIso(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + addDays);
  return date.toISOString().slice(0, 10);
}

export async function up(knex: Knex): Promise<void> {
  await labelMatch(knex("key_dates").where({ is_contractual: false })).update({
    is_contractual: true,
    updated_at: new Date().toISOString(),
  });

  const awards = await knex("change_requests")
    .where({ type: "eot_only" })
    .whereIn("status", [...AWARDED_STATUSES])
    .groupBy("project_id")
    .select<AwardRow[]>("project_id", knex.raw("COALESCE(SUM(days_awarded), 0) as days"));

  for (const award of awards) {
    const days = Math.trunc(Number(award.days ?? 0));
    if (days <= 0) continue;

    const project = await knex("projects")
      .where({ id: award.project_id })
      .select<
        | { completion_date: string | Date | null; revised_completion_date: string | Date | null }
        | undefined
      >("completion_date", "revised_completion_date")
      .first();

    if (project?.completion_date) {
      const revised = shift(project.completion_date, days);
      if (revised !== (project.revised_completion_date ? toIso(project.revised_completion_date) : null)) {
        await knex("projects")
          .where({ id: award.project_id })
          .update({ revised_completion_date: revised, updated_at: new Date().toISOString() });
      }
    }

    const keyDates = await knex("key_dates")
      .where({ project_id: award.project_id, is_contractual: true })
      .whereNotNull("target_date")
      .select<ContractualKeyDateRow[]>("id", "project_id", "target_date", "revised_from");

    for (const keyDate of keyDates) {
      const original = toIso(keyDate.revised_from ?? keyDate.target_date);
      const target = shift(original, days);
      if (target === toIso(keyDate.target_date) && keyDate.revised_from !== null) continue;
      await knex("key_dates").where({ id: keyDate.id }).update({
        target_date: target,
        revised_from: original,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // The date reconciliation corrected wrong data and is deliberately not undone
  // — putting the contract dates back out of step would only restore the bug.
  // The flag backfill is reversible, so that is what comes off.
  await labelMatch(knex("key_dates")).update({
    is_contractual: false,
    updated_at: new Date().toISOString(),
  });
}
