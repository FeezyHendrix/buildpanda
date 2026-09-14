import type { Knex } from "knex";

/**
 * Name the space every markup's coordinates are in.
 *
 * Markups have always stored percentages of the rendered sheet. A percentage
 * survives any zoom but carries no scale, so a length drawn that way can never
 * become a quantity — which is what keeps the review viewer and the take-off
 * viewer apart. Take-off geometry is in sheet points against a calibrated
 * scale.
 *
 * Each existing row is stamped with the space its anchor has always implied:
 * percent for a project drawing, points for a take-off pin. That makes the
 * record self-describing, so the two can sit side by side without either
 * being read in the wrong space.
 */
export async function up(knex: Knex): Promise<void> {
  // a project drawing's markup has always been in percent of the rendered sheet
  await knex.raw(`
    UPDATE drawing_markups
    SET geometry = geometry || '{"space":"percent"}'::jsonb
    WHERE geometry->>'space' IS NULL AND document_version_id IS NOT NULL
  `);
  // a take-off pin has always been in sheet points, so it stays with the
  // measurements at any raster scale
  await knex.raw(`
    UPDATE drawing_markups
    SET geometry = geometry || '{"space":"points"}'::jsonb
    WHERE geometry->>'space' IS NULL AND precon_sheet_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE drawing_markups
    SET geometry = geometry - 'space'
    WHERE geometry->>'space' IN ('percent', 'points')
  `);
}
