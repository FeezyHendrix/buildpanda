import * as fs from "node:fs";
import { BESMM_PDFS, KB_DIR, type KbChunk } from "./types.ts";

const MIN_CHUNK_CHARS = 200;
const MAX_CHUNK_CHARS = 1200;

async function pageLines(doc: unknown, pageIndex: number): Promise<string[]> {
  const d = doc as { loadPage(i: number): { toStructuredText(opt: string): { asJSON(): string } } };
  const page = d.loadPage(pageIndex);
  const st = JSON.parse(page.toStructuredText("preserve-whitespace").asJSON()) as {
    blocks?: Array<{ lines?: Array<{ text?: string }> }>;
  };
  const lines: string[] = [];
  for (const block of st.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const s = (line.text ?? "").replace(/\s+/g, " ").trim();
      if (s) lines.push(s);
    }
  }
  return lines;
}

// Group consecutive lines on a page into chunks bounded by char count, so each
// chunk is a coherent passage the embedder can represent well.
function chunkLines(source: string, page: number, lines: string[], startId: number): KbChunk[] {
  const chunks: KbChunk[] = [];
  let buf = "";
  let n = startId;
  const flush = () => {
    const text = buf.trim();
    if (text.length >= MIN_CHUNK_CHARS) {
      chunks.push({ id: `${source}-p${page}-${n}`, source, page, text });
      n += 1;
    }
    buf = "";
  };
  for (const line of lines) {
    if (buf.length + line.length + 1 > MAX_CHUNK_CHARS) flush();
    buf += (buf ? " " : "") + line;
  }
  if (buf.trim().length >= MIN_CHUNK_CHARS) flush();
  else if (buf.trim() && chunks.length > 0) {
    chunks[chunks.length - 1]!.text += " " + buf.trim();
  }
  return chunks;
}

export async function extractBesmmCorpus(): Promise<KbChunk[]> {
  const mupdf = await import("mupdf");
  const all: KbChunk[] = [];
  for (const pdf of BESMM_PDFS) {
    if (!fs.existsSync(pdf.path)) {
      console.warn(`[kb] missing ${pdf.path} — skipping`);
      continue;
    }
    const buf = fs.readFileSync(pdf.path);
    const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
    const pages = doc.countPages();
    let idCounter = 0;
    let made = 0;
    for (let i = 0; i < pages; i++) {
      const lines = await pageLines(doc, i);
      if (lines.length === 0) continue;
      const chunks = chunkLines(pdf.id, i + 1, lines, idCounter);
      idCounter += chunks.length;
      made += chunks.length;
      all.push(...chunks);
    }
    console.log(`[kb] ${pdf.id}: ${pages} pages -> ${made} chunks`);
  }
  return all;
}

async function main(): Promise<void> {
  const chunks = await extractBesmmCorpus();
  const out = `${KB_DIR}/besmm-corpus.json`;
  fs.writeFileSync(out, JSON.stringify(chunks));
  console.log(`[kb] wrote ${chunks.length} chunks -> ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[kb] FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
