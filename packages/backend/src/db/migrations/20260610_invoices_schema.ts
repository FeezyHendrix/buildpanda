import type { Knex } from "knex";

const INVOICE_STATUSES = ["Draft", "Submitted", "Approved", "Paid"] as const;
const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Card", "Cheque", "Other"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_invoices", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("vendor_name").notNullable();
    table.text("trade").notNullable();
    table.text("number");
    table.text("status").notNullable().defaultTo("Draft");
    table.decimal("amount", 14, 2).notNullable().defaultTo(0);
    table.decimal("retainage_percentage", 5, 2).notNullable().defaultTo(0);
    table.text("issue_date");
    table.text("due_date");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_status_check CHECK (status IN (${check(INVOICE_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_retainage_check CHECK (retainage_percentage >= 0 AND retainage_percentage <= 100)`,
  );

  await knex.schema.createTable("invoice_payments", (table) => {
    table.text("id").primary();
    table
      .text("invoice_id")
      .notNullable()
      .references("id")
      .inTable("project_invoices")
      .onDelete("CASCADE");
    table.decimal("amount", 14, 2).notNullable();
    table.text("method").notNullable().defaultTo("Bank Transfer");
    table.text("paid_at");
    table.text("note");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["invoice_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_method_check CHECK (method IN (${check(PAYMENT_METHODS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("invoice_payments");
  await knex.schema.dropTableIfExists("project_invoices");
}
