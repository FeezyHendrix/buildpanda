import type { Knex } from "knex";

/**
 * A DWG take-off is a register of drawings, not one sheet per file. Each
 * drawing found in the model space becomes a sheet with its own window
 * (`bounds`, drawing units) so the viewer frames just that drawing; the
 * session remembers the reviewer's layer map so a re-measure honours it;
 * every engine row keeps the entity handles it was computed from.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sheets", (table) => {
    table.jsonb("bounds");
  });
  await knex.raw(
    `ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_bounds_check CHECK (bounds IS NULL OR jsonb_typeof(bounds) = 'object')`,
  );
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.jsonb("layer_map");
  });
  await knex.raw(
    `ALTER TABLE precon_sessions ADD CONSTRAINT precon_sessions_layer_map_check CHECK (layer_map IS NULL OR jsonb_typeof(layer_map) = 'object')`,
  );
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.jsonb("evidence");
  });
  await knex.raw(
    `ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_evidence_check CHECK (evidence IS NULL OR jsonb_typeof(evidence) = 'array')`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE precon_boq_rows DROP CONSTRAINT IF EXISTS precon_boq_rows_evidence_check`);
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.dropColumn("evidence");
  });
  await knex.raw(`ALTER TABLE precon_sessions DROP CONSTRAINT IF EXISTS precon_sessions_layer_map_check`);
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("layer_map");
  });
  await knex.raw(`ALTER TABLE precon_sheets DROP CONSTRAINT IF EXISTS precon_sheets_bounds_check`);
  await knex.schema.alterTable("precon_sheets", (table) => {
    table.dropColumn("bounds");
  });
}
