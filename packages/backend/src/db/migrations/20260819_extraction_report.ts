import type { Knex } from "knex";

// The extraction report records what the parser found in a drawing before
// anything is measured: counts by layer and type, the units decision, blocks,
// dimensions, and what could not be read. It lives on the session (one report
// per sheet) with a compact summary on each sheet row for the viewer.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.jsonb("extraction");
  });
  await knex.schema.alterTable("precon_sheets", (table) => {
    table.jsonb("geo_summary");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sheets", (table) => {
    table.dropColumn("geo_summary");
  });
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("extraction");
  });
}
