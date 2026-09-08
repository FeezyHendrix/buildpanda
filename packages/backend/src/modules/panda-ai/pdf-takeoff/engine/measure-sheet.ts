import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { openStoredFile } from "../../../../lib/file-storage.ts";
import { generateId } from "../../../../lib/ids.ts";
import type { DimUnit, MeasuredBoqItem, Segment, SheetKind } from "../types.ts";
import type { extractSheet } from "./pdf-extract.ts";
import { clusterRegions } from "./cluster.ts";
import { ASSUMED_CONTEXT, type DocumentContext } from "./document-context.ts";
import { looksLikePlan, measureRegion } from "./region-measure.ts";
import { columnItems, doorItems, roomItems, wallItems, windowItems, type ItemContext } from "./sheet-items.ts";
import { tagSignature, type PlanFingerprint } from "./fingerprint.ts";

// One sheet's worth of measurement, factored out of the full run so a single
// sheet can be re-read after a reviewer fixes its scale or type.

export async function withTempFile<T>(storagePath: string, ext: string, fn: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `${generateId("pcg")}.${ext}`);
  const stream = await openStoredFile(storagePath);
  await pipeline(stream as Readable, createWriteStream(file));
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

const SHEET_TITLE_KINDS: [RegExp, SheetKind][] = [
  [/floor\s*plan|ground\s*floor|first\s*floor|typical\s*floor/i, "floor-plan"],
  [/elevation/i, "elevation"],
  [/section/i, "section"],
  [/schedule/i, "schedule"],
  [/detail/i, "detail"],
];
// "+3450 FIRST FLOOR SLAB" is a level mark, not a title; an elevation is
// full of them and must not read as a floor plan.
const LEVEL_MARK_TEXT = /^[+\-−±]\s?\d/;

export function classifySheet(texts: { str: string }[], hasDoorArcs: boolean, hasRoomLabels: boolean): {
  kind: SheetKind;
  title: string | null;
} {
  const joined = texts.map((t) => t.str).filter((s) => s.length < 80 && !LEVEL_MARK_TEXT.test(s));
  let title: string | null = null;
  let kind: SheetKind = "unknown";
  for (const [pattern, k] of SHEET_TITLE_KINDS) {
    const hit = joined.find((s) => pattern.test(s));
    if (hit) {
      title = hit;
      kind = k;
      break;
    }
  }
  if (kind === "unknown" && (hasDoorArcs || hasRoomLabels)) kind = "floor-plan";
  return { kind, title };
}

export interface SheetMeasurement {
  items: MeasuredBoqItem[];
  fingerprint: PlanFingerprint | null;
}

export function regionShareOfSheet(
  region: { minX: number; minY: number; maxX: number; maxY: number },
  segments: Segment[],
): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2);
    maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  const sheetArea = (maxX - minX) * (maxY - minY);
  if (sheetArea <= 0) return 1;
  return ((region.maxX - region.minX) * (region.maxY - region.minY)) / sheetArea;
}

// What the sheet knows beyond its own geometry: how the scale was found, and
// the heights the rest of the document supplied.
export interface SheetContext {
  // dimension strings that agreed with the scale; 0 when it came from a written "1:100" alone
  calibrationMatches: number;
  dimUnit: DimUnit;
  document: DocumentContext;
}

const CALIBRATION_MIN_CONFIDENCE = 0.7;

// One region = one drawing. Every region that reads as a floor plan is
// measured and its lines are emitted with the region named, so a sheet that
// carries two floors side by side yields both; repeated floors are collapsed
// later by fingerprint, never by dropping regions here.
export function measureSheetRegions(
  extracted: Awaited<ReturnType<typeof extractSheet>>,
  mmPerPt: number,
  calibrationConfidence: number,
  pageNumber: number,
  sheetLabel: string,
  roomsAsItems = false,
  context?: Partial<SheetContext>,
): SheetMeasurement {
  const regions = clusterRegions(extracted, mmPerPt);
  const items: MeasuredBoqItem[] = [];
  if (regions.length === 0) return { items, fingerprint: null };

  const matches = context?.calibrationMatches ?? (calibrationConfidence >= CALIBRATION_MIN_CONFIDENCE ? 1 : 0);
  const scaleTrusted = matches > 0 && calibrationConfidence >= CALIBRATION_MIN_CONFIDENCE;
  const scaleNote =
    matches === 0 ? "scale taken from the written scale alone, not confirmed by dimension strings" : `scale confidence ${calibrationConfidence.toFixed(2)} from ${matches} dimension strings`;
  const document = context?.document ?? ASSUMED_CONTEXT;
  const dimUnit = context?.dimUnit ?? "mm";

  let fingerprint: PlanFingerprint | null = null;
  const plans = regions.map((region) => measureRegion(extracted, region, mmPerPt, dimUnit)).filter(looksLikePlan);
  plans.forEach((m, index) => {
    const label = plans.length > 1 ? `${sheetLabel}, drawing ${index + 1} of ${plans.length}` : sheetLabel;
    const ctx: ItemContext = {
      document,
      scaleTrusted,
      scaleNote,
      // a region that still fills almost the whole sheet was never isolated
      // from title block, notes and dimension lines — unless its walls match
      // the written dimensions, which a plan swallowing the title block cannot
      envelopeUntrustworthy: regionShareOfSheet(m.region, extracted.segments) >= 0.85 && !m.dimensionCheck.ok,
      pageNumber,
      sheetLabel: label,
    };
    items.push(...wallItems(m, ctx), ...doorItems(m, ctx), ...windowItems(m, ctx), ...columnItems(m, ctx), ...roomItems(m, ctx, roomsAsItems));
    if (!fingerprint) {
      const toM = mmPerPt / 1000;
      fingerprint = {
        pageNumber,
        centrelineM: m.walls.centrelineM,
        wallPairs: m.walls.pairs.length,
        widthM: Math.round((m.region.maxX - m.region.minX) * toM * 10) / 10,
        heightM: Math.round((m.region.maxY - m.region.minY) * toM * 10) / 10,
        doorArcs: m.doors.count,
        tagSignature: tagSignature(m.tags),
      };
    }
  });

  for (const item of items) item.scope = "per-floor";
  return { items, fingerprint };
}
