import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("daily_logs", (table) => {
    table.timestamp("voided_at", { useTz: true });
    table.text("voided_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("void_reason");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("daily_logs", (table) => {
    table.dropColumn("void_reason");
    table.dropColumn("voided_by_id");
    table.dropColumn("voided_at");
  });
}
