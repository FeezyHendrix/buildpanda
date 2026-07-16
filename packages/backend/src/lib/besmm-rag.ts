import type { Knex } from "knex";
import { embedText } from "./llm.ts";

export const BESMM_CORPUS_VERSION = "besmm4-2015";

export interface BesmmChunkRow {
  id: string;
  corpus_version: string;
  section_code: string;
  section_title: string;
  page_from: number;
  page_to: number;
  clause_ref: string | null;
  chunk_index: number;
  content: string;
  token_count: number | null;
}

export interface BesmmChunkInput extends Omit<BesmmChunkRow, "corpus_version"> {
  embedding: number[];
}

export interface BesmmMatch {
  sectionCode: string;
  sectionTitle: string;
  pageFrom: number;
  pageTo: number;
  clauseRef: string | null;
  content: string;
  score: number;
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export function besmmRag(db: Knex) {
  return {
    count: async (version = BESMM_CORPUS_VERSION): Promise<number> => {
      const row = await db<BesmmChunkRow>("besmm_chunks").where({ corpus_version: version }).count<{ count: string }>("id as count").first();
      return Number(row?.count ?? 0);
    },

    clear: (version = BESMM_CORPUS_VERSION) => db("besmm_chunks").where({ corpus_version: version }).del(),

    insertBatch: async (rows: BesmmChunkInput[], version = BESMM_CORPUS_VERSION): Promise<void> => {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({
        id: r.id,
        corpus_version: version,
        section_code: r.section_code,
        section_title: r.section_title,
        page_from: r.page_from,
        page_to: r.page_to,
        clause_ref: r.clause_ref,
        chunk_index: r.chunk_index,
        content: r.content,
        token_count: r.token_count,
        embedding: db.raw("?::vector", [toVectorLiteral(r.embedding)]),
      }));
      await db("besmm_chunks").insert(values);
    },

    // Section filter is applied before semantic ranking so an element only
    // retrieves rules from its own BESMM sections, not the nearest text overall.
    search: async (
      query: string,
      opts: { sectionCodes?: string[]; limit?: number; version?: string } = {},
    ): Promise<BesmmMatch[]> => {
      const { sectionCodes, limit = 6, version = BESMM_CORPUS_VERSION } = opts;
      const embedding = toVectorLiteral(await embedText(query));
      const rows = (await db("besmm_chunks")
        .select(
          "section_code",
          "section_title",
          "page_from",
          "page_to",
          "clause_ref",
          "content",
          db.raw("1 - (embedding <=> ?::vector) as score", [embedding]),
        )
        .where({ corpus_version: version })
        .modify((qb) => {
          if (sectionCodes && sectionCodes.length > 0) qb.whereIn("section_code", sectionCodes);
        })
        .whereNotNull("embedding")
        .orderByRaw("embedding <=> ?::vector", [embedding])
        .limit(limit)) as (Pick<
        BesmmChunkRow,
        "section_code" | "section_title" | "page_from" | "page_to" | "clause_ref" | "content"
      > & { score: number })[];
      return rows.map((r) => ({
        sectionCode: r.section_code,
        sectionTitle: r.section_title,
        pageFrom: r.page_from,
        pageTo: r.page_to,
        clauseRef: r.clause_ref,
        content: r.content,
        score: Number(r.score),
      }));
    },
  };
}

export type BesmmRag = ReturnType<typeof besmmRag>;
