import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("platform_settings", (table) => {
    table.text("id").primary();
    table.boolean("maintenance_enabled").notNullable().defaultTo(false);
    table.text("maintenance_message");
    table.text("updated_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("updated_by_name");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex("platform_settings").insert({ id: "singleton", maintenance_enabled: false });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("platform_settings");
}
