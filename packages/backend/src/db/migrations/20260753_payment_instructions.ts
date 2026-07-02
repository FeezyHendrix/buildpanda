import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (table) => {
    // Org-level default: how clients should pay (bank details, reference format).
    table.text("payment_instructions");
  });
  await knex.schema.alterTable("project_invoices", (table) => {
    // Snapshotted per invoice so the issued document stays stable if the org default changes.
    table.text("payment_instructions");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (table) => {
    table.dropColumn("payment_instructions");
  });
  await knex.schema.alterTable("project_invoices", (table) => {
    table.dropColumn("payment_instructions");
  });
}
