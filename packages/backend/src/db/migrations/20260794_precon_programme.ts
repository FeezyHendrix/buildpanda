import type { Knex } from "knex";

// The programme of work generated alongside the BOQ from the same drawings.
//
// Tasks carry a DURATION and a dependency graph but no absolute dates: at tender
// stage there is no site start yet, so the calendar is anchored later from
// precon_sessions.programme_start_date and derived by a forward pass. Storing
// dates here instead would freeze a date that moves every time the start slips.

const TASK_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
const CONFIDENCES = ["high", "low"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.date("programme_start_date");
  });

  await knex.schema.createTable("precon_programme_tasks", (table) => {
    table.text("id").primary();
    table
      .text("session_id")
      .notNullable()
      .references("id")
      .inTable("precon_sessions")
      .onDelete("CASCADE");
    table.integer("sort").notNullable();
    table.text("name").notNullable();
    table.text("element_group");
    table.text("wbs_code");
    table.integer("outline_level").notNullable().defaultTo(1);
    table
      .text("parent_task_id")
      .references("id")
      .inTable("precon_programme_tasks")
      .onDelete("SET NULL");
    table.decimal("duration_days", 10, 2).notNullable().defaultTo(0);
    // [{ taskId, type: FS|SS|FF|SF, lagDays }] — same shape as activities.predecessors
    // so an applied programme maps straight onto the project schedule.
    table.jsonb("predecessors").notNullable().defaultTo("[]");
    table.boolean("is_milestone").notNullable().defaultTo(false);
    table.text("basis");
    table.text("confidence");
    table.text("status").notNullable().defaultTo("ai_generated");
    table.integer("version").notNullable().defaultTo(1);
    table.text("verified_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("verified_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id", "sort"]);
  });

  await knex.raw(
    `ALTER TABLE precon_programme_tasks ADD CONSTRAINT precon_programme_tasks_status_check CHECK (status IN (${check(TASK_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE precon_programme_tasks ADD CONSTRAINT precon_programme_tasks_confidence_check CHECK (confidence IS NULL OR confidence IN (${check(CONFIDENCES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("precon_programme_tasks");
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("programme_start_date");
  });
}
