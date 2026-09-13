import type { Knex } from "knex";

const SIDES = ["client", "contractor", "consultant"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Which side of the contract a participant sits on. It is not cosmetic: it
 * decides who may be ball-in-court on an RFI, who certifies a valuation and who
 * signs an inspection — a Resident Engineer is client-side even though they
 * work on site every day.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.text("side");
  });
  await knex.raw(
    `ALTER TABLE project_participants ADD CONSTRAINT project_participants_side_check CHECK (side IS NULL OR side IN (${check(SIDES)}))`,
  );
  await knex.raw(`UPDATE project_participants SET side = 'client' WHERE role = 'client'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE project_participants DROP CONSTRAINT IF EXISTS project_participants_side_check",
  );
  await knex.schema.alterTable("project_participants", (table) => {
    table.dropColumn("side");
  });
}
