import type { Confidence, Curve, DrawingRegion, MeasuredGeometry, Segment, TextRun } from "../types.ts";

export { measureRoomAreas, measureRooms, type RoomArea, type RoomMeasurement } from "./rooms.ts";

export const WALL_GAP_MIN_MM = 120;
// 300 mm (12") external walls are as common as 225 mm (9") ones
export const WALL_GAP_MAX_MM = 350;
const WALL_MIN_OVERLAP_M = 0.4;
const WALL_SEG_MAX_M = 40;
const WALL_COLLINEAR_TOL_PT = 0.5;
// openings up to a double door or a wide window are bridged into one run
const WALL_JOINT_MAX_M = 2.0;
const WALL_RUN_MIN_M = 0.6;
const DOOR_RADIUS_MIN_MM = 600;
const DOOR_RADIUS_MAX_MM = 1200;
const DOOR_DEDUPE_MM = 300;
export const DEFAULT_WALL_PEN_PT = 0.15;

export interface WallPair {
  vertices: number[][];
  lengthM: number;
  gapMm: number;
  horizontal: boolean;
  // the two face coordinates on the perpendicular axis, and the span along the wall
  faces: [number, number];
  lo: number;
  hi: number;
  // breaks in both faces along the span: door and window openings, in pt
  openings: { lo: number; hi: number }[];
}

export interface WallMeasurement {
  centrelineM: number;
  pairs: WallPair[];
  penPt: number;
}

interface Span {
  fixed: number; // the shared axis coordinate
  lo: number;
  hi: number;
}

interface RunSpan extends Span {
  parts: { lo: number; hi: number }[];
}

// A block/sandcrete wall face is often drawn as several collinear segments split
// by door/window openings or CAD joints. Joining them into one continuous run —
// bridging joints up to WALL_JOINT_MAX_M — lets pairing annotate the whole wall
// instead of a single fragment's overlap.
function mergeCollinearSpans(spans: Span[], mmPerPt: number): RunSpan[] {
  if (spans.length === 0) return [];
  const toM = mmPerPt / 1000;
  const jointMaxPt = WALL_JOINT_MAX_M / toM;
  const sorted = [...spans].sort((a, b) => a.fixed - b.fixed || a.lo - b.lo);

  const runs: RunSpan[] = [];
  let g = 0;
  while (g < sorted.length) {
    let h = g;
    while (h + 1 < sorted.length && Math.abs(sorted[h + 1]!.fixed - sorted[g]!.fixed) <= WALL_COLLINEAR_TOL_PT) {
      h++;
    }
    const group = sorted.slice(g, h + 1).sort((a, b) => a.lo - b.lo);
    g = h + 1;

    let cur: RunSpan | null = null;
    for (const s of group) {
      if (!cur) {
        cur = { fixed: s.fixed, lo: s.lo, hi: s.hi, parts: [{ lo: s.lo, hi: s.hi }] };
        continue;
      }
      const gap = s.lo - cur.hi;
      if (gap <= jointMaxPt) {
        const curLen = cur.hi - cur.lo;
        const sLen = s.hi - s.lo;
        cur.fixed = (cur.fixed * curLen + s.fixed * sLen) / (curLen + sLen || 1);
        if (gap > 0) {
          cur.parts.push({ lo: s.lo, hi: s.hi });
        } else {
          const last = cur.parts[cur.parts.length - 1]!;
          last.hi = Math.max(last.hi, s.hi);
        }
        cur.hi = Math.max(cur.hi, s.hi);
      } else {
        runs.push(cur);
        cur = { fixed: s.fixed, lo: s.lo, hi: s.hi, parts: [{ lo: s.lo, hi: s.hi }] };
      }
    }
    if (cur) runs.push(cur);
  }
  return runs;
}

function toSpansH(segments: Segment[]): Span[] {
  return segments
    .filter((s) => Math.abs(s.y1 - s.y2) < 0.3)
    .map((s) => ({ fixed: s.y1, lo: Math.min(s.x1, s.x2), hi: Math.max(s.x1, s.x2) }));
}

function toSpansV(segments: Segment[]): Span[] {
  return segments
    .filter((s) => Math.abs(s.x1 - s.x2) < 0.3)
    .map((s) => ({ fixed: s.x1, lo: Math.min(s.y1, s.y2), hi: Math.max(s.y1, s.y2) }));
}

function gapsOf(run: RunSpan): { lo: number; hi: number }[] {
  const gaps: { lo: number; hi: number }[] = [];
  for (let i = 1; i < run.parts.length; i++) {
    const lo = run.parts[i - 1]!.hi;
    const hi = run.parts[i]!.lo;
    if (hi > lo) gaps.push({ lo, hi });
  }
  return gaps;
}

// An opening breaks both faces at the same place. Keep the gaps the two runs
// share (their overlap), clipped to the paired span.
function sharedOpenings(a: RunSpan, b: RunSpan, lo: number, hi: number, minPt: number): { lo: number; hi: number }[] {
  const out: { lo: number; hi: number }[] = [];
  for (const ga of gapsOf(a)) {
    for (const gb of gapsOf(b)) {
      const l = Math.max(ga.lo, gb.lo, lo);
      const h = Math.min(ga.hi, gb.hi, hi);
      if (h - l >= minPt) out.push({ lo: l, hi: h });
    }
  }
  return out.sort((p, q) => p.lo - q.lo);
}

function pairSpans(spans: Span[], mmPerPt: number, horizontal: boolean): WallPair[] {
  const toM = mmPerPt / 1000;
  const eligible = mergeCollinearSpans(spans, mmPerPt).filter((r) => {
    const lenM = (r.hi - r.lo) * toM;
    return lenM >= WALL_RUN_MIN_M && lenM <= WALL_SEG_MAX_M;
  });
  eligible.sort((a, b) => a.fixed - b.fixed);
  const used = new Array<boolean>(eligible.length).fill(false);
  const pairs: WallPair[] = [];
  for (let i = 0; i < eligible.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < eligible.length; j++) {
      if (used[j]) continue;
      const a = eligible[i]!;
      const b = eligible[j]!;
      const gapMm = Math.abs(a.fixed - b.fixed) * mmPerPt;
      if (gapMm > WALL_GAP_MAX_MM) break; // sorted by fixed axis: no closer partner further on
      if (gapMm < WALL_GAP_MIN_MM) continue;
      // Annotate the full overlap of the two merged runs — the whole wall span.
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);
      const overlapM = (hi - lo) * toM;
      if (overlapM < WALL_MIN_OVERLAP_M) continue;
      used[i] = true;
      used[j] = true;
      const centre = (a.fixed + b.fixed) / 2;
      pairs.push({
        vertices: horizontal
          ? [
              [lo, centre],
              [hi, centre],
            ]
          : [
              [centre, lo],
              [centre, hi],
            ],
        lengthM: Math.round(overlapM * 100) / 100,
        gapMm: Math.round(gapMm),
        horizontal,
        faces: [a.fixed, b.fixed],
        lo,
        hi,
        openings: sharedOpenings(a, b, lo, hi, 300 / mmPerPt),
      });
      break;
    }
  }
  return pairs;
}

// The wall pen is whatever pen is clearly heavier than the rest of the sheet,
// weighted by drawn length: the split between consecutive distinct widths with
// the biggest jump, provided the heavy side is a minority (3–70 %) of the ink.
// A sheet drawn with one pen has no heavy side, so every line is a candidate
// and geometry alone decides.
export function wallPenThreshold(segments: Segment[]): number {
  const byWidth = new Map<number, number>();
  let total = 0;
  for (const s of segments) {
    const w = Math.round(s.width * 1000) / 1000;
    byWidth.set(w, (byWidth.get(w) ?? 0) + s.len);
    total += s.len;
  }
  const widths = [...byWidth.keys()].sort((a, b) => a - b);
  if (widths.length < 2 || total === 0) return widths[0] ?? DEFAULT_WALL_PEN_PT;
  let best: { ratio: number; width: number } | null = null;
  let heavyLen = total;
  for (let k = 1; k < widths.length; k++) {
    heavyLen -= byWidth.get(widths[k - 1]!)!;
    const share = heavyLen / total;
    const ratio = widths[k]! / Math.max(widths[k - 1]!, 1e-6);
    if (ratio < 1.5 || share < 0.03 || share > 0.7) continue;
    if (!best || ratio > best.ratio) best = { ratio, width: widths[k]! };
  }
  if (best) return best.width;
  return widths.some((w) => w >= DEFAULT_WALL_PEN_PT) ? DEFAULT_WALL_PEN_PT : widths[0]!;
}

// Walls read as two parallel heavy lines at block thickness. Each pair
// contributes its overlap as centreline length — no halving needed because
// pairing already collapses the double line.
export function measureWalls(segments: Segment[], mmPerPt: number, penPt = wallPenThreshold(segments)): WallMeasurement {
  const heavy = segments.filter((s) => s.width >= penPt - 1e-6);
  const pairs = [...pairSpans(toSpansH(heavy), mmPerPt, true), ...pairSpans(toSpansV(heavy), mmPerPt, false)];
  const centrelineM = Math.round(pairs.reduce((sum, p) => sum + p.lengthM, 0) * 100) / 100;
  return { centrelineM, pairs, penPt };
}

function bezierPoint(t: number, c: Curve): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * c.sx + 3 * u * u * t * c.c1x + 3 * u * t * t * c.c2x + t * t * t * c.ex,
    u * u * u * c.sy + 3 * u * u * t * c.c1y + 3 * u * t * t * c.c2y + t * t * t * c.ey,
  ];
}

function circleThrough(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): { r: number; cx: number; cy: number } | null {
  const [ax, ay] = p1;
  const [bx, by] = p2;
  const [cx, cy] = p3;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return { r: Math.hypot(ax - ux, ay - uy), cx: ux, cy: uy };
}

export interface DoorArcs {
  count: number;
  centres: number[][];
  radiiMm: number[];
}

// A door leaf sweeps a quarter-circle arc with radius = leaf width.
export function countDoorArcs(curves: Curve[], mmPerPt: number): DoorArcs {
  const centres: number[][] = [];
  const radiiMm: number[] = [];
  for (const curve of curves) {
    const fit = circleThrough([curve.sx, curve.sy], bezierPoint(0.5, curve), [curve.ex, curve.ey]);
    if (!fit) continue;
    const radiusMm = fit.r * mmPerPt;
    if (radiusMm < DOOR_RADIUS_MIN_MM || radiusMm > DOOR_RADIUS_MAX_MM) continue;
    const duplicate = centres.some((c) => Math.hypot(c[0]! - fit.cx, c[1]! - fit.cy) * mmPerPt < DOOR_DEDUPE_MM);
    if (!duplicate) {
      centres.push([fit.cx, fit.cy]);
      radiiMm.push(Math.round(radiusMm));
    }
  }
  return { count: centres.length, centres, radiiMm };
}

const TAG_PATTERN = /^([WD])[- ]?(\d{1,2})$/i;

export function countTags(texts: TextRun[]): { windows: Map<string, TextRun[]>; doors: Map<string, TextRun[]> } {
  const windows = new Map<string, TextRun[]>();
  const doors = new Map<string, TextRun[]>();
  for (const t of texts) {
    const m = t.str.match(TAG_PATTERN);
    if (!m) continue;
    const key = `${m[1]!.toUpperCase()}${m[2]}`;
    const bucket = m[1]!.toUpperCase() === "W" ? windows : doors;
    const list = bucket.get(key);
    if (list) list.push(t);
    else bucket.set(key, [t]);
  }
  return { windows, doors };
}

export function textsInRegion(texts: TextRun[], region: DrawingRegion, marginPt = 0): TextRun[] {
  return texts.filter(
    (t) => t.x >= region.minX - marginPt && t.x <= region.maxX + marginPt && t.y >= region.minY - marginPt && t.y <= region.maxY + marginPt,
  );
}

export function curvesInRegion(curves: Curve[], region: DrawingRegion, marginPt = 0): Curve[] {
  return curves.filter(
    (c) => c.sx >= region.minX - marginPt && c.sx <= region.maxX + marginPt && c.sy >= region.minY - marginPt && c.sy <= region.maxY + marginPt,
  );
}

export function wallConfidence(pairs: number, calibrationConfidence: number): Confidence {
  return pairs >= 8 && calibrationConfidence >= 0.7 ? "high" : "low";
}

export function geometryFromWallPairs(pairs: WallMeasurement["pairs"]): MeasuredGeometry[] {
  return pairs.map((p) => ({
    kind: "linear" as const,
    vertices: p.vertices,
    quantity: p.lengthM,
    unit: "m",
  }));
}
