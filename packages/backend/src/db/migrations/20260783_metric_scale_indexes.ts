import type { Knex } from "knex";

export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS session_updated_at_idx ON session ("updatedAt" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS user_created_at_idx ON "user" ("createdAt" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS session_updated_at_idx`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS user_created_at_idx`);
}
