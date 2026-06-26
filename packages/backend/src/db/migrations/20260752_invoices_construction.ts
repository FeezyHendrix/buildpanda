import type { Knex } from "knex";

const INVOICE_TYPES = ["progress", "final", "variation", "vendor", "material"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table.text("invoice_type").notNullable().defaultTo("vendor");
    table.text("currency").notNullable().defaultTo("NGN");
    // Tax/retention rates: null falls back to org defaults, which fall back to config.
    table.decimal("vat_rate", 6, 3);
    table.decimal("wht_rate", 6, 3);
    table.decimal("retention_rate", 6, 3);
    // Derived money fields, snapshotted on every write so the document is stable.
    table.decimal("subtotal", 14, 2).notNullable().defaultTo(0);
    table.decimal("vat_amount", 14, 2).notNullable().defaultTo(0);
    table.decimal("wht_amount", 14, 2).notNullable().defaultTo(0);
    table.decimal("retention_amount", 14, 2).notNullable().defaultTo(0);
    table.decimal("total_invoiced", 14, 2).notNullable().defaultTo(0);
    table.decimal("net_payable", 14, 2).notNullable().defaultTo(0);
    // Snapshotted parties (name/address/tin/firs/bank) — invoices are legal docs.
    table.jsonb("from_party");
    table.jsonb("to_party");
    table.text("recipient_email");
    table.jsonb("cc_emails");
    table.jsonb("bcc_emails");
    table.text("po_reference_id").references("id").inTable("purchase_orders").onDelete("SET NULL");
    table.text("payment_claim_id").references("id").inTable("payment_claims").onDelete("SET NULL");
    table.text("milestone_payment_id").references("id").inTable("milestone_payments").onDelete("SET NULL");
    table.text("contract_reference");
    table.text("payment_terms");
    table.text("cover_note");
    table.text("header_text");
    table.text("footer_text");
    table.timestamp("sent_at", { useTz: true });
    table.jsonb("sent_to");
    table.text("public_token").unique();
    table.timestamp("viewed_at", { useTz: true });
    table.text("pdf_storage_key");
  });
  await knex.raw(
    `ALTER TABLE project_invoices ADD CONSTRAINT project_invoices_type_check CHECK (invoice_type IN (${check(INVOICE_TYPES)}))`,
  );

  await knex.schema.createTable("project_invoice_line_items", (table) => {
    table.text("id").primary();
    table.text("invoice_id").notNullable().references("id").inTable("project_invoices").onDelete("CASCADE");
    table.integer("position").notNullable().defaultTo(0);
    table.text("description").notNullable();
    table.decimal("quantity", 14, 2).notNullable().defaultTo(1);
    table.text("unit");
    table.decimal("unit_rate", 14, 2).notNullable().defaultTo(0);
    table.decimal("amount", 14, 2).notNullable().defaultTo(0);
    table.text("budget_category_id");
    table.boolean("is_variation").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["invoice_id", "position"]);
  });

  await knex.schema.alterTable("organization", (table) => {
    table.decimal("default_wht_pct", 6, 3);
    table.decimal("default_retention_pct", 6, 3);
    table.text("tin");
    table.text("firs_number");
    table.jsonb("bank_details");
    table.text("logo_file_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_invoice_line_items");
  await knex.raw("ALTER TABLE project_invoices DROP CONSTRAINT IF EXISTS project_invoices_type_check");
  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropColumns(
      "invoice_type", "currency", "vat_rate", "wht_rate", "retention_rate",
      "subtotal", "vat_amount", "wht_amount", "retention_amount", "total_invoiced", "net_payable",
      "from_party", "to_party", "recipient_email", "cc_emails", "bcc_emails",
      "po_reference_id", "payment_claim_id", "milestone_payment_id", "contract_reference",
      "payment_terms", "cover_note", "header_text", "footer_text",
      "sent_at", "sent_to", "public_token", "viewed_at", "pdf_storage_key",
    );
  });
  await knex.schema.alterTable("organization", (table) => {
    table.dropColumns("default_wht_pct", "default_retention_pct", "tin", "firs_number", "bank_details", "logo_file_id");
  });
}
