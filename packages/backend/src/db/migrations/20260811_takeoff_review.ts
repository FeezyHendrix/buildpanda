import type { Knex } from "knex";

const TAKEOFF_KINDS = ["pdf", "dwg", "manual", "early"] as const;
const ROW_ORIGINS = ["ai", "manual", "prompt", "migrated"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

// Review needs to know where a line came from and why the engine doubted it,
// and a take-off needs to remember which drawing revision it measured.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.text("plan_id").references("id").inTable("proposal_plans").onDelete("SET NULL");
    table.text("takeoff_kind").notNullable().defaultTo("pdf");
  });
  await knex.raw(
    `ALTER TABLE precon_sessions ADD CONSTRAINT precon_sessions_takeoff_kind_check CHECK (takeoff_kind IN (${check(TAKEOFF_KINDS)}))`,
  );
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.text("confidence_reason");
    table.text("provenance");
    table.text("origin").notNullable().defaultTo("ai");
    table.timestamp("edited_at", { useTz: true });
    table.text("edited_by");
  });
  await knex.raw(
    `ALTER TABLE precon_boq_rows ADD CONSTRAINT precon_boq_rows_origin_check CHECK (origin IN (${check(ROW_ORIGINS)}))`,
  );
  // A DWG take-off now lands as a reviewable session; the job keeps the file record.
  await knex.schema.alterTable("takeoff_jobs", (table) => {
    table.text("session_id").references("id").inTable("precon_sessions").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("takeoff_jobs", (table) => {
    table.dropColumn("session_id");
  });
  await knex.raw("ALTER TABLE precon_boq_rows DROP CONSTRAINT IF EXISTS precon_boq_rows_origin_check");
  await knex.schema.alterTable("precon_boq_rows", (table) => {
    table.dropColumn("edited_by");
    table.dropColumn("edited_at");
    table.dropColumn("origin");
    table.dropColumn("provenance");
    table.dropColumn("confidence_reason");
  });
  await knex.raw("ALTER TABLE precon_sessions DROP CONSTRAINT IF EXISTS precon_sessions_takeoff_kind_check");
  await knex.schema.alterTable("precon_sessions", (table) => {
    table.dropColumn("takeoff_kind");
    table.dropColumn("plan_id");
  });
}
