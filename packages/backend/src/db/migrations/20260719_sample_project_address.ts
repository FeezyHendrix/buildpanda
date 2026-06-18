import type { Knex } from "knex";

const PROJECT_ID = "sample-project";
const OLD_ADDRESS = "30, John great court, Lekki, Lagos state";
const NEW_ADDRESS = "123 Example Street, Sample City";

export async function up(knex: Knex): Promise<void> {
  await knex("projects")
    .where({ id: PROJECT_ID, address: OLD_ADDRESS })
    .update({ address: NEW_ADDRESS });
}

export async function down(knex: Knex): Promise<void> {
  await knex("projects")
    .where({ id: PROJECT_ID, address: NEW_ADDRESS })
    .update({ address: OLD_ADDRESS });
}
