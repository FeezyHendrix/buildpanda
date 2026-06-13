import type { Knex } from "knex";

const STATUSES = ["pending", "processing", "completed", "failed"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("boq_import_jobs", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("status").notNullable().defaultTo("pending");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.jsonb("materials").notNullable().defaultTo("[]");
    table.integer("material_count").notNullable().defaultTo(0);
    table.boolean("used_ai").notNullable().defaultTo(false);
    table.text("error");
    table.text("requested_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE boq_import_jobs ADD CONSTRAINT boq_import_jobs_status_check CHECK (status IN (${check(STATUSES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("boq_import_jobs");
}
