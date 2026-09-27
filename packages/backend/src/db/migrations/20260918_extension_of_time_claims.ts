import type { Knex } from "knex";

/**
 * The EOT register. A claim is the contractual instrument that converts lost
 * time into relief: it cites the delay events it is built on, states the days
 * claimed, and — once the engineer or client decides it — records the days
 * awarded, who decided and when.
 *
 * `applied_days` is the ledger of what the award has already moved the
 * contractual dates by, so re-deciding a claim (14 days awarded, then revised
 * to 9) applies the difference instead of stacking a second award.
 */

const STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("extension_of_time_claims", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.integer("number").notNullable();
    table.text("title").notNullable();
    table.integer("days_claimed").notNullable().defaultTo(0);
    table.integer("days_awarded");
    table.integer("applied_days").notNullable().defaultTo(0);
    table.text("status").notNullable().defaultTo("Draft");
    table.text("reason");
    table.jsonb("delay_ids").notNullable().defaultTo("[]");
    table
      .text("change_request_id")
      .references("id")
      .inTable("change_requests")
      .onDelete("SET NULL");
    table.text("decided_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("decided_at", { useTz: true });
    table.timestamp("submitted_at", { useTz: true });
    table.text("notes");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["project_id", "number"]);
    table.index(["project_id", "status"]);
  });
  await knex.raw(
    `ALTER TABLE extension_of_time_claims ADD CONSTRAINT eot_claims_status_check
     CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(", ")}))`,
  );
  await knex.raw(
    `ALTER TABLE extension_of_time_claims ADD CONSTRAINT eot_claims_days_check
     CHECK (days_claimed >= 0 AND (days_awarded IS NULL OR days_awarded >= 0))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("extension_of_time_claims");
}
