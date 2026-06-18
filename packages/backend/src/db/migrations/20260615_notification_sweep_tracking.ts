import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table.timestamp("overdue_notified_at", { useTz: true });
  });
  await knex.schema.alterTable("permits", (table) => {
    table.timestamp("expiring_notified_at", { useTz: true });
    table.timestamp("expired_notified_at", { useTz: true });
  });
  await knex.schema.alterTable("key_dates", (table) => {
    table.timestamp("approaching_notified_at", { useTz: true });
    table.timestamp("missed_notified_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropColumn("overdue_notified_at");
  });
  await knex.schema.alterTable("permits", (table) => {
    table.dropColumn("expiring_notified_at");
    table.dropColumn("expired_notified_at");
  });
  await knex.schema.alterTable("key_dates", (table) => {
    table.dropColumn("approaching_notified_at");
    table.dropColumn("missed_notified_at");
  });
}
