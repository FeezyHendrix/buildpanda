import type { Knex } from "knex";

const STATUS = ["Open", "InProgress", "Blocked", "Resolved"] as const;
const PRIORITY = ["Low", "Medium", "High", "Urgent"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Action items / open issues: a lightweight tracker for things that need doing
 * or resolving on a project, with assignee, priority, due date and comments.
 * Feeds the "what's blocking progress" view in project reporting.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("action_items", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.text("status").notNullable().defaultTo("Open");
    table.text("priority").notNullable().defaultTo("Medium");
    table.text("assignee_id").references("id").inTable("user").onDelete("SET NULL");
    table.date("due_date");
    table.timestamp("resolved_at", { useTz: true });
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE action_items ADD CONSTRAINT action_items_status_check CHECK (status IN (${check(STATUS)}))`,
  );
  await knex.raw(
    `ALTER TABLE action_items ADD CONSTRAINT action_items_priority_check CHECK (priority IN (${check(PRIORITY)}))`,
  );

  await knex.schema.createTable("action_item_comments", (table) => {
    table.text("id").primary();
    table
      .text("action_item_id")
      .notNullable()
      .references("id")
      .inTable("action_items")
      .onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["action_item_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("action_item_comments");
  await knex.schema.dropTableIfExists("action_items");
}
