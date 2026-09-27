import type { Knex } from "knex";

/**
 * A time claim IS a change request.
 *
 * An extension-of-time claim and a change request of type `eot_only` record the
 * same contractual instrument: a proposal, decided by someone other than the
 * person who raised it, that moves the Time for Completion. Keeping two
 * registers meant the same claim could be argued twice, counted twice in the
 * EOT position, and answered differently depending on which page you opened.
 *
 * So the claim folds into the change request:
 *  • `days_awarded` — the decision usually grants fewer days than were claimed,
 *    and the difference between claim and award is the negotiation. Days
 *    claimed is the change request's existing `time_impact_days`.
 *  • `change_request_delays` — the delay events the claim is argued from. A
 *    claim may only cite delays that are not the contractor's own risk, which
 *    is checked against these rows on submit and on approval.
 *  • `eot_claim_id` goes: the record it pointed at is no longer read.
 *
 * `extension_of_time_claims` and its rows are LEFT IN PLACE. Dropping a table
 * that holds decided contractual records is one-way, and nothing asked for it;
 * this migration stops reading from it, it does not destroy it.
 */

/** Claim status onto change-request status. Every EOT status already exists. */
const STATUS_MAP: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
};

interface ClaimRow {
  id: string;
  project_id: string;
  title: string;
  days_claimed: number;
  days_awarded: number | null;
  status: string;
  reason: string | null;
  delay_ids: string[] | string | null;
  decided_by_id: string | null;
  decided_at: Date | string | null;
  submitted_at: Date | string | null;
  notes: string | null;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * The change request a claim becomes, derived from the claim id so the move is
 * reversible exactly (down() deletes precisely these rows) and so the record
 * carries its own provenance.
 */
function changeIdFor(claimId: string): string {
  return `chg_${claimId}`;
}

function delayIdsOf(raw: ClaimRow["delay_ids"]): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.integer("days_awarded");
    table.dropColumn("eot_claim_id");
  });
  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_days_awarded_check
     CHECK (days_awarded IS NULL OR days_awarded >= 0)`,
  );

  await knex.schema.createTable("change_request_delays", (table) => {
    table.text("id").primary();
    table
      .text("change_request_id")
      .notNullable()
      .references("id")
      .inTable("change_requests")
      .onDelete("CASCADE");
    table
      .text("delay_id")
      .notNullable()
      .references("id")
      .inTable("activity_delays")
      .onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["change_request_id", "delay_id"]);
    table.index(["delay_id"]);
  });

  const claims = await knex<ClaimRow>("extension_of_time_claims").select("*");
  if (claims.length === 0) return;

  // A claim that was already folded by hand must not be duplicated.
  const existing = new Set(
    await knex("change_requests")
      .whereIn("id", claims.map((c) => changeIdFor(c.id)))
      .pluck<string[]>("id"),
  );
  const pending = claims.filter((claim) => !existing.has(changeIdFor(claim.id)));
  if (pending.length === 0) return;

  const currencies = new Map(
    (
      await knex("projects")
        .whereIn("id", [...new Set(pending.map((c) => c.project_id))])
        .select<Array<{ id: string; currency: string | null }>>("id", "currency")
    ).map((row) => [row.id, row.currency ?? "NGN"]),
  );

  await knex("change_requests").insert(
    pending.map((claim) => ({
      id: changeIdFor(claim.id),
      project_id: claim.project_id,
      title: claim.title,
      // The claim's working notes are the change's details; its grounds are
      // the reason, which is what a decision has to answer.
      description: claim.notes,
      description_html: null,
      reason: claim.reason,
      reason_html: null,
      status: STATUS_MAP[claim.status] ?? "Draft",
      type: "eot_only",
      cost_impact: "0",
      time_impact_days: claim.days_claimed,
      days_awarded: claim.days_awarded,
      currency: currencies.get(claim.project_id) ?? "NGN",
      submitted_by_id: claim.created_by_id,
      decided_by_id: claim.decided_by_id,
      decided_at: claim.decided_at,
      submitted_at: claim.submitted_at,
      revisions: JSON.stringify([]),
      created_at: claim.created_at,
      updated_at: claim.updated_at,
    })),
  );

  // Only delays that still exist can be carried across; a deleted delay leaves
  // the claim's days intact, which is what the paper record says anyway.
  const citedIds = [...new Set(pending.flatMap((claim) => delayIdsOf(claim.delay_ids)))];
  if (citedIds.length === 0) return;
  const live = new Set(await knex("activity_delays").whereIn("id", citedIds).pluck<string[]>("id"));
  const links = pending.flatMap((claim) =>
    delayIdsOf(claim.delay_ids)
      .filter((delayId) => live.has(delayId))
      .map((delayId) => ({
        id: `crd_${claim.id}_${delayId}`.slice(0, 200),
        change_request_id: changeIdFor(claim.id),
        delay_id: delayId,
      })),
  );
  if (links.length > 0) await knex("change_request_delays").insert(links);
}

export async function down(knex: Knex): Promise<void> {
  const claimIds = await knex("extension_of_time_claims").pluck<string[]>("id");
  if (claimIds.length > 0) {
    await knex("change_requests")
      .whereIn("id", claimIds.map(changeIdFor))
      .del();
  }

  await knex.schema.dropTableIfExists("change_request_delays");
  await knex.raw("ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_days_awarded_check");
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropColumn("days_awarded");
    table.text("eot_claim_id");
  });
}
