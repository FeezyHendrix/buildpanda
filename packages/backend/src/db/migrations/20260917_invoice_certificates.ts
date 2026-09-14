import type { Knex } from "knex";

const INVOICE_TYPES = ["progress", "final", "variation", "vendor", "material", "advance"] as const;
const PRIOR_INVOICE_TYPES = ["progress", "final", "variation", "vendor", "material"] as const;
const DIRECTIONS = ["payable", "receivable"] as const;
const EVENT_TYPES = [
  "created",
  "sent",
  "queried",
  "approved",
  "voided",
  "payment_recorded",
  "payment_removed",
] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * An invoice becomes a certificate: it belongs to a contract, it has a
 * DIRECTION (receivable = what we certify to the employer; payable = what a
 * vendor bills us) and a named counterparty rather than the backwards "vendor"
 * label, it can carry an advance-recovery deduction, and it is VOIDED with a
 * reason rather than deleted once money has been recorded against it.
 *
 * Every status change is an append-only event with an actor and a reason —
 * a client query on a certificate is a formal dispute, not a dropdown.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table
      .text("contract_id")
      .nullable()
      .references("id")
      .inTable("project_contracts")
      .onDelete("SET NULL");
    table.text("direction").notNullable().defaultTo("payable");
    table.text("counterparty");
    table.decimal("advance_recovery", 14, 2).notNullable().defaultTo(0);
    table.timestamp("voided_at", { useTz: true });
    table.text("voided_by_id").nullable().references("id").inTable("user").onDelete("SET NULL");
    table.text("void_reason");
    table.index(["contract_id"]);
    table.index(["project_id", "direction"]);
  });

  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_direction_check CHECK (direction IN (${check(DIRECTIONS)}))`,
  );

  await knex.raw("ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_type_check");
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_type_check CHECK (invoice_type IN (${check(INVOICE_TYPES)}))`,
  );

  // What the contractor certifies to the employer is receivable; a vendor or
  // material invoice is what we owe. The counterparty is the party on the other
  // side of the certificate, whichever way it points.
  await knex.raw(
    `UPDATE project_invoices SET direction = 'receivable' WHERE invoice_type IN ('progress', 'final', 'variation')`,
  );
  await knex.raw("UPDATE project_invoices SET counterparty = vendor_name WHERE counterparty IS NULL");

  await knex.schema.alterTable("invoice_payments", (table) => {
    // An overpayment is recorded as a credit rather than silently driving the
    // balance negative.
    table.boolean("credit").notNullable().defaultTo(false);
    table.text("recorded_by_id").nullable().references("id").inTable("user").onDelete("SET NULL");
  });

  await knex.schema.createTable("invoice_events", (table) => {
    table.text("id").primary();
    table
      .text("invoice_id")
      .notNullable()
      .references("id")
      .inTable("project_invoices")
      .onDelete("CASCADE");
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("from_status");
    table.text("to_status");
    table.text("reason");
    table.text("actor_id").nullable().references("id").inTable("user").onDelete("SET NULL");
    table.text("actor_name").notNullable();
    table.decimal("amount", 14, 2);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["invoice_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE invoice_events ADD CONSTRAINT invoice_events_type_check CHECK (type IN (${check(EVENT_TYPES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("invoice_events");

  await knex.schema.alterTable("invoice_payments", (table) => {
    table.dropColumn("credit");
    table.dropColumn("recorded_by_id");
  });

  await knex("project_invoices").where({ invoice_type: "advance" }).update({ invoice_type: "progress" });
  await knex.raw("ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_type_check");
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_type_check CHECK (invoice_type IN (${check(PRIOR_INVOICE_TYPES)}))`,
  );
  await knex.raw(
    "ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_direction_check",
  );

  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropIndex(["project_id", "direction"]);
    table.dropIndex(["contract_id"]);
    table.dropColumn("contract_id");
    table.dropColumn("direction");
    table.dropColumn("counterparty");
    table.dropColumn("advance_recovery");
    table.dropColumn("voided_at");
    table.dropColumn("voided_by_id");
    table.dropColumn("void_reason");
  });
}
