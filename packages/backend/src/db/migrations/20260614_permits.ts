import type { Knex } from "knex";

const STATUS = ["NotStarted", "Applied", "Approved", "Rejected", "Expired"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Permits & approvals: regulatory permits and government approvals for a build
 * (e.g. building permit, town-planning approval, C of O). Tracks the authority,
 * reference, status and key dates (applied / approved / expiry). Feeds the
 * schedule-risk view (pending or expired approvals block progress).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("permits", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("authority");
    table.text("reference_no");
    table.text("status").notNullable().defaultTo("NotStarted");
    table.date("applied_date");
    table.date("approved_date");
    table.date("expiry_date");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "status"]);
  });
  await knex.raw(
    `ALTER TABLE permits ADD CONSTRAINT permits_status_check CHECK (status IN (${check(STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("permits");
}
