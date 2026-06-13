import * as XLSX from "xlsx";
import { chatJson, isLlmConfigured, type LlmMessage } from "../../lib/llm.ts";

export interface ParsedMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  supplier: string | null;
}

export interface BoqExtractionResult {
  materials: ParsedMaterial[];
  usedAi: boolean;
}

interface BoqRow {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

const SYSTEM_PROMPT = `You are a quantity surveyor extracting materials from a construction Bill of Quantities (BoQ). You receive structured rows with columns: code, description, quantity, unit, rate, amount. Return ONLY genuine physical material or work items that a contractor would procure or build. EXCLUDE: section titles and headings (e.g. "FRAME", "ROOF", "SUBSTRUCTURE"), NRM/SMM work-section codes (e.g. "G10 STRUCTURAL STEEL WORK"), preamble/clause/condition text, "to Summary" and subtotal rows, page totals, and pure preliminaries items with no material. When a description says "Ditto" or "as above", infer the full material from the most recent real item. Normalise each kept item to: a clear material name, a numeric quantity (use 1 if only a lump sum), a unit (default "item"), an estimated cost as the amount if present else the rate, and supplier null. Respond ONLY with JSON of this exact shape:
{ "materials": [ { "materialName": string, "quantity": number, "unit": string, "estimatedCost": number, "supplier": null } ] }
Return { "materials": [] } if a chunk contains no real materials.`;

const ROWS_PER_CHUNK = 60;
const MAX_CHUNKS = 12;
const MAX_MATERIALS = 500;

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

interface ColumnMap {
  code: number;
  desc: number;
  qty: number;
  unit: number;
  rate: number;
  amount: number;
}

function findHeader(grid: unknown[][]): { row: number; cols: ColumnMap } | null {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = grid[i]!.map((c) => str(c).toLowerCase());
    const descIdx = cells.findIndex((c) => c.includes("description") || c === "item");
    const qtyIdx = cells.findIndex((c) => c === "qty" || c.includes("quantity"));
    const unitIdx = cells.findIndex((c) => c === "unit");
    if (descIdx >= 0 && (qtyIdx >= 0 || unitIdx >= 0)) {
      return {
        row: i,
        cols: {
          code: cells.findIndex((c) => c === "s/n" || c.includes("ref")),
          desc: descIdx,
          qty: qtyIdx,
          unit: unitIdx,
          rate: cells.findIndex((c) => c.includes("price") || c.includes("rate")),
          amount: cells.findIndex((c) => c.includes("amount") || c.includes("total")),
        },
      };
    }
  }
  return null;
}

function sheetToBoqRows(grid: unknown[][]): BoqRow[] {
  const header = findHeader(grid);
  if (!header) return [];
  const { row, cols } = header;
  const out: BoqRow[] = [];
  for (let i = row + 1; i < grid.length; i++) {
    const r = grid[i]!;
    const description = str(r[cols.desc]);
    if (!description) continue;
    out.push({
      code: cols.code >= 0 ? str(r[cols.code]) : "",
      description,
      quantity: cols.qty >= 0 ? num(r[cols.qty]) : 0,
      unit: cols.unit >= 0 ? str(r[cols.unit]) : "",
      rate: cols.rate >= 0 ? num(r[cols.rate]) : 0,
      amount: cols.amount >= 0 ? num(r[cols.amount]) : 0,
    });
  }
  return out;
}

function parseWorkbook(buffer: Buffer): BoqRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows: BoqRow[] = [];
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, {
      header: 1,
      defval: "",
    });
    rows.push(...sheetToBoqRows(grid));
  }
  return rows;
}

async function parsePdfRows(buffer: Buffer): Promise<BoqRow[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;
  const out: BoqRow[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    for (const line of text.split(/\s{3,}/)) {
      const desc = line.trim();
      if (desc.length > 6) {
        out.push({ code: "", description: desc, quantity: 0, unit: "", rate: 0, amount: 0 });
      }
    }
  }
  return out;
}

const NOISE =
  /\b(to summary|summary|sub-?total|carried (to|forward)|brought forward|collection|grand total|preliminaries and general|conditions of contract|preamble)\b/i;
const SECTION_HEADING = /^[A-Z0-9 ./&'"-]{4,}$/;

function isLikelyMaterial(row: BoqRow): boolean {
  const d = row.description;
  if (d.length < 4) return false;
  if (NOISE.test(d)) return false;
  const hasNumbers = row.quantity > 0 || row.amount > 0 || row.rate > 0;
  if (!hasNumbers) return false;
  const isAllCapsHeading = SECTION_HEADING.test(d) && d.split(/\s+/).length <= 6 && d === d.toUpperCase();
  if (isAllCapsHeading && row.quantity <= 0 && row.rate <= 0) {
    return false;
  }
  return true;
}

function deterministicExtract(rows: BoqRow[]): ParsedMaterial[] {
  const out: ParsedMaterial[] = [];
  for (const row of rows) {
    if (!isLikelyMaterial(row)) continue;
    out.push({
      materialName: row.description,
      quantity: row.quantity > 0 ? row.quantity : 1,
      unit: row.unit || "item",
      estimatedCost: row.amount > 0 ? row.amount : row.rate,
      supplier: null,
    });
  }
  return out.slice(0, MAX_MATERIALS);
}

function normalize(items: unknown): ParsedMaterial[] {
  if (!Array.isArray(items)) return [];
  const out: ParsedMaterial[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const materialName = str(obj["materialName"]);
    if (!materialName) continue;
    const quantity = num(obj["quantity"]);
    out.push({
      materialName,
      quantity: quantity > 0 ? quantity : 1,
      unit: str(obj["unit"]) || "item",
      estimatedCost: num(obj["estimatedCost"]),
      supplier: str(obj["supplier"]) || null,
    });
  }
  return out;
}

function chunkRows(rows: BoqRow[]): BoqRow[][] {
  const chunks: BoqRow[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_CHUNK) {
    chunks.push(rows.slice(i, i + ROWS_PER_CHUNK));
    if (chunks.length >= MAX_CHUNKS) break;
  }
  return chunks;
}

function chunkToText(chunk: BoqRow[]): string {
  return chunk
    .map(
      (r) =>
        `${r.code || "-"} | ${r.description} | qty=${r.quantity || ""} | unit=${r.unit || ""} | rate=${r.rate || ""} | amount=${r.amount || ""}`,
    )
    .join("\n");
}

function dedupe(materials: ParsedMaterial[]): ParsedMaterial[] {
  const seen = new Map<string, ParsedMaterial>();
  for (const m of materials) {
    const key = `${m.materialName.toLowerCase()}|${m.unit.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...m });
    } else {
      existing.quantity += m.quantity;
      existing.estimatedCost += m.estimatedCost;
      if (!existing.supplier && m.supplier) existing.supplier = m.supplier;
    }
  }
  return [...seen.values()].slice(0, MAX_MATERIALS);
}

const AI_CONCURRENCY = 5;

async function extractChunk(chunk: BoqRow[]): Promise<ParsedMaterial[]> {
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Extract materials from these BoQ rows:\n\n${chunkToText(chunk)}` },
  ];
  try {
    const parsed = (await chatJson(messages)) as { materials?: unknown } | null;
    return parsed ? normalize(parsed.materials) : deterministicExtract(chunk);
  } catch {
    return deterministicExtract(chunk);
  }
}

async function aiExtract(rows: BoqRow[]): Promise<ParsedMaterial[]> {
  const chunks = chunkRows(rows);
  const all: ParsedMaterial[] = [];
  for (let i = 0; i < chunks.length; i += AI_CONCURRENCY) {
    const batch = chunks.slice(i, i + AI_CONCURRENCY);
    const results = await Promise.all(batch.map(extractChunk));
    for (const r of results) all.push(...r);
  }
  return all;
}

export async function extractMaterialsFromBoq(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<BoqExtractionResult> {
  const lower = fileName.toLowerCase();
  const isPdf = mimeType.includes("pdf") || lower.endsWith(".pdf");
  const rows = isPdf ? await parsePdfRows(buffer) : parseWorkbook(buffer);

  if (rows.length === 0) return { materials: [], usedAi: false };

  if (isLlmConfigured()) {
    const aiMaterials = await aiExtract(rows);
    if (aiMaterials.length > 0) {
      return { materials: dedupe(aiMaterials), usedAi: true };
    }
  }

  return { materials: dedupe(deterministicExtract(rows)), usedAi: false };
}
