import type { Knex } from "knex";

// Schedule item → milestone → claim → recorded invoice. Each hop keeps its
// state so the finances page can show where a stage payment sits, and a claim
// carries the arithmetic (retention, advance recovery, VAT, WHT) it was
// approved with rather than recomputing it later against changed terms.
const MILESTONE_CLAIM_STATES = ["pending", "claimable", "claimed", "certified", "paid"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("milestone_payments", (table) => {
    table.text("claim_state").notNullable().defaultTo("pending");
  });
  await knex.raw(
    `ALTER TABLE milestone_payments ADD CONSTRAINT milestone_payments_claim_state_check CHECK (claim_state IN (${check(MILESTONE_CLAIM_STATES)}))`,
  );

  await knex.schema.alterTable("payment_claims", (table) => {
    table.decimal("retention_amount", 14, 2);
    table.decimal("advance_recovery_amount", 14, 2);
    table.decimal("vat_amount", 14, 2);
    table.decimal("wht_amount", 14, 2);
    table.decimal("invoice_amount", 14, 2);
    table.text("invoice_number");
    table.timestamp("invoice_recorded_at", { useTz: true });
    table.text("invoice_recorded_by");
  });

  await knex.schema.alterTable("change_requests", (table) => {
    table.text("estimate_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropColumn("estimate_id");
  });
  await knex.schema.alterTable("payment_claims", (table) => {
    table.dropColumns(
      "retention_amount",
      "advance_recovery_amount",
      "vat_amount",
      "wht_amount",
      "invoice_amount",
      "invoice_number",
      "invoice_recorded_at",
      "invoice_recorded_by",
    );
  });
  await knex.raw("ALTER TABLE milestone_payments DROP CONSTRAINT IF EXISTS milestone_payments_claim_state_check");
  await knex.schema.alterTable("milestone_payments", (table) => {
    table.dropColumn("claim_state");
  });
}
