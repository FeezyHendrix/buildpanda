import { parseLengthText } from "../../geometry/length-text.ts";
import type { DimUnit, DrawingRegion, ExtractedSheet, TextRun } from "../types.ts";
import { segmentsWithin } from "./cluster.ts";
import {
  countDoorArcs,
  countTags,
  curvesInRegion,
  measureWalls,
  textsInRegion,
  wallPenThreshold,
  type DoorArcs,
  type WallMeasurement,
} from "./measure.ts";
import { measureRooms, type RoomMeasurement } from "./rooms.ts";
import {
  classifyOpenings,
  closedRects,
  countColumns,
  countDoorLeaves,
  openingBridges,
  windowFrames,
  type ColumnCount,
  type WallOpening,
  type WindowFrame,
} from "./shapes.ts";

// Everything measured on one drawing region, each element by two readings
// where the drawing allows it, so the bill can say what agreed and what did not.

export interface Check {
  ok: boolean;
  note: string;
}

export interface RegionMeasurement {
  region: DrawingRegion;
  walls: WallMeasurement;
  doors: DoorArcs;
  leaves: number;
  tags: ReturnType<typeof countTags>;
  windows: WindowFrame[];
  openings: WallOpening[];
  columns: ColumnCount;
  rooms: RoomMeasurement;
  // plan extents from the wall centrelines, in mm
  widthMm: number;
  depthMm: number;
  // the overall dimension strings agree with the measured extents
  dimensionCheck: Check;
  // the room areas add up to the footprint less the walls
  areaCheck: Check;
}

const REGION_MARGIN_M = 0.3;
const DIM_SEARCH_M = 4;
const DIM_TOLERANCE = 0.05;
const AREA_TOLERANCE = 0.05;
const UNIT_TO_MM: Record<DimUnit, number> = { mm: 1, cm: 10, m: 1000 };

function extentsFromPairs(walls: WallMeasurement, mmPerPt: number): { widthMm: number; depthMm: number } {
  let hLo = Infinity;
  let hHi = -Infinity;
  let vLo = Infinity;
  let vHi = -Infinity;
  for (const p of walls.pairs) {
    if (p.horizontal) {
      hLo = Math.min(hLo, p.lo);
      hHi = Math.max(hHi, p.hi);
    } else {
      vLo = Math.min(vLo, p.lo);
      vHi = Math.max(vHi, p.hi);
    }
  }
  return {
    widthMm: hHi > hLo ? (hHi - hLo) * mmPerPt : 0,
    depthMm: vHi > vLo ? (vHi - vLo) * mmPerPt : 0,
  };
}

// Bare numbers are in the sheet's dimension unit; feet and inches carry their own.
function dimensionValuesMm(texts: TextRun[], dimUnit: DimUnit): number[] {
  const out: number[] = [];
  for (const t of texts) {
    if (!/^[0-9][0-9,]*(?:\.\d+)?$/.test(t.str) && !/['"]/.test(t.str)) continue;
    const parsed = parseLengthText(t.str);
    if (!parsed) continue;
    const v = parsed.mm ?? (parsed.value ?? 0) * UNIT_TO_MM[dimUnit];
    if (v >= 100 && v <= 200000) out.push(v);
  }
  return out;
}

// The written dimensions are the drawing's own statement of size. A plan whose
// measured width and depth each match one of them within 5 % is measured at
// the right scale and in one piece.
function checkDimensions(texts: TextRun[], dimUnit: DimUnit, widthMm: number, depthMm: number): Check {
  const values = dimensionValuesMm(texts, dimUnit);
  if (values.length === 0) return { ok: false, note: "no dimension strings near the plan to check the wall lengths against" };
  const nearest = (target: number) => values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), values[0]!);
  const parts: string[] = [];
  let ok = true;
  for (const [label, target] of [
    ["width", widthMm],
    ["depth", depthMm],
  ] as const) {
    if (target <= 0) continue;
    const v = nearest(target);
    const err = Math.abs(v - target) / target;
    if (err > DIM_TOLERANCE) ok = false;
    parts.push(`${label} ${Math.round(target)}mm vs dimension ${Math.round(v)} (${(err * 100).toFixed(1)}%)`);
  }
  return { ok, note: `${ok ? "matches" : "disagrees with"} the written dimensions: ${parts.join(", ")}` };
}

// The footprint is the extent of the paired walls alone; dimension lines
// that cluster with the plan, or share its pen, must not inflate it.
function checkArea(walls: WallMeasurement, rooms: RoomMeasurement, mmPerPt: number): Check {
  const sum = rooms.rooms.reduce((s, r) => s + r.areaM2, 0);
  if (sum <= 0) return { ok: false, note: "no rooms filled" };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of walls.pairs) {
    const [a, b] = p.faces;
    if (p.horizontal) {
      minX = Math.min(minX, p.lo);
      maxX = Math.max(maxX, p.hi);
      minY = Math.min(minY, a, b);
      maxY = Math.max(maxY, a, b);
    } else {
      minY = Math.min(minY, p.lo);
      maxY = Math.max(maxY, p.hi);
      minX = Math.min(minX, a, b);
      maxX = Math.max(maxX, a, b);
    }
  }
  if (maxX <= minX || maxY <= minY) return { ok: false, note: "no wall extent to check the rooms against" };
  const footprintM2 = ((maxX - minX) * mmPerPt * (maxY - minY) * mmPerPt) / 1e6;
  const wallPlanM2 = walls.pairs.reduce((s, p) => s + p.lengthM * (p.gapMm / 1000), 0);
  const expected = footprintM2 - wallPlanM2;
  if (expected <= 0) return { ok: false, note: "footprint smaller than the walls" };
  const err = Math.abs(sum - expected) / expected;
  const note = `rooms sum ${sum.toFixed(2)}m2 vs footprint ${footprintM2.toFixed(2)} less walls ${wallPlanM2.toFixed(2)} = ${expected.toFixed(2)}m2 (${(err * 100).toFixed(1)}%)`;
  return { ok: err <= AREA_TOLERANCE, note };
}

export function measureRegion(extracted: ExtractedSheet, region: DrawingRegion, mmPerPt: number, dimUnit: DimUnit): RegionMeasurement {
  const marginPt = (REGION_MARGIN_M * 1000) / mmPerPt;
  const segments = segmentsWithin(extracted.segments, region, marginPt);
  const penPt = wallPenThreshold(segments);
  const walls = measureWalls(segments, mmPerPt, penPt);
  const doors = countDoorArcs(curvesInRegion(extracted.curves, region, marginPt), mmPerPt);
  const thin = segments.filter((s) => s.width < penPt - 1e-6);
  const leaves = countDoorLeaves(thin.length ? thin : segments, doors, mmPerPt);
  const tags = countTags(textsInRegion(extracted.texts, region));
  const rects = closedRects(segments, mmPerPt);
  const windows = windowFrames(rects, walls.pairs, mmPerPt);
  const openings = classifyOpenings(walls.pairs, doors, windows, mmPerPt);
  const columns = countColumns(rects, mmPerPt);
  const rooms = measureRooms(segments, extracted.texts, region, mmPerPt, { penPt, bridges: openingBridges(walls.pairs, openings) });
  const { widthMm, depthMm } = extentsFromPairs(walls, mmPerPt);
  const dimensionCheck = checkDimensions(textsInRegion(extracted.texts, region, (DIM_SEARCH_M * 1000) / mmPerPt), dimUnit, widthMm, depthMm);
  const areaCheck = checkArea(walls, rooms, mmPerPt);
  return { region, walls, doors, leaves, tags, windows, openings, columns, rooms, widthMm, depthMm, dimensionCheck, areaCheck };
}

// A region is a floor plan when it has walls to measure, or doors inside a
// labelled space; dimension strings and title blocks have neither.
export function looksLikePlan(m: RegionMeasurement): boolean {
  return m.walls.pairs.length >= 2 || (m.doors.count > 0 && m.rooms.rooms.length > 0);
}
