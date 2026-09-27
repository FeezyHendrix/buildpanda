import type { Knex } from "knex";

/**
 * Which re-run of the automated take-off a result belongs to.
 *
 * A re-run is a long round trip: the reviewer corrects the layer map or a
 * sheet scale, a job reads the drawing again, and minutes later a set of
 * drafted lines comes back to be written over the old ones. Nothing recorded
 * WHICH request a returning result was computed for, so two failures had no
 * defence:
 *
 *   * the reviewer corrects the map twice and the slower first job lands last,
 *     overwriting the corrected reading with the one it replaced;
 *   * a queue redelivers a job whose result already landed, and the same
 *     drafted lines are inserted a second time — the duplicate suggestions
 *     reviewers were seeing.
 *
 * The counter is bumped when a re-run is REQUESTED and again when its result is
 * applied, and the job carries the number it was queued at. A result whose
 * number is no longer current is refused inside the session lock, before a
 * single row moves — which covers both cases with one comparison.
 *
 * `0` is a take-off that has never been re-run, which is every existing row.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.integer("rerun_generation").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("rerun_generation");
  });
}
