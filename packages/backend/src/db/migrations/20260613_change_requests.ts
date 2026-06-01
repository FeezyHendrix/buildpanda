import type { Knex } from "knex";

const STATUS = ["Draft", "Submitted", "Approved", "Rejected"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Change requests: proposed changes to scope/cost/schedule (the homeowner take
 * on change orders). Each carries a cost impact and a time impact in days that
 * feed budget-variance and schedule reporting. Includes a discussion thread.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("change_requests", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("reason");
    table.text("status").notNullable().defaultTo("Draft");
    table.decimal("cost_impact", 14, 2).notNullable().defaultTo(0);
    table.integer("time_impact_days").notNullable().defaultTo(0);
    table.text("currency").notNullable().defaultTo("NGN");
    table.text("submitted_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("decided_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("decided_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_status_check CHECK (status IN (${check(STATUS)}))`,
  );
  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_currency_check CHECK (currency IN ('NGN', 'USD'))`,
  );

  await knex.schema.createTable("change_request_comments", (table) => {
    table.text("id").primary();
    table
      .text("change_request_id")
      .notNullable()
      .references("id")
      .inTable("change_requests")
      .onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["change_request_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("change_request_comments");
  await knex.schema.dropTableIfExists("change_requests");
}
