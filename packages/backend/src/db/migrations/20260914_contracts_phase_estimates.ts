import type { Knex } from "knex";

const CONTRACT_KINDS = ["main", "change_order"] as const;
const CONTRACT_STATUSES = ["Draft", "Pending", "Signed"] as const;
const CHANGE_REQUEST_STATUSES = ["Draft", "Submitted", "Approved", "Executed", "Rejected"] as const;
const PRIOR_CHANGE_REQUEST_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;
const INVOICE_STATUSES = ["Draft", "Submitted", "Approved", "Paid", "Queried"] as const;
const PRIOR_INVOICE_STATUSES = ["Draft", "Submitted", "Approved", "Paid"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Contract records. Every project has one main contract (materialised from the
 * finances contract terms on first read) and one change-order contract per
 * approved change request. A build stage belongs to a contract; null means the
 * main contract. Stages also carry their estimate figures (expected cost, labour
 * hours, labour and material budgets) so the Phases tab can show estimate vs
 * used. A change request gains `Executed` (the signed change-order contract is
 * in force) and an invoice gains `Queried` (a client query holds the ladder) and
 * the billing month it was raised for.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_contracts", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("kind").notNullable();
    table
      .text("change_request_id")
      .nullable()
      .unique()
      .references("id")
      .inTable("change_requests")
      .onDelete("SET NULL");
    table.text("title").notNullable();
    table.text("trade");
    table.text("legal_entity");
    table.decimal("total", 14, 2).notNullable().defaultTo(0);
    table.text("status").notNullable().defaultTo("Draft");
    table.text("document_id").nullable().references("id").inTable("project_documents").onDelete("SET NULL");
    table.date("signed_at");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE project_contracts ADD CONSTRAINT project_contracts_kind_check CHECK (kind IN (${check(CONTRACT_KINDS)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_contracts ADD CONSTRAINT project_contracts_status_check CHECK (status IN (${check(CONTRACT_STATUSES)}))`,
  );
  // One main contract per project; change-order contracts are unique by change request.
  await knex.raw(
    `CREATE UNIQUE INDEX project_contracts_one_main ON project_contracts (project_id) WHERE kind = 'main'`,
  );

  await knex.schema.alterTable("project_phases", (table) => {
    table.text("contract_id").nullable().references("id").inTable("project_contracts").onDelete("SET NULL");
    table.decimal("expected_cost", 14, 2).notNullable().defaultTo(0);
    table.decimal("estimated_labor_hours", 10, 2).notNullable().defaultTo(0);
    table.decimal("labor_budget", 14, 2).notNullable().defaultTo(0);
    table.decimal("material_budget", 14, 2).notNullable().defaultTo(0);
    table.index(["contract_id"]);
  });

  await knex.raw("ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check");
  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_status_check CHECK (status IN (${check(CHANGE_REQUEST_STATUSES)}))`,
  );

  await knex.raw("ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_status_check");
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_status_check CHECK (status IN (${check(INVOICE_STATUSES)}))`,
  );
  await knex.schema.alterTable("project_invoices", (table) => {
    table.text("billing_period").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropColumn("billing_period");
  });
  await knex("project_invoices").where({ status: "Queried" }).update({ status: "Submitted" });
  await knex.raw("ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_status_check");
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_status_check CHECK (status IN (${check(PRIOR_INVOICE_STATUSES)}))`,
  );

  await knex("change_requests").where({ status: "Executed" }).update({ status: "Approved" });
  await knex.raw("ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check");
  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_status_check CHECK (status IN (${check(PRIOR_CHANGE_REQUEST_STATUSES)}))`,
  );

  await knex.schema.alterTable("project_phases", (table) => {
    table.dropIndex(["contract_id"]);
    table.dropColumn("contract_id");
    table.dropColumn("expected_cost");
    table.dropColumn("estimated_labor_hours");
    table.dropColumn("labor_budget");
    table.dropColumn("material_budget");
  });

  await knex.schema.dropTableIfExists("project_contracts");
}
