import * as XLSX from "xlsx";
import { z } from "zod";
import { extractDocumentText } from "../../lib/document-text.ts";
import { pandaAiJson } from "./engine.ts";

const extractionSchema = z.looseObject({});

export interface ExtractedMetadata {
  projectName: string | null;
  location: string | null;
  client: string | null;
  contractor: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

export interface ExtractedPhase {
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ExtractedBudgetCategory {
  name: string;
  total: number;
}

export interface ExtractedMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  section: string | null;
}

export type SheetDomain = "metadata" | "timeline" | "budget" | "materials" | "unknown";

export interface SheetSummary {
  name: string;
  domain: SheetDomain;
  rowCount: number;
}

export interface ProjectExtraction {
  metadata: ExtractedMetadata;
  phases: ExtractedPhase[];
  budgetCategories: ExtractedBudgetCategory[];
  materials: ExtractedMaterial[];
  sheets: SheetSummary[];
}

type Cell = string;
type Grid = Cell[][];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").trim();
}

function sheetToGrid(ws: XLSX.WorkSheet): Grid {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  return raw.map((row) => row.map(cell));
}

function condense(row: Cell[]): string {
  return row
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[₦$,\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function looksLikeDate(value: string): string | null {
  const m = value.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const d = m[1] ?? "";
  const mo = m[2] ?? "";
  const y = m[3] ?? "";
  const year = y.length === 2 ? `20${y}` : y;
  const day = d.padStart(2, "0");
  const month = mo.padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

const META_PATTERNS: Array<{ key: keyof ExtractedMetadata; label: RegExp }> = [
  { key: "projectName", label: /project\s*name\s*[:|-]\s*/i },
  { key: "location", label: /location\s*[:|-]\s*/i },
  { key: "client", label: /client\s*[:|-]\s*/i },
  { key: "contractor", label: /(?:main\s*)?contractor\s*[:|-]\s*/i },
  { key: "startDate", label: /start\s*date\s*[:|-]\s*/i },
  { key: "endDate", label: /(?:planned\s*)?completion\s*date\s*[:|-]\s*/i },
];

function extractMetadataLine(line: string, into: ExtractedMetadata): void {
  const segments = line.split("|");
  for (const segment of segments) {
    for (const { key, label } of META_PATTERNS) {
      if (label.test(segment)) {
        const value = segment.replace(label, "").trim();
        if (!value) continue;
        if (key === "startDate" || key === "endDate") {
          into[key] = looksLikeDate(value) ?? into[key];
        } else if (!into[key]) {
          into[key] = value;
        }
      }
    }
  }
}

function classifySheet(name: string, grid: Grid): SheetDomain {
  const lowerName = name.toLowerCase();
  const headerText = grid.slice(0, 8).map(condense).join(" ");

  const hasQty = /\bqty\b|\bquantity\b/.test(headerText);
  const hasRate = /\brate\b/.test(headerText);
  const hasCost = /\bcost\b|\bamount\b/.test(headerText);
  const hasDescription = /\bdescription\b|\bitems?\b/.test(headerText);
  const hasActivities = /\bactivit|phase\s*\/\s*activit|planned\s*start|planned\s*finish/.test(
    headerText,
  );

  if (/dashboard/.test(lowerName)) return "unknown";
  if (hasActivities || /execution plan|tracker/.test(lowerName)) return "timeline";
  if (hasQty && hasRate) return "materials";
  if (hasDescription && hasCost) return "budget";
  if (/overview/.test(lowerName)) return "metadata";
  return "unknown";
}

function findHeaderRow(grid: Grid, signals: string[]): number {
  for (let i = 0; i < Math.min(grid.length, 12); i += 1) {
    const text = condense(grid[i] ?? []);
    if (signals.every((s) => text.includes(s))) return i;
  }
  return -1;
}

function isSectionHeading(row: Cell[]): boolean {
  const nonEmpty = row.filter(Boolean);
  if (nonEmpty.length !== 1) return false;
  const text = nonEmpty[0]!;
  return text.length > 2 && text === text.toUpperCase() && /[A-Z]/.test(text);
}

function extractBudget(grid: Grid): ExtractedBudgetCategory[] {
  const headerRow = findHeaderRow(grid, ["description", "cost"]);
  if (headerRow < 0) return [];
  const header = (grid[headerRow] ?? []).map((c) => c.toLowerCase());
  const descIdx = header.findIndex((c) => c.includes("description") || c.includes("item"));
  const costIdx = header.findIndex((c) => c.includes("cost") || c.includes("amount"));
  if (descIdx < 0 || costIdx < 0) return [];

  const out: ExtractedBudgetCategory[] = [];
  for (let i = headerRow + 1; i < grid.length; i += 1) {
    const row = grid[i] ?? [];
    const name = (row[descIdx] ?? "").trim();
    if (!name) continue;
    if (/^project\s*sum|^total|^subtotal|^grand\s*total/i.test(name)) continue;
    const total = parseNumber(row[costIdx] ?? "");
    if (total <= 0) continue;
    out.push({ name: name.slice(0, 160), total });
  }
  return out;
}

function extractMaterials(grid: Grid): ExtractedMaterial[] {
  const headerRow = findHeaderRow(grid, ["qty", "rate"]);
  if (headerRow < 0) return [];
  const header = (grid[headerRow] ?? []).map((c) => c.toLowerCase());
  const itemsIdx = header.findIndex((c) => c.includes("item"));
  const descIdx = header.findIndex((c) => c.includes("description"));
  const qtyIdx = header.findIndex((c) => c.includes("qty") || c.includes("quantity"));
  const rateIdx = header.findIndex((c) => c.includes("rate"));
  const costIdx = header.findIndex((c) => c === "cost" || c.includes("cost") || c.includes("amount"));
  const nameIdx = descIdx >= 0 ? descIdx : itemsIdx;
  if (nameIdx < 0 || qtyIdx < 0) return [];

  const out: ExtractedMaterial[] = [];
  let section: string | null = null;
  for (let i = headerRow + 1; i < grid.length; i += 1) {
    const row = grid[i] ?? [];
    const category = itemsIdx >= 0 ? (row[itemsIdx] ?? "").trim() : "";
    if (category && category === category.toUpperCase() && /[A-Z]/.test(category)) {
      section = category.slice(0, 160);
    }
    const name = (row[nameIdx] ?? "").trim();
    if (!name) continue;
    if (/^project\s*sum|^total|^subtotal/i.test(name)) continue;
    const qtyRaw = (row[qtyIdx] ?? "").trim();
    const quantity = /sum/i.test(qtyRaw) ? 1 : parseNumber(qtyRaw);
    const rate = rateIdx >= 0 ? parseNumber(row[rateIdx] ?? "") : 0;
    const cost = costIdx >= 0 ? parseNumber(row[costIdx] ?? "") : 0;
    const estimatedCost = cost > 0 ? cost : rate;
    if (estimatedCost <= 0 && quantity <= 0) continue;
    out.push({
      materialName: name.slice(0, 200),
      quantity: quantity > 0 ? quantity : 1,
      unit: "item",
      estimatedCost,
      section,
    });
  }
  return out;
}

function extractTimeline(grid: Grid): ExtractedPhase[] {
  const headerRow = findHeaderRow(grid, ["planned start"]);
  let startIdx = -1;
  let finishIdx = -1;
  if (headerRow >= 0) {
    const header = (grid[headerRow] ?? []).map((c) => c.toLowerCase());
    startIdx = header.findIndex((c) => c.includes("planned start") || c.includes("start"));
    finishIdx = header.findIndex((c) => c.includes("planned finish") || c.includes("finish") || c.includes("end"));
  }

  const phases: Array<ExtractedPhase & { starts: string[]; ends: string[] }> = [];
  const bodyStart = headerRow >= 0 ? headerRow + 1 : 0;
  for (let i = bodyStart; i < grid.length; i += 1) {
    const row = grid[i] ?? [];
    if (isSectionHeading(row)) {
      const name = row.find(Boolean)!;
      if (/^project\s*(execution|name|phase)/i.test(name)) continue;
      if (/progress|programme|revision|overall/i.test(name)) continue;
      phases.push({ name: name.slice(0, 160), startDate: null, endDate: null, starts: [], ends: [] });
      continue;
    }
    if (phases.length === 0) continue;
    const phase = phases[phases.length - 1]!;
    const startVal = startIdx >= 0 ? looksLikeDate(row[startIdx] ?? "") : null;
    const finishVal = finishIdx >= 0 ? looksLikeDate(row[finishIdx] ?? "") : null;
    if (startVal) phase.starts.push(startVal);
    if (finishVal) phase.ends.push(finishVal);
  }

  return phases.map((phase) => ({
    name: phase.name,
    startDate: phase.starts.length > 0 ? phase.starts.slice().sort()[0]! : null,
    endDate: phase.ends.length > 0 ? phase.ends.slice().sort().at(-1)! : null,
  }));
}

function dedupeMaterials(materials: ExtractedMaterial[]): ExtractedMaterial[] {
  const seen = new Map<string, ExtractedMaterial>();
  for (const material of materials) {
    const key = `${(material.section ?? "").toLowerCase()}|${material.materialName.toLowerCase()}|${material.quantity}`;
    if (!seen.has(key)) seen.set(key, material);
  }
  return [...seen.values()];
}

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_SHEETS = 30;
const MAX_ROWS_PER_SHEET = 5000;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function extractProjectFromWorkbook(buffer: Buffer): Promise<ProjectExtraction> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large to process (${Math.round(buffer.length / 1024 / 1024)}MB, limit ${MAX_FILE_BYTES / 1024 / 1024}MB).`,
    );
  }
  const wb = XLSX.read(buffer, { type: "buffer" });
  const metadata: ExtractedMetadata = {
    projectName: null,
    location: null,
    client: null,
    contractor: null,
    startDate: null,
    endDate: null,
    description: null,
  };
  const phases: ExtractedPhase[] = [];
  let budgetCategories: ExtractedBudgetCategory[] = [];
  const materials: ExtractedMaterial[] = [];
  const sheets: SheetSummary[] = [];

  for (const name of wb.SheetNames.slice(0, MAX_SHEETS)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    await yieldToEventLoop();
    const grid = sheetToGrid(ws).slice(0, MAX_ROWS_PER_SHEET);

    for (const row of grid.slice(0, 6)) {
      const joined = row.join(" | ");
      if (/project\s*name\s*[:|-]/i.test(joined)) {
        extractMetadataLine(joined, metadata);
      }
      const descCell = row.find((c) => /project\s*description/i.test(c));
      if (descCell && !metadata.description) {
        metadata.description = descCell.replace(/project\s*description/i, "").trim().slice(0, 2000);
      }
    }

    const domain = classifySheet(name, grid);
    sheets.push({ name, domain, rowCount: grid.length });

    if (domain === "timeline") {
      for (const phase of extractTimeline(grid)) phases.push(phase);
    } else if (domain === "budget" && budgetCategories.length === 0) {
      budgetCategories = extractBudget(grid);
    } else if (domain === "materials") {
      for (const material of extractMaterials(grid)) materials.push(material);
    }
  }

  if (budgetCategories.length === 0 && materials.length > 0) {
    const grouped = new Map<string, number>();
    for (const material of materials) {
      const key = material.section ?? "General";
      grouped.set(key, (grouped.get(key) ?? 0) + material.estimatedCost * material.quantity);
    }
    budgetCategories = [...grouped].map(([name, total]) => ({ name, total }));
  }

  return {
    metadata,
    phases,
    budgetCategories,
    materials: dedupeMaterials(materials),
    sheets,
  };
}

const LLM_SYSTEM_PROMPT = `You are a construction project analyst. You receive the raw text of a single project document (e.g. a contract, scope of works, project brief, handover summary, or schedule). Extract structured project data ONLY from what is explicitly present in the text. Never invent values. If a field is not stated, use null (for strings/dates) or omit the item. Dates must be ISO YYYY-MM-DD. Costs must be plain numbers (no currency symbols or commas). Respond ONLY with JSON of this exact shape:
{
  "metadata": { "projectName": string|null, "location": string|null, "client": string|null, "contractor": string|null, "startDate": string|null, "endDate": string|null, "description": string|null },
  "phases": [ { "name": string, "startDate": string|null, "endDate": string|null } ],
  "budgetCategories": [ { "name": string, "total": number } ],
  "materials": [ { "materialName": string, "quantity": number, "unit": string, "estimatedCost": number, "section": string|null } ]
}`;

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s*[—–]\s*/g, ", ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return looksLikeDate(value);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeLlmExtraction(value: unknown): ProjectExtraction {
  const obj = (value ?? {}) as Record<string, unknown>;
  const m = (obj.metadata ?? {}) as Record<string, unknown>;
  const metadata: ExtractedMetadata = {
    projectName: str(m.projectName, 160),
    location: str(m.location, 300),
    client: str(m.client, 160),
    contractor: str(m.contractor, 160),
    startDate: isoDate(m.startDate),
    endDate: isoDate(m.endDate),
    description: str(m.description, 2000),
  };

  const phases: ExtractedPhase[] = Array.isArray(obj.phases)
    ? obj.phases
        .map((p) => {
          const row = (p ?? {}) as Record<string, unknown>;
          const name = str(row.name, 160);
          return name ? { name, startDate: isoDate(row.startDate), endDate: isoDate(row.endDate) } : null;
        })
        .filter((p): p is ExtractedPhase => p !== null)
        .slice(0, 30)
    : [];

  const budgetCategories: ExtractedBudgetCategory[] = Array.isArray(obj.budgetCategories)
    ? obj.budgetCategories
        .map((c) => {
          const row = (c ?? {}) as Record<string, unknown>;
          const name = str(row.name, 160);
          const total = num(row.total);
          return name && total > 0 ? { name, total } : null;
        })
        .filter((c): c is ExtractedBudgetCategory => c !== null)
        .slice(0, 100)
    : [];

  const materials: ExtractedMaterial[] = Array.isArray(obj.materials)
    ? obj.materials
        .map((mat) => {
          const row = (mat ?? {}) as Record<string, unknown>;
          const name = str(row.materialName, 200);
          if (!name) return null;
          const quantity = num(row.quantity);
          return {
            materialName: name,
            quantity: quantity > 0 ? quantity : 1,
            unit: str(row.unit, 40) ?? "item",
            estimatedCost: num(row.estimatedCost),
            section: str(row.section, 160),
          };
        })
        .filter((mat): mat is ExtractedMaterial => mat !== null)
        .slice(0, 500)
    : [];

  return { metadata, phases, budgetCategories, materials: dedupeMaterials(materials), sheets: [] };
}

export async function extractProjectFromText(
  text: string,
  fileName: string,
): Promise<ProjectExtraction> {
  const trimmed = text.slice(0, 24000);
  const parsed = await pandaAiJson(LLM_SYSTEM_PROMPT, `Document: ${fileName}\n\n${trimmed}`, extractionSchema);
  return normalizeLlmExtraction(parsed);
}

function detectFileKind(fileName: string): "workbook" | "text" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return "workbook";
  }
  return "text";
}

export async function extractProjectFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<ProjectExtraction> {
  if (detectFileKind(fileName) === "workbook") {
    return extractProjectFromWorkbook(buffer);
  }
  const extracted = await extractDocumentText(buffer, fileName);
  if (!extracted.text) {
    throw new Error("No readable text found in this document.");
  }
  return extractProjectFromText(extracted.text, fileName);
}
