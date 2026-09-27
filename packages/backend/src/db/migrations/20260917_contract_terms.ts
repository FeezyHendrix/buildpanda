import type { Knex } from "knex";

const CONTRACT_FORMS = ["fidic_red", "fidic_yellow", "jct", "nec", "bespoke"] as const;
const VALUATION_FREQUENCIES = ["monthly", "milestone"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * The contract terms a QS actually needs on a works contract: the parties, the
 * contract form and period, liquidated damages (rate per day + cap), VAT, the
 * certificate the advance starts being recovered from, the retention cap and
 * the valuation frequency. Defects liability moves from days to months because
 * that is how every standard form expresses it.
 *
 * Every rate on this table is a FRACTION (0.05 = 5%). `advance_recovery_rate`
 * was being written as a percentage (10 for 10%) while `retention_rate` was a
 * fraction, so any consumer applying both was wrong by 100x on one of them —
 * the data fix below normalises the stored values.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.decimal("liquidated_damages_rate", 14, 2).notNullable().defaultTo(0);
    table.decimal("liquidated_damages_cap_percent", 6, 4).notNullable().defaultTo(0);
    table.date("commencement_date");
    table.date("completion_date");
    table.text("employer_name");
    table.text("contractor_name");
    table.text("contract_form");
    table.decimal("vat_rate", 6, 4).notNullable().defaultTo(0.075);
    table.integer("advance_recovery_from_certificate").notNullable().defaultTo(2);
    table.decimal("retention_cap_percent", 6, 4).notNullable().defaultTo(0);
    table.text("valuation_frequency").notNullable().defaultTo("monthly");
    table.integer("defects_period_months").notNullable().defaultTo(12);
  });

  await knex.raw(
    `ALTER TABLE project_finances ADD CONSTRAINT project_finances_contract_form_check CHECK (contract_form IS NULL OR contract_form IN (${check(CONTRACT_FORMS)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_finances ADD CONSTRAINT project_finances_valuation_frequency_check CHECK (valuation_frequency IN (${check(VALUATION_FREQUENCIES)}))`,
  );

  // Defects liability was recorded in days; contracts express it in months.
  await knex.raw(
    `UPDATE project_finances SET defects_period_months = GREATEST(1, ROUND(defects_liability_days / 30.0)) WHERE defects_liability_days > 0`,
  );

  // Data fix: a recovery rate above 1 is a percentage that was never converted.
  await knex.raw(
    `UPDATE project_finances SET advance_recovery_rate = advance_recovery_rate / 100 WHERE advance_recovery_rate > 1`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE project_finances DROP CONSTRAINT IF EXISTS project_finances_valuation_frequency_check",
  );
  await knex.raw(
    "ALTER TABLE project_finances DROP CONSTRAINT IF EXISTS project_finances_contract_form_check",
  );
  await knex.schema.alterTable("project_finances", (table) => {
    table.dropColumn("liquidated_damages_rate");
    table.dropColumn("liquidated_damages_cap_percent");
    table.dropColumn("commencement_date");
    table.dropColumn("completion_date");
    table.dropColumn("employer_name");
    table.dropColumn("contractor_name");
    table.dropColumn("contract_form");
    table.dropColumn("vat_rate");
    table.dropColumn("advance_recovery_from_certificate");
    table.dropColumn("retention_cap_percent");
    table.dropColumn("valuation_frequency");
    table.dropColumn("defects_period_months");
  });
}
