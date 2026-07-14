import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table
      .text("source_file_id")
      .nullable()
      .references("id")
      .inTable("uploaded_files")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropColumn("source_file_id");
  });
}
