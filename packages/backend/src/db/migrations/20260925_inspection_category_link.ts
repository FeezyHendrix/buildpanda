import type { Knex } from "knex";

/**
 * The category on an inspection now points at the catalogue row it came from,
 * and cancelling records why — the dialog asked for a reason and the service
 * was discarding it.
 *
 * `category_id` already exists from the catalogue migration; this adds the
 * cancellation reason and backfills any inspection whose category matches a
 * catalogue row by name but was created before the link existed.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("inspections", (table) => {
    table.text("cancellation_reason");
  });
  await knex.raw(
    `UPDATE inspections i
        SET category_id = c.id
       FROM inspection_categories c, projects p
      WHERE i.category_id IS NULL
        AND p.id = i.project_id
        AND lower(c.name) = lower(i.category)
        AND c.project_id IS NULL
        AND (c.organization_id = p.organization_id OR c.organization_id IS NULL)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("inspections", (table) => {
    table.dropColumn("cancellation_reason");
  });
}
