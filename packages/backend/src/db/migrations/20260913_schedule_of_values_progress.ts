import type { Knex } from "knex";

/**
 * The billing sheet records CUMULATIVE percent complete per stage per month
 * (AIA G703 column G). `percent` stays the planned share of the stage value for
 * that month and `billed` whether the month was invoiced; `percent_complete`
 * is what was actually reached by the end of the month, so the period amount
 * is (this month's cumulative − previous month's) × scheduled value. Null means
 * "not recorded yet".
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("stage_schedule_of_values", (table) => {
    table.decimal("percent_complete", 7, 4).nullable();
  });
  await knex.raw(
    `ALTER TABLE stage_schedule_of_values
     ADD CONSTRAINT stage_sov_percent_complete_range_check
     CHECK (percent_complete IS NULL OR (percent_complete >= 0 AND percent_complete <= 100))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE stage_schedule_of_values DROP CONSTRAINT IF EXISTS stage_sov_percent_complete_range_check",
  );
  await knex.schema.alterTable("stage_schedule_of_values", (table) => {
    table.dropColumn("percent_complete");
  });
}
