import type { Knex } from "knex";
import { SUPPORTED_CURRENCIES } from "../../lib/currencies.ts";

const TABLES = [
  "projects",
  "project_finances",
  "activity_delays",
  "change_requests",
  "material_orders",
  "equipment_requests",
] as const;

function checkList(): string {
  return SUPPORTED_CURRENCIES.map((c) => `'${c}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  const values = checkList();
  for (const table of TABLES) {
    const constraint = `${table}_currency_check`;
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
    await knex.raw(
      `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (currency IN (${values}))`,
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  const narrow = ["NGN", "USD"].map((c) => `'${c}'`).join(", ");
  const wide = ["NGN", "USD", "GBP", "EUR", "GHS", "ZAR", "KES"].map((c) => `'${c}'`).join(", ");
  const narrowTables = ["activity_delays", "change_requests", "material_orders", "equipment_requests"];
  const wideTables = ["projects", "project_finances"];
  for (const table of narrowTables) {
    const constraint = `${table}_currency_check`;
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (currency IN (${narrow}))`);
  }
  for (const table of wideTables) {
    const constraint = `${table}_currency_check`;
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (currency IN (${wide}))`);
  }
}
