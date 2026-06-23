import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("change_request_budget_links", (table) => {
    table.text("id").primary();
    table
      .text("change_request_id")
      .notNullable()
      .references("id")
      .inTable("change_requests")
      .onDelete("CASCADE");
    // The project_budget_categories table is introduced by the next migration.
    // Add the FK there so fresh DBs can run migrations in timestamp order.
    table.text("budget_category_id").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.boolean("committed").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["change_request_id", "budget_category_id"]);
    table.index("change_request_id");
    table.index("budget_category_id");
  });

  await knex.schema.createTable("invoice_budget_allocations", (table) => {
    table.text("id").primary();
    table
      .text("invoice_id")
      .notNullable()
      .references("id")
      .inTable("project_invoices")
      .onDelete("CASCADE");
    table.text("budget_category_id").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["invoice_id", "budget_category_id"]);
    table.index("invoice_id");
    table.index("budget_category_id");
  });

  await knex.schema.createTable("programme_cost_phasing", (table) => {
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.string("period", 7).notNullable();
    table.decimal("planned_cost", 14, 2).notNullable();
    table.integer("programme_version").notNullable();
    table.primary(["project_id", "period", "programme_version"]);
    table.index(["project_id", "programme_version"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("programme_cost_phasing");
  await knex.schema.dropTableIfExists("invoice_budget_allocations");
  await knex.schema.dropTableIfExists("change_request_budget_links");
}
