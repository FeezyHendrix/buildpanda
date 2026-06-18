import type { Knex } from "knex";

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "ZAR", "KES"] as const;
const OLD = ["NGN", "USD"] as const;

function list(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_currency_check");
  await knex.raw(
    `ALTER TABLE projects ADD CONSTRAINT projects_currency_check CHECK (currency IN (${list(CURRENCIES)}))`,
  );
  await knex.raw("ALTER TABLE project_finances DROP CONSTRAINT IF EXISTS project_finances_currency_check");
  await knex.raw(
    `ALTER TABLE project_finances ADD CONSTRAINT project_finances_currency_check CHECK (currency IN (${list(CURRENCIES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_currency_check");
  await knex.raw(
    `ALTER TABLE projects ADD CONSTRAINT projects_currency_check CHECK (currency IN (${list(OLD)}))`,
  );
  await knex.raw("ALTER TABLE project_finances DROP CONSTRAINT IF EXISTS project_finances_currency_check");
  await knex.raw(
    `ALTER TABLE project_finances ADD CONSTRAINT project_finances_currency_check CHECK (currency IN (${list(OLD)}))`,
  );
}
