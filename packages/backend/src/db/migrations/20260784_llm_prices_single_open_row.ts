import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE UNIQUE INDEX llm_prices_one_open_per_model_idx
       ON llm_prices (model_version)
       WHERE effective_to IS NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS llm_prices_one_open_per_model_idx`);
}
