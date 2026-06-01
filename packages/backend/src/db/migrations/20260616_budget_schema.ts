import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_budget_categories", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("cost_code");
    table.decimal("planned", 14, 2).notNullable().defaultTo(0);
    table.decimal("committed", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual", 14, 2).notNullable().defaultTo(0);
    table.text("notes");
    table.integer("sort_order").notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(["project_id", "sort_order"]);
  });
  await knex.raw(
    `ALTER TABLE project_budget_categories ADD CONSTRAINT project_budget_categories_amounts_check CHECK (planned >= 0 AND committed >= 0 AND actual >= 0)`,
  );

  await knex.schema.createTable("project_budget_periods", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("period").notNullable();
    table.decimal("planned", 14, 2).notNullable().defaultTo(0);
    table.decimal("actual", 14, 2).notNullable().defaultTo(0);
    table.text("notes");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(["project_id", "period"]);
    table.index(["project_id", "period"]);
  });
  await knex.raw(
    `ALTER TABLE project_budget_periods ADD CONSTRAINT project_budget_periods_amounts_check CHECK (planned >= 0 AND actual >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE project_budget_periods ADD CONSTRAINT project_budget_periods_period_check CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_budget_periods");
  await knex.schema.dropTableIfExists("project_budget_categories");
}
