import type { Knex } from "knex";

const STATUSES = ["pending", "processing", "completed", "failed", "applied"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_file_import_jobs", (table) => {
    table.text("id").primary();
    table.text("session_id").references("id").inTable("import_sessions").onDelete("SET NULL");
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("status").notNullable().defaultTo("pending");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.jsonb("extraction");
    table.text("error");
    table.text("requested_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE project_file_import_jobs ADD CONSTRAINT project_file_import_jobs_status_check CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(", ")}))`,
  );

  await knex.raw(`ALTER TABLE import_session_documents DROP CONSTRAINT IF EXISTS import_session_documents_kind_check`);
  await knex.raw(
    `ALTER TABLE import_session_documents ADD CONSTRAINT import_session_documents_kind_check CHECK (kind IN ('programme', 'boq', 'drawing', 'ifc', 'project_file'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE import_session_documents DROP CONSTRAINT IF EXISTS import_session_documents_kind_check`);
  await knex.raw(
    `ALTER TABLE import_session_documents ADD CONSTRAINT import_session_documents_kind_check CHECK (kind IN ('programme', 'boq', 'drawing', 'ifc'))`,
  );
  await knex.schema.dropTableIfExists("project_file_import_jobs");
}
