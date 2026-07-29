import type { Knex } from "knex";

const CONTRACT_TYPES = [
  "lump_sum",
  "cost_plus",
  "unit_rate",
  "gmp",
  "design_build",
  "target_cost",
] as const;

const RETENTION_RELEASE_MODES = [
  "all_at_practical_completion",
  "staged_pc_dlp",
  "all_at_dlp",
] as const;

const ADVANCE_RECOVERY_MODES = ["percentage", "fixed"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.text("contract_type").notNullable().defaultTo("lump_sum");
    table.text("retention_release_mode").notNullable().defaultTo("staged_pc_dlp");
    table.decimal("advance_percentage", 6, 4).notNullable().defaultTo(0);
    table.text("advance_recovery_mode").notNullable().defaultTo("percentage");
    table.decimal("advance_recovery_rate", 14, 4).notNullable().defaultTo(0);
    table.decimal("advance_recovered", 14, 2).notNullable().defaultTo(0);
    table.integer("payment_terms_days").notNullable().defaultTo(30);
    table.integer("defects_liability_days").notNullable().defaultTo(365);
    table.text("contract_notes");
  });

  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_contract_type_check
     CHECK (contract_type IN (${check(CONTRACT_TYPES)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_retention_release_mode_check
     CHECK (retention_release_mode IN (${check(RETENTION_RELEASE_MODES)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_advance_recovery_mode_check
     CHECK (advance_recovery_mode IN (${check(ADVANCE_RECOVERY_MODES)}))`,
  );
  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_advance_percentage_range
     CHECK (advance_percentage >= 0 AND advance_percentage <= 1)`,
  );
  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_payment_terms_days_positive
     CHECK (payment_terms_days >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE project_finances
     ADD CONSTRAINT project_finances_defects_liability_days_positive
     CHECK (defects_liability_days >= 0)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.dropColumn("contract_notes");
    table.dropColumn("defects_liability_days");
    table.dropColumn("payment_terms_days");
    table.dropColumn("advance_recovered");
    table.dropColumn("advance_recovery_rate");
    table.dropColumn("advance_recovery_mode");
    table.dropColumn("advance_percentage");
    table.dropColumn("retention_release_mode");
    table.dropColumn("contract_type");
  });
}
