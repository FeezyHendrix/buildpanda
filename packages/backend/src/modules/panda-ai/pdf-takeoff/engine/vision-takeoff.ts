import { z } from "zod";
import { chatVision, isVisionConfigured } from "../../../../lib/llm-vision.ts";
import { openStoredFile, streamToBuffer } from "../../../../lib/file-storage.ts";
import { renderPdfPagesToPng, pngToDataUrl } from "../../../../lib/document-render.ts";
import type { MeasuredBoqItem } from "../types.ts";

export const VISION_MAX_SHEETS_PER_SESSION = 6;
const VISION_DPI = 150;

export interface VisionBudget {
  remainingSheets: number;
}

export interface VisionTakeoffInput {
  storagePath: string;
  pageNumber: number;
  globalPage: number;
  sheetLabel: string;
  focus?: "roof";
}

const UNITS = ["m", "m2", "m3", "nr", "kg", "sum"] as const;
const GROUPS = [
  "substructure",
  "superstructure",
  "walls",
  "openings",
  "finishes",
  "roof",
  "external-works",
  "other",
] as const;

const VisionItem = z.object({
  elementGroup: z.enum(GROUPS),
  workSectionCode: z.string().max(8),
  workSectionTitle: z.string().max(80),
  description: z.string().max(240),
  qty: z.number().nonnegative().finite(),
  unit: z.enum(UNITS),
  basis: z.string().max(120),
});

const VisionResponse = z.object({
  scaleReadable: z.boolean(),
  roofType: z.enum(["flat", "gable", "hipped", "mansard", "shed", "mixed", "unknown"]).nullable().optional(),
  pitchDeg: z.number().nonnegative().max(89).nullable().optional(),
  items: z.array(VisionItem).max(200),
  notes: z.string().max(400).optional(),
});

const PROMPT = `You are a quantity surveyor estimating quantities from a SCANNED architectural drawing that has no usable vector data.
Return ONLY JSON (no prose, no code fences) matching:
{"scaleReadable": boolean,
 "items": [{"elementGroup": "substructure|superstructure|walls|openings|finishes|roof|external-works|other",
   "workSectionCode": string, "workSectionTitle": string, "description": string,
   "qty": number, "unit": "m|m2|m3|nr|kg|sum", "basis": string}],
 "notes": string}
Rules:
- If no scale bar or dimension strings are legible, set scaleReadable=false and items=[].
- Prefer counting (nr) over measuring when only symbols are visible (doors, WCs, columns).
- qty is an ESTIMATE — err on the low side; never invent items you cannot see. Empty items is valid.
- Max 200 items. description one line, <=240 chars.`;

const ROOF_PROMPT = `You are a quantity surveyor reading a roof plan from an architectural drawing.
Return ONLY JSON (no prose, no code fences) matching:
{"scaleReadable": boolean, "roofType": "flat|gable|hipped|mansard|shed|mixed|unknown", "pitchDeg": number,
 "items": [{"elementGroup": "roof", "workSectionCode": string, "workSectionTitle": string, "description": string,
   "qty": number, "unit": "m|m2|nr", "basis": string}], "notes": string}
Rules:
- Identify the roof type from the outline and slope lines, rather than assuming every roof is gabled.
- Read the roof outline, pitch, covering type, eaves, verges, ridges, hips, valleys, gutters, flashings and rooflights.
- Return sloping roof covering in m2, eaves/ridges/hips/valleys in m, and countable rooflights in nr.
- Use the named covering material in the description. If pitch or scale is unreadable, set scaleReadable=false and return no quantities.
- Every item must use elementGroup=roof. Max 200 items.`;

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

export async function measureSheetViaVision(
  input: VisionTakeoffInput,
  budget: VisionBudget,
): Promise<MeasuredBoqItem[] | null> {
  if (!isVisionConfigured() || budget.remainingSheets <= 0) return null;

  let pngs: Buffer[];
  try {
    const buffer = await streamToBuffer(await openStoredFile(input.storagePath));
    pngs = await renderPdfPagesToPng(buffer, { maxPages: input.pageNumber, dpi: VISION_DPI });
  } catch {
    return null;
  }
  const png = pngs[input.pageNumber - 1];
  if (!png) return null;

  budget.remainingSheets -= 1;

  const raw = await chatVision(`${input.focus === "roof" ? ROOF_PROMPT : PROMPT}\n\nDrawing: ${input.sheetLabel}`, [pngToDataUrl(png)], {
    detail: "high",
  });
  if (!raw) return null;

  let parsed: z.infer<typeof VisionResponse>;
  try {
    parsed = VisionResponse.parse(JSON.parse(stripFences(raw)));
  } catch {
    return null;
  }
  if (!parsed.scaleReadable || parsed.items.length === 0) return null;

  const roofContext = input.focus === "roof"
    ? ` Roof type identified as ${parsed.roofType ?? "unknown"}${parsed.pitchDeg == null ? "" : ` at ${parsed.pitchDeg}°`}.`
    : "";
  return parsed.items.map((it) => ({
    elementGroup: input.focus === "roof" ? "Roof" : it.elementGroup,
    workSection: { code: it.workSectionCode, title: it.workSectionTitle },
    specNote: null,
    code: null,
    description: it.description,
    unit: it.unit,
    qtyGross: it.qty,
    deductions: [],
    qty: it.qty,
    confidence: "low",
    measurementBasis: `Vision estimate: ${it.basis}.${roofContext}`,
    geometries: [],
    pageNumber: input.globalPage,
    provisional: true,
  }));
}
