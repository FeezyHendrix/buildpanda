import type { Knex } from "knex";

const STATUSES = ["open", "mitigated", "closed", "occurred"];

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

/**
 * A risk that happened is not the same as a risk that was closed out. The NNPC
 * pipeline strike became RFI-1 and CR-002 — the register has to be able to say
 * so, and to point at the activity it threatens, instead of the row being
 * deleted (finding #24). Deleting a realised risk erases the very record a
 * dispute turns on.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_status_check");
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_status_check CHECK (status IN (${check(STATUSES)}))`,
  );
  await knex.schema.alterTable("risk_factors", (table) => {
    table.text("linked_activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.timestamp("closed_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex("risk_factors").where({ status: "occurred" }).update({ status: "closed" });
  await knex.schema.alterTable("risk_factors", (table) => {
    table.dropColumn("closed_at");
    table.dropColumn("linked_activity_id");
  });
  await knex.raw("ALTER TABLE risk_factors DROP CONSTRAINT IF EXISTS risk_factors_status_check");
  await knex.raw(
    `ALTER TABLE risk_factors ADD CONSTRAINT risk_factors_status_check CHECK (status IN (${check(
      STATUSES.filter((s) => s !== "occurred"),
    )}))`,
  );
}
