import type { Knex } from "knex";

const SESSION_STATUS = ["active", "completed"] as const;
const DOC_KIND = ["programme", "boq", "drawing", "ifc"] as const;
const DOC_STATUS = [
  "pending",
  "processing",
  "ready",
  "applied",
  "skipped",
  "failed",
] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("import_sessions", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("status").notNullable().defaultTo("active");
    table.text("created_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index("project_id");
    table.index("created_by");
  });
  await knex.raw(
    `ALTER TABLE import_sessions ADD CONSTRAINT import_sessions_status_check CHECK (status IN (${check(SESSION_STATUS)}))`,
  );

  await knex.schema.createTable("import_session_documents", (table) => {
    table.text("id").primary();
    table
      .text("session_id")
      .notNullable()
      .references("id")
      .inTable("import_sessions")
      .onDelete("CASCADE");
    table.text("kind").notNullable();
    table.text("job_id");
    table.text("file_name");
    table.text("status").notNullable().defaultTo("pending");
    table.text("error");
    table.timestamp("applied_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index("session_id");
  });
  await knex.raw(
    `ALTER TABLE import_session_documents ADD CONSTRAINT import_session_documents_kind_check CHECK (kind IN (${check(DOC_KIND)}))`,
  );
  await knex.raw(
    `ALTER TABLE import_session_documents ADD CONSTRAINT import_session_documents_status_check CHECK (status IN (${check(DOC_STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("import_session_documents");
  await knex.schema.dropTableIfExists("import_sessions");
}
