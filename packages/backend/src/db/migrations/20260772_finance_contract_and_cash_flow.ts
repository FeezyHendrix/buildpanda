import type { Knex } from "knex";

const CATEGORIES = ["valuation", "milestone_payment", "claims_payment"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.decimal("contract_sum", 14, 2).notNullable().defaultTo(0);
    table.decimal("variations_total", 14, 2).notNullable().defaultTo(0);
    table.decimal("certified_gross_to_date", 14, 2).notNullable().defaultTo(0);
    table.decimal("retention_rate", 6, 4).notNullable().defaultTo(0);
    table.decimal("retention_held", 14, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable("cash_flow_entries", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("category").notNullable();
    table.decimal("amount", 14, 2).notNullable();
    table.boolean("is_credit").notNullable().defaultTo(false);
    table.text("description");
    table.date("entry_date").notNullable();
    table
      .text("created_by_id")
      .references("id")
      .inTable("user")
      .onDelete("SET NULL");
    table.text("created_by_name");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.decimal("retention_accrued", 14, 2).notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["project_id", "sort_order"]);
    table.index(["project_id", "entry_date"]);
  });

  await knex.raw(
    `ALTER TABLE cash_flow_entries
     ADD CONSTRAINT cash_flow_entries_category_check
     CHECK (category IN (${check(CATEGORIES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cash_flow_entries");
  await knex.schema.alterTable("project_finances", (table) => {
    table.dropColumn("retention_held");
    table.dropColumn("retention_rate");
    table.dropColumn("certified_gross_to_date");
    table.dropColumn("variations_total");
    table.dropColumn("contract_sum");
  });
}
