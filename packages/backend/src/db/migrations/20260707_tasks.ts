import type { Knex } from "knex";

const TASK_STATUS = ["Todo", "Doing", "Done"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_boards", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable().defaultTo("Tasks");
    table.boolean("is_default").notNullable().defaultTo(false);
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id"]);
  });
  await knex.raw(
    `CREATE UNIQUE INDEX task_boards_one_default_per_project ON task_boards (project_id) WHERE is_default`,
  );

  await knex.schema.createTable("task_columns", (table) => {
    table.text("id").primary();
    table.text("board_id").notNullable().references("id").inTable("task_boards").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("status").notNullable();
    table.integer("position").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["board_id", "position"]);
  });
  await knex.raw(
    `ALTER TABLE task_columns ADD CONSTRAINT task_columns_status_check CHECK (status IN (${check(TASK_STATUS)}))`,
  );

  await knex.schema.createTable("tasks", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("board_id").notNullable().references("id").inTable("task_boards").onDelete("CASCADE");
    table.text("column_id").notNullable().references("id").inTable("task_columns").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
    table.date("due_date");
    table.specificType("position", "double precision").notNullable().defaultTo(0);
    table.text("source_type");
    table.text("source_id");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id"]);
    table.index(["board_id"]);
    table.index(["column_id", "position"]);
    table.index(["assignee_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tasks");
  await knex.schema.dropTableIfExists("task_columns");
  await knex.schema.dropTableIfExists("task_boards");
}
