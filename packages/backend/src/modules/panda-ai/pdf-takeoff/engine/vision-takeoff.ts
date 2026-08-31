import { z } from "zod";
import { chatVision, isLlmConfigured } from "../../../../lib/llm.ts";
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
  items: z.array(VisionItem).max(80),
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
- Max 80 items. description one line, <=240 chars.`;

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
  if (!isLlmConfigured() || budget.remainingSheets <= 0) return null;

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

  const raw = await chatVision(`${PROMPT}\n\nDrawing: ${input.sheetLabel}`, [pngToDataUrl(png)], {
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

  return parsed.items.map((it) => ({
    elementGroup: it.elementGroup,
    workSection: { code: it.workSectionCode, title: it.workSectionTitle },
    specNote: null,
    code: null,
    description: it.description,
    unit: it.unit,
    qtyGross: it.qty,
    deductions: [],
    qty: it.qty,
    confidence: "low",
    measurementBasis: `Vision estimate (scanned drawing): ${it.basis}`,
    geometries: [],
    pageNumber: input.globalPage,
    provisional: true,
  }));
}
