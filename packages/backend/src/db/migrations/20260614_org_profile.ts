import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (table) => {
    table.text("phone");
    table.text("address");
    table.text("contact_email");
    table.text("website");
    table.text("default_currency").notNullable().defaultTo("NGN");
    table.text("default_tax_label").defaultTo("VAT");
    table.decimal("default_tax_pct", 5, 2).defaultTo(7.5);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organization", (table) => {
    table.dropColumns(
      "phone",
      "address",
      "contact_email",
      "website",
      "default_currency",
      "default_tax_label",
      "default_tax_pct",
    );
  });
}
