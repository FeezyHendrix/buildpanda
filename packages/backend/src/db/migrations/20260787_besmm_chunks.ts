import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS vector`);

  await knex.schema.createTable("besmm_chunks", (table) => {
    table.text("id").primary();
    table.text("corpus_version").notNullable();
    table.text("section_code").notNullable();
    table.text("section_title").notNullable();
    table.integer("page_from").notNullable();
    table.integer("page_to").notNullable();
    table.text("clause_ref");
    table.integer("chunk_index").notNullable();
    table.text("content").notNullable();
    table.integer("token_count");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["corpus_version", "section_code"]);
    table.index(["corpus_version", "page_from", "page_to"]);
  });

  await knex.raw(`ALTER TABLE besmm_chunks ADD COLUMN embedding vector(1536)`);
  await knex.raw(
    `ALTER TABLE besmm_chunks ADD COLUMN content_tsv tsvector
       GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`,
  );
  await knex.raw(`CREATE INDEX besmm_chunks_tsv_idx ON besmm_chunks USING gin (content_tsv)`);
  await knex.raw(
    `CREATE INDEX besmm_chunks_hnsw_idx ON besmm_chunks
       USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("besmm_chunks");
}
