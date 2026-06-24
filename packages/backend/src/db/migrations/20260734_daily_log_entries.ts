import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("daily_log_entries", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable();
    table.date("log_date").notNullable();
    table.text("author_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("author_name").notNullable();
    table.text("author_role").notNullable().defaultTo("member");
    table.text("body_html");
    table.text("body_text");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table
      .foreign(["project_id", "log_date"])
      .references(["project_id", "log_date"])
      .inTable("daily_logs")
      .onDelete("CASCADE");
    table.index(["project_id", "log_date"]);
  });

  await knex.schema.createTable("daily_log_entry_voids", (table) => {
    table.text("id").primary();
    table
      .text("entry_id")
      .notNullable()
      .references("id")
      .inTable("daily_log_entries")
      .onDelete("CASCADE");
    table.text("reason").notNullable();
    table.text("voided_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("voided_by_name").notNullable();
    table.timestamp("voided_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["entry_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("daily_log_entry_voids");
  await knex.schema.dropTableIfExists("daily_log_entries");
}
