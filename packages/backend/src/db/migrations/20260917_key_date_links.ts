import type { Knex } from "knex";

/**
 * A key date stops floating free of the programme. `linked_activity_id` anchors
 * it to the activity that delivers it, so a delay cascade carries the date with
 * it and stamps `revised_from` with the date originally programmed.
 *
 * `is_contractual` is the brake: Practical Completion, sectional completion and
 * the defects-liability end are contract dates with liquidated-damages
 * consequences. They never drift because an activity slipped — they move only
 * when an extension of time is awarded.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("key_dates", (table) => {
    table.text("linked_activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.boolean("is_contractual").notNullable().defaultTo(false);
    table.date("revised_from");
    table.index(["linked_activity_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("key_dates", (table) => {
    table.dropIndex(["linked_activity_id"]);
    table.dropColumn("revised_from");
    table.dropColumn("is_contractual");
    table.dropColumn("linked_activity_id");
  });
}
