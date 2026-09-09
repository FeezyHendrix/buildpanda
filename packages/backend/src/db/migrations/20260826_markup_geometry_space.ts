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
 * Stamping the existing rows as "percent" makes the record self-describing, so
 * a markup written in sheet points can sit beside them without either being
 * read in the wrong space.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE drawing_markups
    SET geometry = geometry || '{"space":"percent"}'::jsonb
    WHERE geometry->>'space' IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE drawing_markups
    SET geometry = geometry - 'space'
    WHERE geometry->>'space' = 'percent'
  `);
}
