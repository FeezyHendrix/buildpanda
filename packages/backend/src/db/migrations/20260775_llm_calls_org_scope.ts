import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("llm_calls", (table) => {
    table
      .text("org_id")
      .references("id")
      .inTable("organization")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("llm_calls", (table) => {
    table.dropColumn("org_id");
  });
}
