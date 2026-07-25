import { z } from "zod";
import type { LlmMessage } from "../../../../lib/llm.ts";
import type { MeasuredBoqItem, TextRun } from "../types.ts";

// Schedule reader: architects put the authoritative door/window counts, sizes
// and specs in schedule tables on the drawings. The LLM's job here is pure
// TRANSCRIPTION of sheet text the engine hands it — every accepted entry is
// cross-checked against the deterministic tag census, and disagreements are
// surfaced, never silently resolved.

export interface DiagramSize {
  width: number;
  height: number;
}

const scheduleEntrySchema = z.object({
  type: z.string().min(2).max(8),
  quantity: z.number().int().positive().max(2000).nullable(),
  widthMm: z.number().int().positive().max(10000).nullable(),
  heightMm: z.number().int().positive().max(10000).nullable(),
  material: z.string().max(120).nullable(),
  remarks: z.string().max(160).nullable(),
});

const scheduleSchema = z.object({
  windows: z.array(scheduleEntrySchema).max(40),
  doors: z.array(scheduleEntrySchema).max(40),
  vents: z.array(scheduleEntrySchema).max(40).default([]),
});

export type DrawingSchedules = z.infer<typeof scheduleSchema>;
export type ScheduleEntry = z.infer<typeof scheduleSchema>["windows"][number];

export type ScheduleLlmCall = <T>(messages: LlmMessage[], schema: z.ZodType<T>) => Promise<{ data: T } | null>;

// Rebuild reading order from text positions: rows top-to-bottom (PDF y is
// bottom-up), cells left-to-right, so table rows survive extraction order.
export function readingOrderLines(texts: TextRun[], rowTolerancePt = 4): string[] {
  // bucket into rows by y first (jittery baselines land in one bucket), then
  // sort each row's cells by x — sorting y-then-x alone scrambles cells whose
  // y differs within the tolerance
  const sorted = [...texts].sort((a, b) => b.y - a.y);
  const rows: { y: number; cells: TextRun[] }[] = [];
  for (const t of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(t.y - row.y) <= rowTolerancePt) row.cells.push(t);
    else rows.push({ y: t.y, cells: [t] });
  }
  return rows.map((row) => [...row.cells].sort((a, b) => a.x - b.x).map((c) => c.str).join(" | "));
}

export function looksLikeScheduleSheet(texts: TextRun[]): boolean {
  const joined = texts.map((t) => t.str).join(" ");
  return /window schedule|door schedule/i.test(joined);
}

function normalizeType(raw: string): string | null {
  const match = raw.toUpperCase().replace(/[\s-]/g, "").match(/^([WDV])(\d{1,2})$/);
  return match ? `${match[1]}${match[2]}` : null;
}

export async function readSchedules(
  scheduleSheets: { pageNumber: number; lines: string[] }[],
  callLlm: ScheduleLlmCall,
): Promise<DrawingSchedules | null> {
  if (scheduleSheets.length === 0) return null;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You transcribe door, window and ventilation (vent/louvre) schedule tables from architectural drawing text.",
        "The text below is reconstructed line-by-line from the sheet; ' | ' separates cells on a row. Table columns may include: name/type, quantity, size (width x height mm), frame material, finish, glazing, remarks.",
        "HARD RULES:",
        "1. TRANSCRIBE ONLY. Output values that appear in the text. If a cell is absent or ambiguous for an entry, use null — never estimate.",
        "2. Types look like W-1/W4/D-10/V-1/V2; keep every distinct type you can see. Vent/louvre/ventilation-block rows go in vents.",
        "3. Sizes: only when an explicit width x height appears near the type; convert cm/m to mm only when the unit is written.",
        'Respond with JSON only: {"windows":[{"type","quantity","widthMm","heightMm","material","remarks"}],"doors":[...],"vents":[...]} — nulls where unknown.',
      ].join("\n"),
    },
    {
      role: "user",
      content: scheduleSheets
        .map((s) => `SHEET page ${s.pageNumber}:\n${s.lines.join("\n")}`)
        .join("\n\n")
        .slice(0, 24000),
    },
  ];
  const result = await callLlm(messages, scheduleSchema);
  if (!result) return null;
  // normalize + dedupe types; entries whose type doesn't parse are dropped
  const clean = (entries: ScheduleEntry[]): ScheduleEntry[] => {
    const seen = new Map<string, ScheduleEntry>();
    for (const entry of entries) {
      const type = normalizeType(entry.type);
      if (!type || seen.has(type)) continue;
      seen.set(type, { ...entry, type });
    }
    return [...seen.values()];
  };
  return {
    windows: clean(result.data.windows),
    doors: clean(result.data.doors),
    vents: clean(result.data.vents ?? []),
  };
}

// Schedules frequently write sizes in cm without saying so. No opening on a
// building is 138mm wide: when >=80% of sized entries have both dimensions
// under 400, the whole schedule is read as cm (x10). One multiplier for the
// entire schedule — never per row — and the inference is recorded in the
// measurement basis for the reviewer.
export function inferScheduleScale(entries: ScheduleEntry[]): number {
  const sized = entries.filter((e) => e.widthMm !== null && e.heightMm !== null);
  if (sized.length === 0) return 1;
  const small = sized.filter((e) => Math.max(e.widthMm!, e.heightMm!) < 400);
  return small.length / sized.length >= 0.8 ? 10 : 1;
}

// Merge schedule truth into the measured opening items. Schedule quantity wins
// (the architect's count); the tag census stays in the basis as cross-check,
// and disagreement forces needs_review via low confidence.
export function applySchedules(items: MeasuredBoqItem[], schedules: DrawingSchedules): MeasuredBoqItem[] {
  const byType = new Map<string, ScheduleEntry>();
  const allEntries = [...schedules.windows, ...schedules.doors];
  for (const entry of allEntries) byType.set(entry.type, entry);
  const scale = inferScheduleScale(allEntries);

  return items.map((item) => {
    if (item.code !== "L11" && item.code !== "L20") return item;
    const match = item.description.match(/type ([WD]\d{1,2})/i);
    const entry = match ? byType.get(match[1]!.toUpperCase()) : undefined;
    if (!entry) return item;

    const hasSize = Boolean(entry.widthMm && entry.heightMm);
    const size = hasSize
      ? scale === 10
        ? `to fit opening size ${entry.widthMm! * 10} x ${entry.heightMm! * 10}mm high; `
        : `to fit opening size ${entry.widthMm} x ${entry.heightMm} as schedule; `
      : "";
    const unitNote = hasSize && scale === 10 ? "; schedule sizes read as cm (x10 to mm)" : "";
    const material = entry.material ? `${entry.material}; ` : "";
    const kind = item.code === "L11" ? "Window" : "Door";
    const description = `${kind} type ${entry.type}; ${size}${material}as ${kind.toLowerCase()} schedule`;

    if (entry.quantity === null) {
      return {
        ...item,
        description,
        measurementBasis: `${item.measurementBasis}; schedule row found (no qty column)${unitNote}`,
      };
    }
    const agrees = entry.quantity === item.qty;
    return {
      ...item,
      description,
      qtyGross: entry.quantity,
      qty: entry.quantity,
      confidence: agrees ? ("high" as const) : ("low" as const),
      measurementBasis: agrees
        ? `${entry.quantity} per ${kind.toLowerCase()} schedule; tag census agrees (${item.qty})${unitNote}`
        : `${entry.quantity} per ${kind.toLowerCase()} schedule; tag census found ${item.qty} — DISCREPANCY, verify against drawings${unitNote}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Schedule DIAGRAM measurement: each window/door type is drawn as a small
// elevation with vector dimension annotations. Measuring those is
// deterministic — it needs no transcription trust. The type label sits by its
// diagram, so dimensions are taken from a local window around each tag:
// width = largest horizontal dimension figure, height = largest rotated one
// (panel sub-dimensions like 69+69 under an overall 138 lose to the max).
// ---------------------------------------------------------------------------

const DIAGRAM_WINDOW_X = 160;
const DIAGRAM_WINDOW_ABOVE = 320;
const DIAGRAM_WINDOW_BELOW = 60;

export function measureDiagramSizes(texts: TextRun[]): Map<string, DiagramSize> {
  const sizes = new Map<string, DiagramSize>();
  const tags = texts.filter((t) => /^[WDV][\s-]?\d{1,2}$/i.test(t.str.trim()));
  const numeric = texts
    .map((t) => ({ ...t, value: Number(t.str.trim()) }))
    .filter((t) => /^\d{2,4}$/.test(t.str.trim()) && t.value >= 20 && t.value <= 4000);

  for (const tag of tags) {
    const type = tag.str.toUpperCase().replace(/[\s-]/g, "");
    const local = numeric.filter(
      (t) =>
        Math.abs(t.x - tag.x) <= DIAGRAM_WINDOW_X &&
        t.y >= tag.y - DIAGRAM_WINDOW_BELOW &&
        t.y <= tag.y + DIAGRAM_WINDOW_ABOVE,
    );
    const widths = local.filter((t) => !t.rotated).map((t) => t.value);
    const heights = local.filter((t) => t.rotated).map((t) => t.value);
    if (widths.length === 0 || heights.length === 0) continue;
    const size = { width: Math.max(...widths), height: Math.max(...heights) };
    const existing = sizes.get(type);
    // a type can appear in several regions (table row + elevation); keep the
    // reading with the larger height — elevations carry the full storey dim
    if (!existing || size.height > existing.height) sizes.set(type, size);
  }
  return sizes;
}

// Deterministic diagram sizes override table-transcribed ones.
export function mergeDiagramSizes(schedules: DrawingSchedules, diagram: Map<string, DiagramSize>): DrawingSchedules {
  const apply = (entries: ScheduleEntry[]): ScheduleEntry[] =>
    entries.map((entry) => {
      const measured = diagram.get(entry.type);
      return measured ? { ...entry, widthMm: measured.width, heightMm: measured.height } : entry;
    });
  // types drawn on the sheet but missing from the transcribed table still count
  const known = new Set(
    [...schedules.windows, ...schedules.doors, ...schedules.vents].map((e) => e.type),
  );
  const extras: ScheduleEntry[] = [...diagram.entries()]
    .filter(([type]) => !known.has(type))
    .map(([type, size]) => ({ type, quantity: null, widthMm: size.width, heightMm: size.height, material: null, remarks: null }));
  return {
    windows: [...apply(schedules.windows), ...extras.filter((e) => e.type.startsWith("W"))],
    doors: [...apply(schedules.doors), ...extras.filter((e) => e.type.startsWith("D"))],
    vents: [...apply(schedules.vents), ...extras.filter((e) => e.type.startsWith("V"))],
  };
}

// BESMM4 void-deduction minimums are section-specific (General Rule 1.5.4).
// Values cite the corpus clause that fixes each number, for QS traceability.
const VOID_DEDUCT_MIN = {
  masonry: 0.5, // BESMM4 p183 "voids...cross sectional area equals to or less than 0.50m2"
  formwork: 5.0, // BESMM4 p168
  finishings: 1.0, // BESMM4 p247
  concreteM3: 0.05, // BESMM4 p146 M1
} as const;
// The deduction is capped — if openings exceed 60% of gross something upstream
// is wrong and we flag instead of producing a nonsense net.
export function applyOpeningDeductions(items: MeasuredBoqItem[], schedules: DrawingSchedules): MeasuredBoqItem[] {
  const scale = inferScheduleScale([...schedules.windows, ...schedules.doors, ...schedules.vents]);
  const countByType = new Map<string, number>();
  for (const item of items) {
    const match = item.description.match(/type ([WDV]\d{1,2})/i);
    if (match && (item.code === "L11" || item.code === "L20")) countByType.set(match[1]!.toUpperCase(), item.qty);
  }
  const openingArea = (entries: ScheduleEntry[]): { area: number; counted: number } => {
    let area = 0;
    let counted = 0;
    for (const entry of entries) {
      if (!entry.widthMm || !entry.heightMm) continue;
      const count = entry.quantity ?? countByType.get(entry.type) ?? 0;
      if (count === 0) continue;
      const eachM2 = ((entry.widthMm * scale) / 1000) * ((entry.heightMm * scale) / 1000);
      if (eachM2 <= VOID_DEDUCT_MIN.masonry) continue;
      area += eachM2 * count;
      counted += count;
    }
    return { area: Math.round(area * 100) / 100, counted };
  };
  const windows = openingArea(schedules.windows);
  const doors = openingArea(schedules.doors);
  const vents = openingArea(schedules.vents);
  if (windows.area + doors.area + vents.area === 0) return items;

  return items.map((item) => {
    if (item.code !== "F10/125") return item;
    const gross = item.qtyGross;
    const totalOpenings = Math.round((windows.area + doors.area + vents.area) * 100) / 100;
    if (totalOpenings > gross * 0.6) {
      return {
        ...item,
        confidence: "low" as const,
        measurementBasis: `${item.measurementBasis}; openings (${totalOpenings} m2) exceed 60% of gross wall — deduction NOT applied, verify storey coverage`,
      };
    }
    const deductions = [
      ...(windows.area > 0 ? [{ label: `Window openings (${windows.counted} nr per schedule)`, qty: windows.area }] : []),
      ...(doors.area > 0 ? [{ label: `Door openings (${doors.counted} nr per schedule)`, qty: doors.area }] : []),
      ...(vents.area > 0 ? [{ label: `Ventilation openings (${vents.counted} nr per schedule)`, qty: vents.area }] : []),
    ];
    const net = Math.round((gross - totalOpenings) * 100) / 100;
    return {
      ...item,
      deductions,
      qty: net,
      measurementBasis: `${item.measurementBasis}; less ${totalOpenings} m2 openings from schedule sizes x counts = ${net} m2 net`,
    };
  });
}
