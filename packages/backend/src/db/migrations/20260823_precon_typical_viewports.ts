import type { Knex } from "knex";

/**
 * Two things a person measuring by hand needs that the AI path never did.
 *
 * `typical`: a line drawn once and repeated on N identical floors or areas.
 * The drawn figure stays in `qty_gross`; net = (gross − deductions) × typical.
 * The M1 manual rows folded the multiplier into both columns and named it in
 * the basis ("× 4 typical floors"), so they are unfolded here.
 *
 * `viewports`: a details sheet carries several scales; each viewport is a
 * rectangle of the sheet (in sheet points) with its own mm-per-point.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.integer("typical").notNullable().defaultTo(1);
  });
  await knex.raw(`ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_typical_check CHECK (typical >= 1)`);
  await knex.raw(`
    UPDATE precon_boq_rows
    SET typical = (substring(measurement_basis from '× ([0-9]+) typical'))::integer,
        qty_gross = ROUND(qty / (substring(measurement_basis from '× ([0-9]+) typical'))::integer, 2)
    WHERE origin = 'manual'
      AND qty IS NOT NULL
      AND measurement_basis ~ '× [0-9]+ typical'
      AND (substring(measurement_basis from '× ([0-9]+) typical'))::integer > 1
  `);

  await knex.schema.alterTable("precon_sheets", (table) => {
    table.jsonb("viewports");
  });
  await knex.raw(
    `ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_viewports_check CHECK (viewports IS NULL OR jsonb_typeof(viewports) = 'array')`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE precon_sheets DROP CONSTRAINT IF EXISTS precon_sheets_viewports_check`);
  await knex.schema.alterTable("precon_sheets", (table) => {
    table.dropColumn("viewports");
  });
  // fold the multiplier back into the gross figure, as M1 stored it
  await knex.raw(`UPDATE precon_boq_rows SET qty_gross = qty WHERE origin = 'manual' AND typical > 1`);
  await knex.raw(`ALTER TABLE precon_boq_rows DROP CONSTRAINT IF EXISTS precon_boq_rows_typical_check`);
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.dropColumn("typical");
  });
}
