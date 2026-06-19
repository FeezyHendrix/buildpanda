import type { Knex } from "knex";

const ORIGINAL_STATUS = ["Todo", "Doing", "Done"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE task_columns DROP CONSTRAINT IF EXISTS task_columns_status_check");
  await knex.schema.alterTable("task_columns", (table) => {
    table.text("status").nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex("task_columns").whereNull("status").update({ status: "Todo" });
  await knex.schema.alterTable("task_columns", (table) => {
    table.text("status").notNullable().alter();
  });
  const values = ORIGINAL_STATUS.map((v) => `'${v}'`).join(", ");
  await knex.raw(`ALTER TABLE task_columns ADD CONSTRAINT task_columns_status_check CHECK (status IN (${values}))`);
}
