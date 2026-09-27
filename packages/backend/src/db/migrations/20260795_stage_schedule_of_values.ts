import type { Knex } from "knex";

/**
 * Build Stages become the Schedule of Values. Each stage carries a scheduled
 * contract `value`; `stage_schedule_of_values` breaks that value into monthly
 * billing lines (a `percent` of the stage value -> a stored `amount`), which
 * pay-application invoices claim against. Amounts are reconciled to the stage
 * value with Money.allocate at the service layer; money is logged, not moved.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_phases", (table) => {
    table.decimal("value", 14, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable("stage_schedule_of_values", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table
      .text("stage_id")
      .notNullable()
      .references("id")
      .inTable("project_phases")
      .onDelete("CASCADE");
    table.text("period").notNullable();
    table.decimal("percent", 7, 4).notNullable().defaultTo(0);
    table.decimal("amount", 14, 2).notNullable().defaultTo(0);
    table.boolean("billed").notNullable().defaultTo(false);
    table.integer("sort_order").notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(["stage_id", "period"]);
    table.index(["project_id"]);
    table.index(["stage_id", "sort_order"]);
  });

  await knex.raw(
    `ALTER TABLE stage_schedule_of_values
     ADD CONSTRAINT stage_sov_period_format_check
     CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')`,
  );
  await knex.raw(
    `ALTER TABLE stage_schedule_of_values
     ADD CONSTRAINT stage_sov_percent_range_check
     CHECK (percent >= 0 AND percent <= 100)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("stage_schedule_of_values");
  await knex.schema.alterTable("project_phases", (table) => {
    table.dropColumn("value");
  });
}
