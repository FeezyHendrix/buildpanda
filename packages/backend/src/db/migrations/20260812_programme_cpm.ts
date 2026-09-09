import type { Knex } from "knex";

// Critical-path analysis and human editing on programme tasks.
//
// total_float_days / is_critical are the scheduler's backward-pass results,
// persisted on every read so the handoff and the assistant can query them
// without re-running the pass. origin records who last shaped the task: the
// drafter, a person in the editor, or a person through a Panda AI prompt.

const ORIGINS = ["ai", "manual", "prompt"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("precon_programme_tasks", (table) => {
    table.integer("total_float_days");
    table.boolean("is_critical").notNullable().defaultTo(false);
    table.text("origin").notNullable().defaultTo("ai");
  });
  await knex.raw(
    `ALTER TABLE precon_programme_tasks ADD CONSTRAINT precon_programme_tasks_origin_check CHECK (origin IN (${ORIGINS.map((v) => `'${v}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE precon_programme_tasks DROP CONSTRAINT IF EXISTS precon_programme_tasks_origin_check");
  await knex.schema.alterTable("precon_programme_tasks", (table) => {
    table.dropColumn("origin");
    table.dropColumn("is_critical");
    table.dropColumn("total_float_days");
  });
}
