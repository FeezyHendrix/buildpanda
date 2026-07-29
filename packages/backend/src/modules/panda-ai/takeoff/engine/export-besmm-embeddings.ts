import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../../../db/connection.ts";
import { BESMM_CORPUS_VERSION } from "../../../../lib/besmm-rag.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "besmm-embeddings.json");

interface Row {
  id: string;
  section_code: string;
  section_title: string;
  page_from: number;
  page_to: number;
  clause_ref: string | null;
  chunk_index: number;
  content: string;
  token_count: number | null;
  embedding: string;
}

async function main(): Promise<void> {
  const rows = (await db("besmm_chunks")
    .where({ corpus_version: BESMM_CORPUS_VERSION })
    .whereNotNull("embedding")
    .orderBy("chunk_index", "asc")
    .select("id", "section_code", "section_title", "page_from", "page_to", "clause_ref", "chunk_index", "content", "token_count", db.raw("embedding::text as embedding"))) as Row[];

  const out = rows.map((r) => ({
    id: r.id,
    section_code: r.section_code,
    section_title: r.section_title,
    page_from: r.page_from,
    page_to: r.page_to,
    clause_ref: r.clause_ref,
    chunk_index: r.chunk_index,
    content: r.content,
    token_count: r.token_count,
    embedding: (JSON.parse(r.embedding) as number[]),
  }));

  await fs.writeFile(OUT, JSON.stringify({ corpusVersion: BESMM_CORPUS_VERSION, count: out.length, chunks: out }));
  console.log(`Exported ${out.length} embeddings to ${OUT}`);
  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
