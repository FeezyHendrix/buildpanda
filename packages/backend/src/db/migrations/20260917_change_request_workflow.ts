import type { Knex } from "knex";

const CHANGE_TYPES = ["variation", "omission", "eot_only", "provisional_sum"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * A change request stops being a free-text ticket: it has a TYPE (a variation,
 * an omission, a time-only claim or a provisional-sum adjustment), it names the
 * stage it moves and the RFI or EOT claim it came from, a rejection carries a
 * reason, and each submitted version is kept in `revisions` so "v1 4.8m
 * rejected → v2 4.2m approved" survives.
 *
 * `eot_claim_id` deliberately carries no foreign key: the extension-of-time
 * table is created by a parallel workstream and this migration must apply
 * whichever order the two land in.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.text("type").notNullable().defaultTo("variation");
    table
      .text("stage_id")
      .nullable()
      .references("id")
      .inTable("project_phases")
      .onDelete("SET NULL");
    table.text("rfi_id").nullable().references("id").inTable("rfis").onDelete("SET NULL");
    table.text("eot_claim_id");
    table.text("rejected_reason");
    table.timestamp("submitted_at", { useTz: true });
    table.jsonb("revisions").notNullable().defaultTo("[]");
    table.index(["project_id", "type"]);
  });

  await knex.raw(
    `ALTER TABLE change_requests ADD CONSTRAINT change_requests_type_check CHECK (type IN (${check(CHANGE_TYPES)}))`,
  );

  // A change with no cost and days claimed only ever asked for time.
  await knex.raw(
    `UPDATE change_requests SET type = 'eot_only' WHERE cost_impact = 0 AND time_impact_days > 0`,
  );
  await knex.raw(
    `UPDATE change_requests SET type = 'omission' WHERE cost_impact < 0`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_type_check");
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropIndex(["project_id", "type"]);
    table.dropColumn("type");
    table.dropColumn("stage_id");
    table.dropColumn("rfi_id");
    table.dropColumn("eot_claim_id");
    table.dropColumn("rejected_reason");
    table.dropColumn("submitted_at");
    table.dropColumn("revisions");
  });
}
