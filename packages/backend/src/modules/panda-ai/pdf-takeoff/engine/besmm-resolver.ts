import type { Knex } from "knex";
import { besmmRag } from "../../../../lib/besmm-rag.ts";
import { isEmbeddingConfigured } from "../../../../lib/llm-embeddings.ts";
import { staticBesmmResolver, type BesmmResolver } from "./enrich.ts";

// BESMM reference passages for a brief, from the embedded reference when it is
// configured and the static excerpts otherwise.
export function besmmResolverFor(db: Knex): BesmmResolver {
  if (!isEmbeddingConfigured()) return staticBesmmResolver;
  const rag = besmmRag(db);
  return async (brief) => {
    try {
      const query = brief.retrievalQuery ?? `${brief.element}. ${brief.guidance}`;
      const matches = await rag.search(query, { sectionCodes: brief.sectionCodes, limit: 6 });
      if (matches.length === 0) return staticBesmmResolver(brief);
      const pages = matches.map((m) => m.pageFrom).join(", ");
      const body = matches.map((m) => `[p.${m.pageFrom}] ${m.content.trim()}`).join("\n\n");
      return [
        `<besmm_reference source="BESMM4 NIQS 4th Ed 2015" pages="${pages}">`,
        body,
        `</besmm_reference>`,
        "BESMM REFERENCE RULES:",
        "- Use these clauses to shape measurement decisions and produce BESMM-conformant description text.",
        "- PARAPHRASE. Never quote the reference text verbatim into a bill item description.",
        "- The billing template's unit is AUTHORITATIVE. If the reference implies a different unit, keep the template's unit.",
        "- The reference is OCR-extracted and table columns may be interleaved. Only rely on a threshold or number when it appears clearly and un-fragmented; otherwise ignore it.",
        `- For each item you rely on the reference for, set refPages to the page numbers you used, from this list only: ${pages}. Never invent page numbers.`,
      ].join("\n");
    } catch {
      return staticBesmmResolver(brief);
    }
  };
}

