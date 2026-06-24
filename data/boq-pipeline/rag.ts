import * as fs from "node:fs";
import {
  EMBED_MODEL,
  KB_DIR,
  KB_INDEX_DIR,
  OPENAI_BASE,
  type EmbeddedChunk,
  type KbChunk,
} from "./types.ts";

const API_KEY = process.env["OPENAI_API_KEY"] ?? "";
const BATCH = 96;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!API_KEY) throw new Error("OPENAI_API_KEY not set");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(`${OPENAI_BASE}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    for (const d of json.data) out.push(d.embedding);
    process.stdout.write(`\r[rag] embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
  }
  process.stdout.write("\n");
  return out;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

// OpenAI embeddings are L2-normalised, so dot product == cosine similarity.
export class BesmmIndex {
  constructor(private readonly chunks: EmbeddedChunk[]) {}

  static load(): BesmmIndex {
    const path = `${KB_INDEX_DIR}/besmm-embeddings.json`;
    if (!fs.existsSync(path)) throw new Error(`index missing: ${path} — run kb-index first`);
    return new BesmmIndex(JSON.parse(fs.readFileSync(path, "utf8")) as EmbeddedChunk[]);
  }

  async search(query: string, k = 5): Promise<Array<{ chunk: EmbeddedChunk; score: number }>> {
    const [qv] = await embedTexts([query]);
    const scored = this.chunks.map((chunk) => ({ chunk, score: dot(qv!, chunk.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  get size(): number {
    return this.chunks.length;
  }
}

async function main(): Promise<void> {
  const corpusPath = `${KB_DIR}/besmm-corpus.json`;
  const chunks = JSON.parse(fs.readFileSync(corpusPath, "utf8")) as KbChunk[];
  console.log(`[rag] embedding ${chunks.length} BESMM chunks with ${EMBED_MODEL}...`);
  const vectors = await embedTexts(chunks.map((c) => c.text));
  const embedded: EmbeddedChunk[] = chunks.map((c, i) => ({ ...c, embedding: vectors[i]! }));
  const out = `${KB_INDEX_DIR}/besmm-embeddings.json`;
  fs.writeFileSync(out, JSON.stringify(embedded));
  console.log(`[rag] wrote ${embedded.length} embedded chunks -> ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[rag] FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
