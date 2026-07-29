import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.jsonb("structure_context");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("structure_context");
  });
}
