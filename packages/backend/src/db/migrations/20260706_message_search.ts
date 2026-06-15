import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE messages
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body, ''))) STORED
  `);
  await knex.raw(`CREATE INDEX messages_search_idx ON messages USING GIN (search_vector)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS messages_search_idx`);
  await knex.raw(`ALTER TABLE messages DROP COLUMN IF EXISTS search_vector`);
}
