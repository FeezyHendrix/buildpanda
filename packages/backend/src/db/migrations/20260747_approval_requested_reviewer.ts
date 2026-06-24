import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table
      .text("requested_reviewer_id")
      .references("id")
      .inTable("user")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.dropColumn("requested_reviewer_id");
  });
}
