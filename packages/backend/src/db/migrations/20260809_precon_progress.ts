import type { Knex } from "knex";

// Phase + progress log make a running take-off resumable: a refresh mid-run
// re-reads exactly where the engine is instead of an empty checklist. Scope
// records what the run was asked to produce (whole bill / named sections /
// measured areas only); NULL means the pre-scope default of a full bill.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.text("phase");
    table.jsonb("progress_log");
    table.jsonb("scope");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("scope");
    table.dropColumn("progress_log");
    table.dropColumn("phase");
  });
}
