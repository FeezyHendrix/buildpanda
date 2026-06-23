import type { Knex } from "knex";

// material_ledger_entry_files.file_id was RESTRICT, blocking the uploaded_files
// cascade when a user is deleted. CASCADE lets user deletion clear these rows.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entry_files", (table) => {
    table.dropForeign(["file_id"]);
  });
  await knex.schema.alterTable("material_ledger_entry_files", (table) => {
    table
      .foreign("file_id")
      .references("id")
      .inTable("uploaded_files")
      .onDelete("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entry_files", (table) => {
    table.dropForeign(["file_id"]);
  });
  await knex.schema.alterTable("material_ledger_entry_files", (table) => {
    table
      .foreign("file_id")
      .references("id")
      .inTable("uploaded_files")
      .onDelete("RESTRICT");
  });
}
