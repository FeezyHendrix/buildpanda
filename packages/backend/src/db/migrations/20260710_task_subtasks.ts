import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_subtasks", (table) => {
    table.text("id").primary();
    table.text("task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("title").notNullable();
    table.boolean("done").notNullable().defaultTo(false);
    table.integer("position").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["task_id", "position"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("task_subtasks");
}
