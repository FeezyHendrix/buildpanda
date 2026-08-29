import type {
  Confidence,
  Curve,
  DrawingRegion,
  MeasuredGeometry,
  Segment,
  TextRun,
} from "../types.ts";

export const WALL_GAP_MIN_MM = 120;
export const WALL_GAP_MAX_MM = 280;
const WALL_MIN_OVERLAP_M = 0.4;
const WALL_SEG_MAX_M = 25;
const WALL_COLLINEAR_TOL_PT = 0.5;
const WALL_JOINT_MAX_M = 1.2;
const WALL_RUN_MIN_M = 0.6;
const DOOR_RADIUS_MIN_MM = 600;
const DOOR_RADIUS_MAX_MM = 1200;
const DOOR_DEDUPE_MM = 300;

export interface WallMeasurement {
  centrelineM: number;
  pairs: { vertices: number[][]; lengthM: number; gapMm: number }[];
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

function pairSpans(
  spans: Span[],
  mmPerPt: number,
  horizontal: boolean,
): { vertices: number[][]; lengthM: number; gapMm: number }[] {
  const toM = mmPerPt / 1000;
  const eligible = mergeCollinearSpans(spans, mmPerPt).filter((r) => {
    const lenM = (r.hi - r.lo) * toM;
    return lenM >= WALL_RUN_MIN_M && lenM <= WALL_SEG_MAX_M;
  });
  eligible.sort((a, b) => a.fixed - b.fixed);
  const used = new Array<boolean>(eligible.length).fill(false);
  const pairs: { vertices: number[][]; lengthM: number; gapMm: number }[] = [];
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
      });
      break;
    }
  }
  return pairs;
}

// Walls read as two parallel heavy lines at block thickness. Each pair
// contributes its overlap as centreline length — no halving needed because
// pairing already collapses the double line.
export function measureWalls(segments: Segment[], mmPerPt: number): WallMeasurement {
  const heavy = segments.filter((s) => s.width >= 0.15);
  const pairs = [...pairSpans(toSpansH(heavy), mmPerPt, true), ...pairSpans(toSpansV(heavy), mmPerPt, false)];
  const centrelineM = Math.round(pairs.reduce((sum, p) => sum + p.lengthM, 0) * 100) / 100;
  return { centrelineM, pairs };
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

// A door leaf sweeps a quarter-circle arc with radius = leaf width.
export function countDoorArcs(curves: Curve[], mmPerPt: number): { count: number; centres: number[][] } {
  const centres: number[][] = [];
  for (const curve of curves) {
    const fit = circleThrough([curve.sx, curve.sy], bezierPoint(0.5, curve), [curve.ex, curve.ey]);
    if (!fit) continue;
    const radiusMm = fit.r * mmPerPt;
    if (radiusMm < DOOR_RADIUS_MIN_MM || radiusMm > DOOR_RADIUS_MAX_MM) continue;
    const duplicate = centres.some(
      (c) => Math.hypot(c[0]! - fit.cx, c[1]! - fit.cy) * mmPerPt < DOOR_DEDUPE_MM,
    );
    if (!duplicate) centres.push([fit.cx, fit.cy]);
  }
  return { count: centres.length, centres };
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

export function textsInRegion(texts: TextRun[], region: DrawingRegion): TextRun[] {
  return texts.filter((t) => t.x >= region.minX && t.x <= region.maxX && t.y >= region.minY && t.y <= region.maxY);
}

export function curvesInRegion(curves: Curve[], region: DrawingRegion): Curve[] {
  return curves.filter(
    (c) => c.sx >= region.minX && c.sx <= region.maxX && c.sy >= region.minY && c.sy <= region.maxY,
  );
}

// ---------- floor areas: wall-mask flood fill seeded from room labels ----------

const GRID_MM = 50;
// Room labels come in every case ("Toilet", "kitchenette", "STORE"); accept
// word-like text and let the leak/area filters kill bad seeds. Known room
// words are seeded first so a furniture code inside the same room cannot
// claim its name.
const ROOM_LABEL = /^[A-Za-z][A-Za-z .'/-]{2,28}$/;
const SHORT_ROOM_WORDS = new Set(["wc", "whb"]);
const ROOM_WORDS =
  /bed|toilet|bath|kitchen|living|lounge|dining|office|store|reception|lobby|corridor|hall|waiting|conference|meeting|laundry|garage|balcony|terrace|veranda|pantry|study|staff|server|record|library|clinic|ward|prayer|mail|copy|print|gym|studio|shop|kiosk|cafe|canteen/i;
const ROOM_LABEL_BLOCKLIST =
  /plan|elevation|section|scale|detail|note|drawing|project|sheet|level|general|legend|schedule|title|type|mark|date|drawn|checked|approved|designed|sign|furniture|equipment|miscelan|desk|chair|computer|phone|machine|couch|cabinate|cabinet|blinde|planter|dust bin/i;

export interface RoomArea {
  name: string;
  areaM2: number;
  seed: number[];
}

export function measureRoomAreas(
  segments: Segment[],
  texts: TextRun[],
  region: DrawingRegion,
  mmPerPt: number,
): RoomArea[] {
  const toMm = mmPerPt;
  const cellPt = GRID_MM / toMm;
  const cols = Math.min(2000, Math.ceil((region.maxX - region.minX) / cellPt));
  const rowsN = Math.min(2000, Math.ceil((region.maxY - region.minY) / cellPt));
  if (cols < 10 || rowsN < 10) return [];

  // 0 = open, 1 = wall
  const grid = new Uint8Array(cols * rowsN);
  const stamp = (x: number, y: number) => {
    const cx = Math.floor((x - region.minX) / cellPt);
    const cy = Math.floor((y - region.minY) / cellPt);
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rowsN) grid[cy * cols + cx] = 1;
  };
  for (const s of segments) {
    if (s.width < 0.15) continue; // wall pens only
    const steps = Math.max(1, Math.ceil(s.len / (cellPt / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stamp(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t);
    }
  }

  // Morphological closing (dilate N, erode N) seals door/window openings up
  // to ~2N cells (10 passes x 50mm = ~1m) without permanently thickening
  // walls — sealed bridges survive erosion, plain wall faces shrink back.
  const CLOSING_PASSES = 10;
  const neighborPass = (source: Uint8Array, match: number, set: number): Uint8Array => {
    const out = new Uint8Array(source);
    for (let y = 0; y < rowsN; y++) {
      for (let x = 0; x < cols; x++) {
        if (source[y * cols + x] !== match) continue;
        let flip = false;
        for (let dy = -1; dy <= 1 && !flip; dy++) {
          for (let dx = -1; dx <= 1 && !flip; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rowsN && source[ny * cols + nx] !== match) flip = true;
          }
        }
        if (flip) out[y * cols + x] = set;
      }
    }
    return out;
  };
  let dilated = new Uint8Array(grid);
  for (let pass = 0; pass < CLOSING_PASSES; pass++) dilated = neighborPass(dilated, 0, 1);
  for (let pass = 0; pass < CLOSING_PASSES; pass++) dilated = neighborPass(dilated, 1, 0);
  // keep original walls regardless of erosion rounding
  for (let i = 0; i < grid.length; i++) if (grid[i]) dilated[i] = 1;

  const inRegion = (t: TextRun): boolean =>
    t.x >= region.minX && t.x <= region.maxX && t.y >= region.minY && t.y <= region.maxY;
  // A room seed must be an actual room NAME (a known room word), not any text
  // that merely looks like a word. Otherwise annotation/material labels
  // ("BRICKWORK", "REFER TO ENGINEERS", "SITE BOUNDARY", "AGGREGATE") get
  // flood-filled as rooms and produce garbage areas. Refuse rather than guess.
  const isLabel = (t: TextRun): boolean => {
    if (t.rotated || !inRegion(t)) return false;
    const str = t.str.trim();
    if (SHORT_ROOM_WORDS.has(str.toLowerCase())) return true;
    if (!ROOM_LABEL.test(str) || str.length < 3) return false;
    if (ROOM_LABEL_BLOCKLIST.test(str)) return false;
    if (/^[wd]-?\d{1,2}$/i.test(str)) return false; // opening tags
    return ROOM_WORDS.test(str);
  };
  // known room words seed first so they win the naming race for their room
  const labels = texts
    .filter(isLabel)
    .sort((a, b) => Number(ROOM_WORDS.test(b.str)) - Number(ROOM_WORDS.test(a.str)) || b.str.length - a.str.length);

  const results: RoomArea[] = [];
  const cellAreaM2 = (GRID_MM / 1000) ** 2;

  const floodFrom = (wallMask: Uint8Array, startIdx: number): { cells: number[]; leaked: boolean } => {
    const filled = new Uint8Array(cols * rowsN);
    const stack = [startIdx];
    const cells: number[] = [];
    filled[startIdx] = 1;
    let leaked = false;
    while (stack.length) {
      const idx = stack.pop()!;
      cells.push(idx);
      if (cells.length > 200000) {
        leaked = true;
        break;
      }
      const x = idx % cols;
      const y = Math.floor(idx / cols);
      if (x === 0 || x === cols - 1 || y === 0 || y === rowsN - 1) leaked = true; // reached region edge: unbounded
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rowsN) continue;
        const nIdx = ny * cols + nx;
        if (wallMask[nIdx] || filled[nIdx]) continue;
        filled[nIdx] = 1;
        stack.push(nIdx);
      }
    }
    return { cells, leaked };
  };

  const claimed = new Uint8Array(cols * rowsN);
  for (const label of labels) {
    const sx = Math.floor((label.x + label.w / 2 - region.minX) / cellPt);
    const sy = Math.floor((label.y - region.minY) / cellPt);
    if (sx < 0 || sx >= cols || sy < 0 || sy >= rowsN) continue;
    const startIdx = sy * cols + sx;
    if (claimed[startIdx]) continue;

    // Fill on the raw walls first — most residential rooms are already sealed
    // there, and the door-sealing dilation, if applied up front, floods narrow
    // rooms shut (a 10-pass closing swallows every seed on a compact bungalow).
    // Only when the raw fill leaks (a real door gap to outside) do we retry on
    // the sealed grid, which closes openings up to ~1m.
    let { cells, leaked } = grid[startIdx] ? { cells: [], leaked: true } : floodFrom(grid, startIdx);
    if (leaked && !dilated[startIdx]) ({ cells, leaked } = floodFrom(dilated, startIdx));
    if (leaked) continue;

    const areaM2 = Math.round(cells.length * cellAreaM2 * 100) / 100;
    if (areaM2 < 1 || areaM2 > 400) continue;
    for (const c of cells) claimed[c] = 1;
    results.push({ name: label.str, areaM2, seed: [label.x, label.y] });
  }
  return results;
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
