import type { Segment } from "../types.ts";
import type { DoorArcs, WallPair } from "./measure.ts";

// Closed outlines and what they mean on a plan: a compact square at a grid
// point is a column, a thin rectangle lying in a wall is a window, and a break
// in both wall faces is an opening that a door swing or a window frame claims.

export interface ClosedRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  wMm: number;
  hMm: number;
  widthPt: number;
}

const AXIS_TOL_PT = 0.3;

// Rebuild axis-aligned rectangles from closed subpaths of four segments.
export function closedRects(segments: Segment[], mmPerPt: number): ClosedRect[] {
  const byPath = new Map<number, Segment[]>();
  for (const s of segments) {
    if (!s.closed || s.path === undefined) continue;
    const list = byPath.get(s.path);
    if (list) list.push(s);
    else byPath.set(s.path, [s]);
  }
  const rects: ClosedRect[] = [];
  for (const parts of byPath.values()) {
    const sides = parts.filter((s) => s.len > 1e-6);
    if (sides.length !== 4) continue;
    if (!sides.every((s) => Math.abs(s.x1 - s.x2) < AXIS_TOL_PT || Math.abs(s.y1 - s.y2) < AXIS_TOL_PT)) continue;
    const horizontal = sides.filter((s) => Math.abs(s.y1 - s.y2) < AXIS_TOL_PT).length;
    if (horizontal !== 2) continue;
    const xs = sides.flatMap((s) => [s.x1, s.x2]);
    const ys = sides.flatMap((s) => [s.y1, s.y2]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    rects.push({
      minX,
      minY,
      maxX,
      maxY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      wMm: (maxX - minX) * mmPerPt,
      hMm: (maxY - minY) * mmPerPt,
      widthPt: sides[0]!.width,
    });
  }
  return rects;
}

export interface ColumnCount {
  count: number;
  centres: number[][];
  // share of columns that line up with another column on both axes
  griddedShare: number;
}

const COLUMN_MIN_MM = 150;
const COLUMN_MAX_MM = 800;
const COLUMN_MAX_ASPECT = 1.3;
const GRID_ALIGN_MM = 50;

// Columns are compact closed squares; on a framed building they sit on a
// regular grid, which is the second reading that confirms them.
export function countColumns(rects: ClosedRect[], mmPerPt: number): ColumnCount {
  const squares = rects.filter((r) => {
    const lo = Math.min(r.wMm, r.hMm);
    const hi = Math.max(r.wMm, r.hMm);
    return lo >= COLUMN_MIN_MM && hi <= COLUMN_MAX_MM && hi / lo <= COLUMN_MAX_ASPECT;
  });
  const tol = GRID_ALIGN_MM / mmPerPt;
  let gridded = 0;
  for (const a of squares) {
    const sameX = squares.some((b) => b !== a && Math.abs(b.cx - a.cx) <= tol);
    const sameY = squares.some((b) => b !== a && Math.abs(b.cy - a.cy) <= tol);
    if (sameX && sameY) gridded++;
  }
  return {
    count: squares.length,
    centres: squares.map((s) => [s.cx, s.cy]),
    griddedShare: squares.length ? gridded / squares.length : 0,
  };
}

export interface WallOpening {
  pair: number; // index into the wall pairs
  lo: number;
  hi: number;
  widthMm: number;
  kind: "door" | "window" | "unknown";
  centre: number[];
}

export interface WindowFrame {
  cx: number;
  cy: number;
  widthMm: number;
  pair: number;
}

const WINDOW_MIN_MM = 500;
const WINDOW_MAX_MM = 3500;
const WINDOW_FRAME_MAX_MM = 350;
const ON_WALL_MM = 200;
const HINGE_MM = 250;

function alongAndAcross(pair: WallPair, x: number, y: number): { along: number; across: number } {
  const centre = (pair.faces[0] + pair.faces[1]) / 2;
  return pair.horizontal ? { along: x, across: Math.abs(y - centre) } : { along: y, across: Math.abs(x - centre) };
}

// A window on plan is a thin closed rectangle whose long side lies along a
// wall and whose centre sits on that wall's centreline.
export function windowFrames(rects: ClosedRect[], pairs: WallPair[], mmPerPt: number): WindowFrame[] {
  const out: WindowFrame[] = [];
  for (const r of rects) {
    const long = Math.max(r.wMm, r.hMm);
    const short = Math.min(r.wMm, r.hMm);
    if (long < WINDOW_MIN_MM || long > WINDOW_MAX_MM || short > WINDOW_FRAME_MAX_MM) continue;
    const alongX = r.wMm >= r.hMm;
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i]!;
      if (p.horizontal !== alongX) continue;
      const { along, across } = alongAndAcross(p, r.cx, r.cy);
      if (across * mmPerPt > ON_WALL_MM || along < p.lo || along > p.hi) continue;
      out.push({ cx: r.cx, cy: r.cy, widthMm: Math.round(long), pair: i });
      break;
    }
  }
  return out;
}

// Every break in a wall pair is an opening. A door swing hinged at one end of
// the break claims it as a door; a window frame inside it claims it as a
// window; the rest stay unknown so nothing is deducted on a guess.
export function classifyOpenings(pairs: WallPair[], doors: DoorArcs, windows: WindowFrame[], mmPerPt: number): WallOpening[] {
  const out: WallOpening[] = [];
  const hingePt = HINGE_MM / mmPerPt;
  const onWallPt = ON_WALL_MM / mmPerPt;
  pairs.forEach((pair, index) => {
    const centre = (pair.faces[0] + pair.faces[1]) / 2;
    for (const gap of pair.openings) {
      const widthMm = Math.round((gap.hi - gap.lo) * mmPerPt);
      const centrePoint = pair.horizontal ? [(gap.lo + gap.hi) / 2, centre] : [centre, (gap.lo + gap.hi) / 2];
      const hasDoor = doors.centres.some((c) => {
        const { along, across } = alongAndAcross(pair, c[0]!, c[1]!);
        return across <= onWallPt && (Math.abs(along - gap.lo) <= hingePt || Math.abs(along - gap.hi) <= hingePt);
      });
      const hasWindow = windows.some((w) => {
        if (w.pair !== index) return false;
        const { along } = alongAndAcross(pair, w.cx, w.cy);
        return along >= gap.lo - hingePt && along <= gap.hi + hingePt;
      });
      out.push({ pair: index, lo: gap.lo, hi: gap.hi, widthMm, kind: hasDoor ? "door" : hasWindow ? "window" : "unknown", centre: centrePoint });
    }
  });
  return out;
}

// Barriers across every opening on both faces, so a room fill stops at the
// wall line instead of pouring through the door into the next room.
export function openingBridges(pairs: WallPair[], openings: WallOpening[]): Segment[] {
  const bridges: Segment[] = [];
  for (const o of openings) {
    const pair = pairs[o.pair]!;
    for (const face of pair.faces) {
      const seg = pair.horizontal ? { x1: o.lo, y1: face, x2: o.hi, y2: face } : { x1: face, y1: o.lo, x2: face, y2: o.hi };
      bridges.push({ ...seg, len: o.hi - o.lo, width: 1, color: "#000000" });
    }
  }
  return bridges;
}

const LEAF_TOL = 0.15;
const LEAF_HINGE_MM = 120;

// The leaf line of a door starts at the hinge (the arc's centre) and is as
// long as the swing radius; counting leaves that match arcs is the second
// reading of the door count.
export function countDoorLeaves(segments: Segment[], doors: DoorArcs, mmPerPt: number): number {
  const hingePt = LEAF_HINGE_MM / mmPerPt;
  let matched = 0;
  doors.centres.forEach((c, i) => {
    const r = doors.radiiMm[i]! / mmPerPt;
    const hit = segments.some((s) => {
      if (Math.abs(s.len - r) > r * LEAF_TOL) return false;
      return Math.hypot(s.x1 - c[0]!, s.y1 - c[1]!) <= hingePt || Math.hypot(s.x2 - c[0]!, s.y2 - c[1]!) <= hingePt;
    });
    if (hit) matched++;
  });
  return matched;
}
