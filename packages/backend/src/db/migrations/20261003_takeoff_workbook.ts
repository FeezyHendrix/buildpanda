import type { Knex } from "knex";

/**
 * The take-off workbook: an estimating document hanging off one take-off.
 *
 * Additive only. Nothing existing is altered, no quantity is recomputed, and no
 * measured figure moves here — this table holds what a QS *wrote around* the
 * take-off, never the take-off itself.
 *
 * One row per session, keyed by it, because a session has exactly one workbook
 * and a second would be two answers to "what does this bill price out at".
 *
 *   * `snapshot` — the worksheets as the user left them: formulas verbatim,
 *     scratch sheets, formatting. The generated cells are in here too, but they
 *     are a RENDERING of the source rows, never their authority.
 *   * `layout` — the server-owned map from worksheet + grid row + column back to
 *     the BOQ row and field it stands for. Identity lives here and nowhere else,
 *     so a client cannot rename a cell into another line's quantity.
 *   * `version` — optimistic concurrency, monotonic. A workbook that has never
 *     been saved has no row at all and reads as version 0.
 *   * `source_fingerprint` — DERIVED cache of the sources this snapshot was last
 *     calculated against. It exists so a read can say "your figures are behind",
 *     never so a stale figure can be served as current: every read recalculates
 *     from the live rows and publishes those values, whatever this column says.
 *
 * Deliberately absent: a cached `values` column. Contract 6 forbids serving a
 * calculated figure that was not produced from the sources as they are now, and
 * a values cache is exactly the thing that eventually gets served by mistake.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("precon_workbooks", (table) => {
    table.text("session_id").primary().references("id").inTable("precon_sessions").onDelete("CASCADE");
    table.jsonb("snapshot").notNullable();
    table.jsonb("layout").notNullable();
    table.integer("version").notNullable().defaultTo(1);
    table.text("engine_version").notNullable();
    table.text("source_fingerprint").notNullable();
    table.text("updated_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // A workbook's first save is version 1, and every later save is strictly
  // greater. Enforced here as well as in the service so a bug that wrote 0 —
  // which the API reserves for "never saved" — cannot reach the table.
  await knex.raw("ALTER TABLE precon_workbooks ADD CONSTRAINT precon_workbooks_version_check CHECK (version >= 1)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("precon_workbooks");
}
