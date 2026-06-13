import type { Knex } from "knex";

const RECURRENCE_UNITS = ["day", "week", "month"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("action_items", (table) => {
    table.text("recur_unit");
    table.integer("recur_interval");
    table.date("recur_until");
    table.text("recur_parent_id").references("id").inTable("action_items").onDelete("SET NULL");
    table.timestamp("reminded_at", { useTz: true });
  });

  await knex.raw(
    `ALTER TABLE action_items ADD CONSTRAINT action_items_recur_unit_check CHECK (recur_unit IN (${check(RECURRENCE_UNITS)}))`,
  );
  await knex.raw(
    "ALTER TABLE action_items ADD CONSTRAINT action_items_recur_interval_check CHECK (recur_interval IS NULL OR recur_interval >= 1)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_recur_interval_check");
  await knex.raw("ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_recur_unit_check");
  await knex.schema.alterTable("action_items", (table) => {
    table.dropColumn("reminded_at");
    table.dropColumn("recur_parent_id");
    table.dropColumn("recur_until");
    table.dropColumn("recur_interval");
    table.dropColumn("recur_unit");
  });
}
