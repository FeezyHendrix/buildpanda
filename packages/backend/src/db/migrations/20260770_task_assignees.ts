import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("task_assignees", (table) => {
    table.text("task_id").notNullable().references("id").inTable("tasks").onDelete("CASCADE");
    table.text("assignee_id").references("id").inTable("user").onDelete("CASCADE");
    table.text("assignee_team_member_id").references("id").inTable("team_members").onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["task_id"]);
    table.index(["assignee_id"]);
    table.index(["assignee_team_member_id"]);
  });

  await knex.raw(`
    ALTER TABLE task_assignees
    ADD CONSTRAINT task_assignees_one_assignee_check
    CHECK (
      (assignee_id IS NOT NULL AND assignee_team_member_id IS NULL)
      OR (assignee_id IS NULL AND assignee_team_member_id IS NOT NULL)
    )
  `);
  await knex.raw(
    `CREATE UNIQUE INDEX task_assignees_unique_user ON task_assignees (task_id, assignee_id) WHERE assignee_id IS NOT NULL`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX task_assignees_unique_team_member ON task_assignees (task_id, assignee_team_member_id) WHERE assignee_team_member_id IS NOT NULL`,
  );

  await knex.raw(`
    INSERT INTO task_assignees (task_id, assignee_id)
    SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await knex.raw(`
    INSERT INTO task_assignees (task_id, assignee_team_member_id)
    SELECT id, assignee_team_member_id FROM tasks WHERE assignee_team_member_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("task_assignees");
}
