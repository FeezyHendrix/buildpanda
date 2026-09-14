import type { Knex } from "knex";

/**
 * A decided approval is a record of a decision — it cannot be edited into
 * saying something else. When the sample is re-taken, the requester raises a
 * NEW request that points back at the one it replaces, so the approver can see
 * the chain: rejected LAT-OQ-001 → resubmission LAT-OQ-002.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table
      .text("resubmitted_from_id")
      .references("id")
      .inTable("approvals")
      .onDelete("SET NULL");
    table.index(["resubmitted_from_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.dropIndex(["resubmitted_from_id"]);
    table.dropColumn("resubmitted_from_id");
  });
}
