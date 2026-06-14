import type { Knex } from "knex";

const STATUSES = ["pending", "processing", "completed", "failed", "applied"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("programme_import_jobs", (table) => {
    table.text("id").primary();
    table.text("organization_id");
    table.text("status").notNullable().defaultTo("pending");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.jsonb("result").notNullable().defaultTo("{}");
    table.integer("activity_count").notNullable().defaultTo(0);
    table.integer("phase_count").notNullable().defaultTo(0);
    table.boolean("used_ai").notNullable().defaultTo(false);
    table.text("created_project_id").references("id").inTable("projects").onDelete("SET NULL");
    table.text("error");
    table.text("requested_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["requested_by", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE programme_import_jobs ADD CONSTRAINT programme_import_jobs_status_check CHECK (status IN (${check(STATUSES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("programme_import_jobs");
}
