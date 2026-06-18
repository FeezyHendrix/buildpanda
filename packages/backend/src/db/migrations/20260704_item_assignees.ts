import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("queries", (table) => {
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
  });
  await knex.schema.alterTable("change_requests", (table) => {
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
  });
  await knex.schema.alterTable("activities", (table) => {
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("activities", (table) => {
    table.dropColumn("assignee_id");
  });
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropColumn("assignee_id");
  });
  await knex.schema.alterTable("queries", (table) => {
    table.dropColumn("assignee_id");
  });
}
