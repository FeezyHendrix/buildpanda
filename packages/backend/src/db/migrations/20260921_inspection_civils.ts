import type { Knex } from "knex";

/**
 * A formation approval on a road is a hold point on an activity at a chainage,
 * and passing or failing it is a record with findings and a re-inspection date.
 * None of that was modelled: no link to an activity, no location, and "Action
 * required" carried no reason (findings F43, F44, F45).
 *
 * Categories are deliberately untouched here — they are becoming a
 * database-driven, admin-managed list in their own workstream.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("inspections", (table) => {
    table.text("activity_id").references("id").inTable("activities").onDelete("SET NULL");
    // Free text: "ch 0+420 – 0+540", "Block A level 2". A road has no rooms.
    table.text("location");
    // A hold point stops the work until it is passed — that is the whole reason
    // an inspection sits on the programme rather than beside it.
    table.boolean("hold_point").notNullable().defaultTo(false);
    table.text("outcome"); // pass | fail | null (not yet inspected)
    table.text("findings");
    table.date("reinspection_date");
    table.timestamp("inspected_at", { useTz: true });
    table.text("inspected_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("inspected_by_name");
    table.index(["activity_id"]);
  });
  await knex.raw(
    "ALTER TABLE inspections ADD CONSTRAINT inspections_outcome_check CHECK (outcome IS NULL OR outcome IN ('pass', 'fail'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_outcome_check");
  await knex.schema.alterTable("inspections", (table) => {
    table.dropIndex(["activity_id"]);
    table.dropColumn("inspected_by_name");
    table.dropColumn("inspected_by_id");
    table.dropColumn("inspected_at");
    table.dropColumn("reinspection_date");
    table.dropColumn("findings");
    table.dropColumn("outcome");
    table.dropColumn("hold_point");
    table.dropColumn("location");
    table.dropColumn("activity_id");
  });
}
