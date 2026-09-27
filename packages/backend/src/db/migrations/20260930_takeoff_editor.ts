import type { Knex } from "knex";

/**
 * Take-off editor: lossless measurement definitions and reversible identity.
 *
 * Additive only — nothing existing is altered and no quantity is recomputed.
 * Four things a take-off needs to survive an audit that the schema could not
 * previously hold:
 *
 *   * `precon_geometries.definition` — the measurement as it was *made*: the
 *     tool, the factor (wall height, slab depth), the scale it was drawn
 *     against and the exact path. Today only the flattened vertices survive, so
 *     redrawing a wall loses the height that made it an area.
 *   * `parent_geometry_id` — a deduction is an opening *in* a parent
 *     measurement. RESTRICT, not CASCADE: silently deleting a wall must not
 *     silently delete the window openings that were netted off it and leave the
 *     bill line's arithmetic unexplainable.
 *   * `deleted_at` — a measurement withdrawn during a dispute is still a record
 *     of what was once claimed; it is soft-deleted, never erased.
 *   * `operation_id` / `reverses_event_id` on the audit trail — an undo is a new
 *     event that names the event it reverses, and a retried request carries the
 *     same operation id so it is recorded once, not twice.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_geometries", (table) => {
    table.jsonb("definition");
    table.timestamp("deleted_at", { useTz: true });
  });
  // knex's alter-table foreign() cannot express ON DELETE RESTRICT, so the
  // self-reference is added in raw SQL.
  await knex.raw(
    "ALTER TABLE precon_geometries ADD COLUMN parent_geometry_id text REFERENCES precon_geometries(id) ON DELETE RESTRICT",
  );
  await knex.schema.alterTable("precon_geometries", (table) => {
    table.index(["parent_geometry_id"], "precon_geometries_parent_idx");
  });

  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.timestamp("deleted_at", { useTz: true });
    table.jsonb("measurement_settings");
  });

  await knex.schema.alterTable("precon_sheets", (table) => {
    table.integer("version").notNullable().defaultTo(1);
    table.jsonb("calibration");
    table.jsonb("overlay_settings");
  });

  await knex.schema.alterTable("precon_audit_events", (table) => {
    table.text("operation_id");
    table.text("reverses_event_id");
  });
  // One operation id per actor per session records once: a retried save is the
  // same operation, not a second edit of the bill.
  await knex.raw(
    "CREATE UNIQUE INDEX precon_audit_events_op_id ON precon_audit_events(session_id, actor, operation_id) WHERE operation_id IS NOT NULL",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS precon_audit_events_op_id");
  await knex.schema.alterTable("precon_audit_events", (table) => {
    table.dropColumn("reverses_event_id");
    table.dropColumn("operation_id");
  });

  await knex.schema.alterTable("precon_sheets", (table) => {
    table.dropColumn("overlay_settings");
    table.dropColumn("calibration");
    table.dropColumn("version");
  });

  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.dropColumn("measurement_settings");
    table.dropColumn("deleted_at");
  });

  await knex.schema.alterTable("precon_geometries", (table) => {
    table.dropIndex(["parent_geometry_id"], "precon_geometries_parent_idx");
  });
  await knex.schema.alterTable("precon_geometries", (table) => {
    // Dropping the column drops its self-referencing foreign key with it.
    table.dropColumn("parent_geometry_id");
    table.dropColumn("deleted_at");
    table.dropColumn("definition");
  });
}
