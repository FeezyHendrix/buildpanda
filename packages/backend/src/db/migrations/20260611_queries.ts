import type { Knex } from "knex";

const STATUS = ["Open", "Answered", "Closed"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Queries: site questions / clarifications raised on a project (the
 * homeowner-friendly take on RFIs). A query is asked, optionally answered,
 * then closed, with a discussion thread. Feeds the "open questions" view in
 * project reporting.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("queries", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("subject").notNullable();
    table.text("question").notNullable();
    table.text("status").notNullable().defaultTo("Open");
    table.text("answer");
    table.date("due_date");
    table.text("asked_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("answered_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("answered_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE queries ADD CONSTRAINT queries_status_check CHECK (status IN (${check(STATUS)}))`,
  );

  await knex.schema.createTable("query_comments", (table) => {
    table.text("id").primary();
    table.text("query_id").notNullable().references("id").inTable("queries").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["query_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("query_comments");
  await knex.schema.dropTableIfExists("queries");
}
