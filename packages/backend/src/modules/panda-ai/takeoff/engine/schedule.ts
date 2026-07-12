import { z } from "zod";
import type { LlmMessage } from "../../../../lib/llm.ts";
import type { MeasuredBoqItem, TextRun } from "../types.ts";

// Schedule reader: architects put the authoritative door/window counts, sizes
// and specs in schedule tables on the drawings. The LLM's job here is pure
// TRANSCRIPTION of sheet text the engine hands it — every accepted entry is
// cross-checked against the deterministic tag census, and disagreements are
// surfaced, never silently resolved.

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
  const match = raw.toUpperCase().replace(/[\s-]/g, "").match(/^([WD])(\d{1,2})$/);
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
        "You transcribe door and window schedule tables from architectural drawing text.",
        "The text below is reconstructed line-by-line from the sheet; ' | ' separates cells on a row. Table columns may include: name/type, quantity, size (width x height mm), frame material, finish, glazing, remarks.",
        "HARD RULES:",
        "1. TRANSCRIBE ONLY. Output values that appear in the text. If a cell is absent or ambiguous for an entry, use null — never estimate.",
        "2. Types look like W-1/W4/D-10; keep every distinct type you can see.",
        "3. Sizes: only when an explicit width x height appears near the type; convert cm/m to mm only when the unit is written.",
        'Respond with JSON only: {"windows":[{"type","quantity","widthMm","heightMm","material","remarks"}],"doors":[...]} — nulls where unknown.',
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
  return { windows: clean(result.data.windows), doors: clean(result.data.doors) };
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
