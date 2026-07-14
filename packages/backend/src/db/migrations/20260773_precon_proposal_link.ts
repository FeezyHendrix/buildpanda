import type { Knex } from "knex";

// Preconstruction takeoffs are a capability of the proposal workspace, not a
// separate destination: sessions link to the proposal whose BOQ they feed.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.text("proposal_id").references("id").inTable("proposals").onDelete("SET NULL");
    table.index(["proposal_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropIndex(["proposal_id"]);
    table.dropColumn("proposal_id");
  });
}
