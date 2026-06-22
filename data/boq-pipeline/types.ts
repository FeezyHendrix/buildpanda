// Shared types + config for the DWG -> BOQ pipeline prototype.
// Knowledge base (BESMM PDFs) and outputs live under core/data.

export const REPO_ROOT = "/Users/drhendrix/projects/buildpanda/core";
export const DATA_DIR = `${REPO_ROOT}/data`;
export const KB_DIR = `${DATA_DIR}/knowledge-base`;
export const KB_INDEX_DIR = `${KB_DIR}/index`;

export const BESMM_PDFS = [
  { id: "besmm4", label: "BESMM4 (NIQS, 4th Ed. 2015)", path: `${KB_DIR}/BESMM4.pdf` },
  { id: "bessm-guide", label: "BoQ Preparation Guide using BESMM4", path: `${KB_DIR}/bessm.pdf` },
] as const;

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;
export const CHAT_MODEL = process.env["OPENAI_MODEL"] || "gpt-4o";
export const OPENAI_BASE = process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1";

export interface KbChunk {
  id: string;
  source: string;
  page: number;
  text: string;
}

export interface EmbeddedChunk extends KbChunk {
  embedding: number[];
}

// A single measured quantity taken off the drawing, before BESMM classification.
export interface TakeoffItem {
  trade: string; // e.g. "walls", "columns", "doors"
  layer: string;
  description: string;
  quantity: number;
  unit: string; // m, m2, m3, nr
  basis: string; // provenance: how it was measured
  assumptions: string[];
}

// A priced BOQ line, the final output shape (mirrors the Moniepoint bill).
export interface BoqLine {
  section: string; // BESMM work section, e.g. "SUBSTRUCTURE"
  sectionCode: string | null; // e.g. "E10"
  sn: string | null; // A, B, C...
  description: string;
  quantity: number | null;
  unit: string;
  rate: number | null;
  amount: number | null;
  confidence: "high" | "medium" | "low";
  provenance: string;
}

export interface ProjectMeta {
  name: string;
  currency: string; // ISO code, e.g. NGN
  currencySymbol: string;
  location: string;
}
