import type { Knex } from "knex";

const XKT_STATUS = ["Pending", "Ready", "Failed", "Skipped"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("bim_model_versions", (table) => {
    table.text("xkt_storage_path");
    table.text("xkt_status").notNullable().defaultTo("Pending");
  });
  await knex.raw(
    `ALTER TABLE bim_model_versions ADD CONSTRAINT bim_model_versions_xkt_status_check CHECK (xkt_status IN (${check(XKT_STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE bim_model_versions DROP CONSTRAINT IF EXISTS bim_model_versions_xkt_status_check");
  await knex.schema.alterTable("bim_model_versions", (table) => {
    table.dropColumn("xkt_status");
    table.dropColumn("xkt_storage_path");
  });
}
