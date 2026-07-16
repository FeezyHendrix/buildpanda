import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../../../db/connection.ts";
import { generateId } from "../../../../lib/ids.ts";
import { embedTexts } from "../../../../lib/llm.ts";
import { besmmRag, BESMM_CORPUS_VERSION, type BesmmChunkInput } from "../../../../lib/besmm-rag.ts";
import { sectionForPage } from "../../../../lib/besmm-sections.ts";

interface CorpusChunk {
  id: string;
  source: string;
  page: number;
  text: string;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(HERE, "../../../../../../../data/knowledge-base/besmm-corpus.json");
const EMBED_BATCH = 96;

async function main(): Promise<void> {
  const raw = await fs.readFile(CORPUS_PATH, "utf8");
  const chunks = (JSON.parse(raw) as CorpusChunk[]).filter((c) => c.source === "besmm4" && c.text.trim().length > 0);
  console.log(`Loaded ${chunks.length} BESMM4 chunks from ${CORPUS_PATH}`);

  const rag = besmmRag(db);
  await rag.clear();
  console.log(`Cleared existing corpus version ${BESMM_CORPUS_VERSION}`);

  let seeded = 0;
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const embeddings = await embedTexts(batch.map((c) => c.text));
    const rows: BesmmChunkInput[] = batch.map((c, j) => {
      const section = sectionForPage(c.page);
      return {
        id: generateId("bch"),
        section_code: section.code,
        section_title: section.title,
        page_from: c.page,
        page_to: c.page,
        clause_ref: null,
        chunk_index: i + j,
        content: c.text,
        token_count: Math.ceil(c.text.length / 4),
        embedding: embeddings[j]!,
      };
    });
    await rag.insertBatch(rows);
    seeded += rows.length;
    console.log(`Seeded ${seeded}/${chunks.length}`);
  }

  const total = await rag.count();
  console.log(`Done. besmm_chunks now holds ${total} rows for ${BESMM_CORPUS_VERSION}`);
  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
