import type { Knex } from "knex";

const STATUSES = ["pending", "processing", "completed", "failed"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("takeoff_jobs", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table
      .text("proposal_id")
      .references("id")
      .inTable("proposals")
      .onDelete("CASCADE");
    table
      .text("file_id")
      .references("id")
      .inTable("uploaded_files")
      .onDelete("SET NULL");
    table.text("status").notNullable().defaultTo("pending");
    table.text("file_name").notNullable();
    table.text("storage_path").notNullable();
    table.jsonb("result");
    table.integer("drawing_count").notNullable().defaultTo(0);
    table.integer("element_count").notNullable().defaultTo(0);
    table.text("error");
    table.text("requested_by");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
    table.index(["proposal_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE takeoff_jobs ADD CONSTRAINT takeoff_jobs_target_check CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL)`,
  );
  await knex.raw(
    `ALTER TABLE takeoff_jobs ADD CONSTRAINT takeoff_jobs_status_check CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("takeoff_jobs");
}
