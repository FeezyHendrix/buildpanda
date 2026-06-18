import type { Knex } from "knex";

const CURRENCIES = [
  "NGN", "USD", "GBP", "EUR", "GHS", "ZAR", "KES", "AED", "AFN", "ALL", "AMD", "ANG",
  "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD",
  "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP",
  "CNY", "COP", "CRC", "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "FJD", "FKP", "GEL", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL",
  "HRK", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY",
  "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD",
  "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR",
  "MWK", "MXN", "MYR", "MZN", "NAD", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN",
  "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD",
  "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP", "STN", "SVC",
  "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH",
  "UGX", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XDR", "XOF",
  "XPF", "XSU", "YER", "ZMW", "ZWG", "ZWL",
] as const;

const TABLES = [
  "projects",
  "project_finances",
  "activity_delays",
  "change_requests",
  "material_orders",
  "equipment_requests",
] as const;

function checkList(): string {
  return CURRENCIES.map((c) => `'${c}'`).join(", ");
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
