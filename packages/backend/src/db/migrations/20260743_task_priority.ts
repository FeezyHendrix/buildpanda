import type { Knex } from "knex";

const PRIORITIES = ["Low", "Medium", "High"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("tasks", (table) => {
    table.text("priority").notNullable().defaultTo("Medium");
  });
  await knex.raw(
    `ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN (${PRIORITIES.map(
      (p) => `'${p}'`,
    ).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check");
  await knex.schema.alterTable("tasks", (table) => {
    table.dropColumn("priority");
  });
}
