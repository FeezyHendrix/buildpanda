import type { Knex } from "knex";

/**
 * Days awarded on a time claim move the contract completion date, so the claim
 * has to remember how many it has already moved it by. Without that, re-deciding
 * a claim (14 days, then 9 on reconsideration) applies 9 more on top of the 14
 * instead of pulling 5 back, and rejecting an approved claim never returns the
 * time at all.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.integer("days_applied").notNullable().defaultTo(0);
  });
  // Every already-approved claim has had its full award applied once.
  await knex("change_requests")
    .where({ type: "eot_only" })
    .whereIn("status", ["Approved", "Executed"])
    .whereNotNull("days_awarded")
    .update({ days_applied: knex.raw("days_awarded") });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropColumn("days_applied");
  });
}
