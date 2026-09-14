import { parseLevelMark } from "../../geometry/length-text.ts";
import type { Segment, TextRun } from "../types.ts";
import { closedRects } from "./shapes.ts";

// What the rest of the document tells a floor plan about the third dimension:
// storey height from the level marks on plans, elevations and sections, and
// window height from the window outlines on elevations. A plan on its own
// only knows lengths; without these every wall area rests on an assumption,
// and the item says so.

export const DEFAULT_STOREY_HEIGHT_M = 2.7;
export const DEFAULT_DOOR_HEIGHT_M = 2.1;
export const DEFAULT_WINDOW_HEIGHT_M = 1.2;

export interface DocumentContext {
  storeyHeightM: number;
  storeyHeightBasis: "level-marks" | "assumed";
  levelMarksMm: number[];
  windowHeightM: number;
  windowHeightBasis: "elevation" | "assumed";
  doorHeightM: number;
  doorHeightBasis: "assumed";
}

export interface ContextPage {
  texts: TextRun[];
  segments: Segment[];
  mmPerPt: number | null;
}

export const ASSUMED_CONTEXT: DocumentContext = {
  storeyHeightM: DEFAULT_STOREY_HEIGHT_M,
  storeyHeightBasis: "assumed",
  levelMarksMm: [],
  windowHeightM: DEFAULT_WINDOW_HEIGHT_M,
  windowHeightBasis: "assumed",
  doorHeightM: DEFAULT_DOOR_HEIGHT_M,
  doorHeightBasis: "assumed",
};

// "+450", "+3450 FIRST FLOOR SLAB", "FFL +3.450", "-1200", "+11'-3 7/8"": a
// signed number, in mm, in metres with three decimals, or in feet and inches.
const STOREY_MIN_MM = 2400;
const STOREY_MAX_MM = 4500;

export function levelMarks(texts: TextRun[]): number[] {
  const out = new Set<number>();
  for (const t of texts) {
    const m = parseLevelMark(t.str);
    if (m && Math.abs(m.mm) >= 100) out.add(m.mm);
  }
  return [...out].sort((a, b) => a - b);
}

function mode(values: number[], roundTo: number): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v / roundTo) * roundTo;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: [number, number] | null = null;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best ? best[0] : null;
}

// Storey height is the typical step between consecutive level marks.
export function storeyHeightFromLevels(levelsMm: number[]): number | null {
  const diffs: number[] = [];
  for (let i = 1; i < levelsMm.length; i++) {
    const d = levelsMm[i]! - levelsMm[i - 1]!;
    if (d >= STOREY_MIN_MM && d <= STOREY_MAX_MM) diffs.push(d);
  }
  const m = mode(diffs, 50);
  return m === null ? null : m / 1000;
}

const WINDOW_W_MM: [number, number] = [500, 3000];
const WINDOW_H_MM: [number, number] = [500, 2500];

// Window outlines on an elevation are upright rectangles of window size; the
// modal height is what the plan's window deductions use.
export function windowHeightFromElevations(pages: ContextPage[], fallbackMmPerPt: number | null, storeyHeightM: number | null): number | null {
  const heights: number[] = [];
  for (const page of pages) {
    const mmPerPt = page.mmPerPt ?? fallbackMmPerPt;
    if (!mmPerPt) continue;
    for (const r of closedRects(page.segments, mmPerPt)) {
      if (r.wMm < WINDOW_W_MM[0] || r.wMm > WINDOW_W_MM[1] || r.hMm < WINDOW_H_MM[0] || r.hMm > WINDOW_H_MM[1]) continue;
      if (storeyHeightM !== null && r.hMm >= storeyHeightM * 1000) continue;
      heights.push(r.hMm);
    }
  }
  if (heights.length < 2) return null;
  const m = mode(heights, 50);
  return m === null ? null : m / 1000;
}

export function buildDocumentContext(pages: ContextPage[]): DocumentContext {
  const levels = levelMarks(pages.flatMap((p) => p.texts));
  const storey = storeyHeightFromLevels(levels);
  const calibrated = pages.map((p) => p.mmPerPt).filter((v): v is number => v !== null);
  const fallback = mode(calibrated, 0.001);
  const windowHeight = windowHeightFromElevations(pages, fallback, storey);
  return {
    storeyHeightM: storey ?? DEFAULT_STOREY_HEIGHT_M,
    storeyHeightBasis: storey === null ? "assumed" : "level-marks",
    levelMarksMm: levels,
    windowHeightM: windowHeight ?? DEFAULT_WINDOW_HEIGHT_M,
    windowHeightBasis: windowHeight === null ? "assumed" : "elevation",
    doorHeightM: DEFAULT_DOOR_HEIGHT_M,
    doorHeightBasis: "assumed",
  };
}
