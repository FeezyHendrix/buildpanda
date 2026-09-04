import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    // Defaults to Approved so every entry logged before this migration keeps
    // counting toward stock. Defaulting to Pending would gate the entire
    // existing ledger at once and read as every site losing its materials.
    // The service starts NEW entries as Pending; only they are gated.
    table.text("approval_status").notNullable().defaultTo("Approved");
    table
      .text("approved_by_id")
      .nullable()
      .references("id")
      .inTable("user")
      // The approval is a fact about a moment. Deleting the person who made it
      // must not delete the record that it happened.
      .onDelete("SET NULL");
    table.timestamp("approved_at", { useTz: true }).nullable();
    table.index(["project_id", "approval_status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.dropIndex(["project_id", "approval_status"]);
    table.dropColumn("approved_at");
    table.dropColumn("approved_by_id");
    table.dropColumn("approval_status");
  });
}
