import type { Knex } from "knex";

/**
 * A roof plan is a drawing in its own right, not an unclassified one: the
 * engine measures the roof covering and the eaves from it, so the register
 * needs a kind to file it under.
 */
const KINDS = ["floor-plan", "roof-plan", "elevation", "section", "detail", "schedule", "unknown"];
const OLD_KINDS = ["floor-plan", "elevation", "section", "detail", "schedule", "unknown"];

const list = (values: string[]): string => values.map((v) => `'${v}'`).join(", ");

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE precon_sheets DROP CONSTRAINT IF EXISTS precon_sheets_kind_check`);
  await knex.raw(`ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_kind_check CHECK (kind IN (${list(KINDS)}))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex("precon_sheets").where({ kind: "roof-plan" }).update({ kind: "unknown" });
  await knex.raw(`ALTER TABLE precon_sheets DROP CONSTRAINT IF EXISTS precon_sheets_kind_check`);
  await knex.raw(`ALTER TABLE precon_sheets ADD CONSTRAINT precon_sheets_kind_check CHECK (kind IN (${list(OLD_KINDS)}))`);
}
