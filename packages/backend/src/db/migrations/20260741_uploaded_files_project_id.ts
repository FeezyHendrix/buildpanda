import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("uploaded_files", (table) => {
    table
      .text("project_id")
      .references("id")
      .inTable("projects")
      .onDelete("SET NULL");
    table.index(["project_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("uploaded_files", (table) => {
    table.dropIndex(["project_id"]);
    table.dropColumn("project_id");
  });
}
