import type { Knex } from "knex";

const PROJECT_ID = "marbella";
const OLD_NAME = "Project Marbella";
const NEW_NAME = "Sample Project";

export async function up(knex: Knex): Promise<void> {
  await knex("projects").where({ id: PROJECT_ID, name: OLD_NAME }).update({ name: NEW_NAME });
}

export async function down(knex: Knex): Promise<void> {
  await knex("projects").where({ id: PROJECT_ID, name: NEW_NAME }).update({ name: OLD_NAME });
}
