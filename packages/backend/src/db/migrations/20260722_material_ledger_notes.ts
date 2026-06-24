import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.text("notes_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.dropColumn("notes_html");
  });
}
