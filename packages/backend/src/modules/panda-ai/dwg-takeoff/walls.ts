import type { WallSegment } from "./wall-segments.ts";

export { autoWallSegments, wallSegments, type WallSegment } from "./wall-segments.ts";
export { openingAreaM2, storeyHeight, thicknessModes, wallItems, type HeightDecision, type Openings, type ThicknessMode } from "./wall-items.ts";

// Walls are measured from their own geometry: thickness from the gap between
// paired faces, length from the paired runs, height from the level marks.
// Nothing here is assumed unless the drawing gives no alternative, and then
// the basis says "assumed".


export interface WallMeasure {
  // thickness mode in mm → centreline length in m and the handles behind it
  byThickness: Map<number, { lengthM: number; evidence: Set<number> }>;
  pairedM: number;
  unpairedM: number;
  // metres of wall line recovered across door and window openings
  bridgedM: number;
  // the bridged openings as segments, so a room mask can close them
  seals: WallSegment[];
  // every wall line with its extent, for the checks against dimensions
  lines: WallLineSummary[];
}

export interface WallLineSummary {
  dir: [number, number];
  offset: number; // drawing units, across the line
  thicknessMm: number;
  lo: number; // drawing units, along the line
  hi: number;
  extentUnits: number;
}

// A wall line: every paired face that lies on the same straight line at the
// same thickness, as intervals along that line in drawing units.
interface WallLine {
  dir: [number, number];
  offset: number;
  thicknessUnits: number;
  intervals: Array<[number, number]>;
  evidence: Set<number>;
}

const OPENING_BRIDGE_MM = 2500;
const JAMB_TOLERANCE_MM = 60;
// a door leaf or swing sits inside the room, up to a leaf width off the wall line
const OPENING_REACH_MM = 1300;
// a wall face is at least this long, unless it continues a longer face on
// the same line (a short pier between two windows); anything shorter that
// stands alone is a jamb, a hatch stroke or a tick, never a face
const FACE_MIN_MM = 500;
const FACE_LONG_MM = 1000;
// two faces of one wall overlap along it; a frame edge or a skirting line
// crossing briefly does not, unless the overlap is a real length of wall
const OVERLAP_MIN_MM = 300;

// Which segments may be wall faces: the long ones, and the short ones that
// lie on the same line as a long one.
function faceCandidates(segments: WallSegment[], scaleToMm: number): boolean[] {
  const minLen = FACE_MIN_MM / scaleToMm;
  const longLen = FACE_LONG_MM / scaleToMm;
  const tol = 5 / scaleToMm;
  const lines: Array<{ dir: [number, number]; offset: number }> = [];
  const axisOf = (s: WallSegment): { dir: [number, number]; offset: number } => {
    let ax = (s.x2 - s.x1) / s.len;
    let ay = (s.y2 - s.y1) / s.len;
    if (ax < -1e-9 || (Math.abs(ax) < 1e-9 && ay < 0)) {
      ax = -ax;
      ay = -ay;
    }
    return { dir: [ax, ay], offset: s.x1 * -ay + s.y1 * ax };
  };
  for (const s of segments) if (s.len >= longLen) lines.push(axisOf(s));
  return segments.map((s) => {
    if (s.len >= minLen) return true;
    const a = axisOf(s);
    return lines.some((l) => Math.abs(l.dir[0] - a.dir[0]) < 0.005 && Math.abs(l.dir[1] - a.dir[1]) < 0.005 && Math.abs(l.offset - a.offset) <= tol);
  });
}

/**
 * Pair each wall face with a parallel face 80–400 mm away that overlaps it;
 * the gap is the wall thickness and the overlap is wall length. The faces of
 * one wall are then joined into a wall line, and the gaps a door or window
 * cut into the faces are bridged where a jamb closes the wall or an opening
 * sits in the gap — the centreline runs through openings, which are deducted
 * by area afterwards. Faces with no partner are single-line walls or stray
 * lines and are reported, not measured as walls.
 */
export function measureWallRuns(segments: WallSegment[], scaleToMm: number, openings: Array<[number, number]> = []): WallMeasure {
  const byThickness = new Map<number, { lengthM: number; evidence: Set<number> }>();
  let unpairedUnits = 0;
  const minGap = 80 / scaleToMm;
  const maxGap = 400 / scaleToMm;
  const lines: WallLine[] = [];
  const candidate = faceCandidates(segments, scaleToMm);
  const overlapMin = OVERLAP_MIN_MM / scaleToMm;
  const lineFor = (dir: [number, number], offset: number, thicknessUnits: number): WallLine => {
    const found = lines.find((l) => Math.abs(l.dir[0] - dir[0]) < 0.005 && Math.abs(l.dir[1] - dir[1]) < 0.005 && Math.abs(l.offset - offset) <= 5 / scaleToMm && Math.abs(l.thicknessUnits - thicknessUnits) < 1e-6);
    if (found) return found;
    const line: WallLine = { dir, offset, thicknessUnits, intervals: [], evidence: new Set() };
    lines.push(line);
    return line;
  };
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!;
    if (!candidate[i]) continue;
    let ax = (a.x2 - a.x1) / a.len;
    let ay = (a.y2 - a.y1) / a.len;
    // one orientation per direction so opposite-drawn faces share a line
    if (ax < -1e-9 || (Math.abs(ax) < 1e-9 && ay < 0)) {
      ax = -ax;
      ay = -ay;
    }
    // positions along the line and across it are absolute, so faces drawn
    // in either direction land on the same axis
    const along = (x: number, y: number) => x * ax + y * ay;
    const across = (x: number, y: number) => x * -ay + y * ax;
    const aLo = Math.min(along(a.x1, a.y1), along(a.x2, a.y2));
    const aHi = aLo + a.len;
    const offset = across(a.x1, a.y1);
    // candidate partners grouped by thickness (to 25 mm: block sizes are 100,
    // 150, 225, 230, 300); the other face of a wall may be split at doors, so
    // the overlaps at one gap add up
    const byGap = new Map<number, Array<[number, number]>>();
    for (let j = 0; j < segments.length; j++) {
      if (i === j || !candidate[j]) continue;
      const b = segments[j]!;
      const bx = (b.x2 - b.x1) / b.len;
      const by = (b.y2 - b.y1) / b.len;
      if (Math.abs(ax * bx + ay * by) < 0.995) continue; // not parallel
      const gap = Math.abs(across((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2) - offset);
      if (gap < minGap || gap > maxGap) continue;
      const t1 = along(b.x1, b.y1);
      const t2 = along(b.x2, b.y2);
      const lo = Math.max(aLo, Math.min(t1, t2));
      const hi = Math.min(aHi, Math.max(t1, t2));
      // a window frame or a skirting line crossing briefly is not the other
      // face; a face split into pieces at odd joints still overlaps its
      // partner by a real length of wall
      if (hi - lo < Math.min(0.5 * Math.min(a.len, b.len), overlapMin)) continue;
      const thicknessMm = Math.round((gap * scaleToMm) / 25) * 25;
      const list = byGap.get(thicknessMm) ?? [];
      list.push([lo, hi]);
      byGap.set(thicknessMm, list);
    }
    // the wall's own other face is the gap with the most face alongside
    let best: [number, Array<[number, number]>] | null = null;
    let bestCover = 0;
    for (const [t, ivs] of byGap) {
      const cover = mergedLength(ivs);
      if (cover > bestCover || (cover === bestCover && best && t < best[0])) {
        best = [t, ivs];
        bestCover = cover;
      }
    }
    if (!best) {
      // jambs and end caps are one thickness long and never pair: not a wall lost
      if (a.len > maxGap) unpairedUnits += a.len;
      continue;
    }
    const [thicknessMm, ivs] = best;
    const line = lineFor([ax, ay], offset, thicknessMm / scaleToMm);
    for (const iv of ivs) line.intervals.push(iv);
    if (a.handle !== null) line.evidence.add(a.handle);
  }

  // a door beside a stray pairing (a wall face against a nearby cupboard
  // line) must not bridge that pairing into a wall: only thicknesses that
  // carry 5 % of the raw paired length may bridge on opening elements
  const rawByThickness = new Map<number, number>();
  for (const line of lines) rawByThickness.set(line.thicknessUnits, (rawByThickness.get(line.thicknessUnits) ?? 0) + mergedLength(line.intervals));
  const rawTotal = [...rawByThickness.values()].reduce((s, v) => s + v, 0);
  let bridgedUnits = 0;
  let pairedUnits = 0;
  const seals: WallSegment[] = [];
  const summaries: WallLineSummary[] = [];
  for (const line of lines) {
    const merged = mergeIntervals(line.intervals);
    const realThickness = (rawByThickness.get(line.thicknessUnits) ?? 0) >= 0.05 * rawTotal;
    const bridged = bridgeOpenings(merged, line, segments, realThickness ? openings : [], scaleToMm);
    bridgedUnits += bridged.bridged;
    for (const [lo, hi] of bridged.gaps) seals.push(onLine(line, lo, hi));
    const extent = bridged.intervals.reduce((s, [lo, hi]) => s + (hi - lo), 0);
    pairedUnits += extent;
    const thicknessMm = Math.round((line.thicknessUnits * scaleToMm) / 25) * 25;
    if (bridged.intervals.length) {
      summaries.push({ dir: line.dir, offset: line.offset, thicknessMm, lo: bridged.intervals[0]![0], hi: bridged.intervals[bridged.intervals.length - 1]![1], extentUnits: extent });
    }
    const entry = byThickness.get(thicknessMm) ?? { lengthM: 0, evidence: new Set<number>() };
    // each face line contributes half its extent: the pair together is one wall
    entry.lengthM += (extent * scaleToMm) / 1000 / 2;
    for (const h of line.evidence) entry.evidence.add(h);
    byThickness.set(thicknessMm, entry);
  }
  for (const entry of byThickness.values()) entry.lengthM = Math.round(entry.lengthM * 1000) / 1000;
  return {
    byThickness,
    pairedM: (pairedUnits * scaleToMm) / 1000 / 2,
    unpairedM: (unpairedUnits * scaleToMm) / 1000,
    bridgedM: (bridgedUnits * scaleToMm) / 1000 / 2,
    seals,
    lines: summaries,
  };
}

/** The segment between two along-line positions on a wall line. */
function onLine(line: WallLine, lo: number, hi: number): WallSegment {
  const [dx, dy] = line.dir;
  const x1 = lo * dx - line.offset * dy;
  const y1 = lo * dy + line.offset * dx;
  const x2 = hi * dx - line.offset * dy;
  const y2 = hi * dy + line.offset * dx;
  return { handle: null, x1, y1, x2, y2, len: hi - lo };
}

function mergeIntervals(ivs: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...ivs].sort((p, q) => p[0] - q[0]);
  const out: Array<[number, number]> = [];
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1];
    if (last && lo <= last[1] + 1e-6) last[1] = Math.max(last[1], hi);
    else out.push([lo, hi]);
  }
  return out;
}

function mergedLength(ivs: Array<[number, number]>): number {
  return mergeIntervals(ivs).reduce((s, [lo, hi]) => s + (hi - lo), 0);
}

/**
 * A gap between two collinear stretches of one wall line is an opening when
 * it is no wider than a door or window and either a jamb (a short segment
 * across the wall's thickness) stands at each end or a door or window sits
 * inside it. The centreline runs through; the opening is deducted by area.
 */
function bridgeOpenings(
  intervals: Array<[number, number]>,
  line: WallLine,
  segments: WallSegment[],
  openings: Array<[number, number]>,
  scaleToMm: number,
): { intervals: Array<[number, number]>; bridged: number; gaps: Array<[number, number]> } {
  if (intervals.length < 2) return { intervals, bridged: 0, gaps: [] };
  const [dx, dy] = line.dir;
  const along = (x: number, y: number) => x * dx + y * dy;
  const across = (x: number, y: number) => x * -dy + y * dx;
  const maxGap = OPENING_BRIDGE_MM / scaleToMm;
  const tol = JAMB_TOLERANCE_MM / scaleToMm;
  const t = line.thicknessUnits;
  // jambs: segments perpendicular to the line, about one thickness long, that
  // sit between the two faces of this wall
  const jambs = segments
    .filter((s) => {
      const sx = (s.x2 - s.x1) / s.len;
      const sy = (s.y2 - s.y1) / s.len;
      if (Math.abs(sx * dx + sy * dy) > 0.1) return false;
      if (s.len < 0.5 * t || s.len > 1.6 * t) return false;
      const a1 = across(s.x1, s.y1);
      const a2 = across(s.x2, s.y2);
      const lo = Math.min(a1, a2) - tol;
      const hi = Math.max(a1, a2) + tol;
      // the jamb must span this face's offset (it closes the wall this face belongs to)
      return line.offset >= lo && line.offset <= hi;
    })
    .map((s) => along((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2));
  const reach = OPENING_REACH_MM / scaleToMm;
  const openingsAlong = openings
    .filter(([x, y]) => Math.abs(across(x, y) - line.offset) <= reach)
    .map(([x, y]) => along(x, y));
  const out: Array<[number, number]> = [intervals[0]!];
  const gaps: Array<[number, number]> = [];
  let bridged = 0;
  for (let i = 1; i < intervals.length; i++) {
    const prev = out[out.length - 1]!;
    const [lo, hi] = intervals[i]!;
    const gap = lo - prev[1];
    if (gap > 0 && gap <= maxGap) {
      const jambAtStart = jambs.some((j) => Math.abs(j - prev[1]) <= tol);
      const jambAtEnd = jambs.some((j) => Math.abs(j - lo) <= tol);
      const openingInside = openingsAlong.some((o) => o >= prev[1] - tol && o <= lo + tol);
      if ((jambAtStart && jambAtEnd) || openingInside) {
        bridged += gap;
        gaps.push([prev[1], lo]);
        prev[1] = Math.max(prev[1], hi);
        continue;
      }
    }
    out.push([lo, hi]);
  }
  return { intervals: out, bridged, gaps };
}
