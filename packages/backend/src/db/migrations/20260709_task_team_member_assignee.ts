import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("tasks", (table) => {
    table.text("assignee_team_member_id").references("id").inTable("team_members").onDelete("SET NULL");
    table.index(["assignee_team_member_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("tasks", (table) => {
    table.dropColumn("assignee_team_member_id");
  });
}
