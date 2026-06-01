import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table
      .text("organization_id")
      .references("id")
      .inTable("organization")
      .onDelete("SET NULL");
    table.index("organization_id", "projects_organization_id_index");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropIndex("organization_id", "projects_organization_id_index");
    table.dropColumn("organization_id");
  });
}
