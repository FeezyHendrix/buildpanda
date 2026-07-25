import type { Knex } from "knex";

const CATEGORY_TYPES = ["preset", "custom"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("custom_transaction_categories", (table) => {
    table.text("id").primary();
    table
      .text("org_id")
      .notNullable()
      .references("id")
      .inTable("organization")
      .onDelete("CASCADE");
    table.text("label").notNullable();
    table.text("color");
    table
      .text("created_by_id")
      .references("id")
      .inTable("user")
      .onDelete("SET NULL");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["org_id"]);
  });

  await knex.raw(
    `CREATE UNIQUE INDEX custom_transaction_categories_org_label_ci_unique
     ON custom_transaction_categories (org_id, LOWER(label))`,
  );

  await knex.schema.createTable("project_transactions", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("category").notNullable();
    table.text("category_type").notNullable().defaultTo("preset");
    table.decimal("amount", 14, 2).notNullable();
    table.date("transacted_at").notNullable();
    table.text("vendor");
    table.text("reference");
    table
      .text("receipt_file_id")
      .references("id")
      .inTable("uploaded_files")
      .onDelete("SET NULL");
    table
      .text("created_by_id")
      .references("id")
      .inTable("user")
      .onDelete("SET NULL");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["project_id", "transacted_at"]);
    table.index(["project_id", "category"]);
  });

  await knex.raw(
    `ALTER TABLE project_transactions
     ADD CONSTRAINT project_transactions_category_type_check
     CHECK (category_type IN (${check(CATEGORY_TYPES)}))`,
  );

  await knex.raw(
    `ALTER TABLE project_transactions
     ADD CONSTRAINT project_transactions_amount_positive
     CHECK (amount >= 0)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_transactions");
  await knex.schema.dropTableIfExists("custom_transaction_categories");
}
