import type { Knex } from "knex";

export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS llm_calls_org_created_idx
       ON llm_calls (org_id, created_at DESC)
       WHERE org_id IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS llm_calls_org_created_idx`);
}
