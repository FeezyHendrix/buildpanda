import type { Knex } from "knex";

const CATEGORY_ID = "cat_proposal";
const CATEGORY_NAME = "Proposal";

export async function up(knex: Knex): Promise<void> {
  await knex("document_categories")
    .insert({
      id: CATEGORY_ID,
      name: CATEGORY_NAME,
      tone: "brand",
      group: "contract",
    })
    .onConflict("id")
    .ignore();
}

export async function down(knex: Knex): Promise<void> {
  await knex("document_categories").where({ id: CATEGORY_ID }).delete();
}
