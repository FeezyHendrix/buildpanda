import type { Knex } from "knex";

const PAYMENT_CLAIM_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Paid"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payment_claims", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("milestone_payment_id").references("id").inTable("milestone_payments").onDelete("SET NULL");
    table.text("claim_number").notNullable();
    table.text("period_start");
    table.text("period_end");
    table.decimal("amount", 14, 2).notNullable();
    table.text("status").notNullable().defaultTo("Draft");
    table.text("submitted_at");
    table.text("approved_at");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE payment_claims ADD CONSTRAINT payment_claims_status_check CHECK (status IN (${check(PAYMENT_CLAIM_STATUSES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payment_claims");
}
