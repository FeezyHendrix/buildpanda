import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_comments", (table) => {
    table.text("id").primary();
    table.text("task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["task_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("task_comments");
}
