import type { Knex } from "knex";

export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS user_last_activity_at_idx
       ON "user" (last_activity_at DESC)
       WHERE last_activity_at IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS user_last_activity_at_idx`);
}
