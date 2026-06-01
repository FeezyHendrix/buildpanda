import type { Knex } from "knex";

const STATUS = ["Pending", "Approved", "Rejected", "Resubmit"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Approvals: items submitted for sign-off (the homeowner-friendly take on
 * submittals) — e.g. a tile selection, a fittings spec, a material sample.
 * Reviewer approves, rejects or asks for a resubmit, with a discussion thread.
 * Feeds the "awaiting sign-off" view in project reporting.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("approvals", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("category");
    table.text("description");
    table.text("status").notNullable().defaultTo("Pending");
    table.text("response");
    table.date("due_date");
    table.text("submitted_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("reviewed_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("reviewed_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE approvals ADD CONSTRAINT approvals_status_check CHECK (status IN (${check(STATUS)}))`,
  );

  await knex.schema.createTable("approval_comments", (table) => {
    table.text("id").primary();
    table.text("approval_id").notNullable().references("id").inTable("approvals").onDelete("CASCADE");
    table.text("author_id").notNullable();
    table.text("author_name").notNullable();
    table.text("body").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["approval_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("approval_comments");
  await knex.schema.dropTableIfExists("approvals");
}
