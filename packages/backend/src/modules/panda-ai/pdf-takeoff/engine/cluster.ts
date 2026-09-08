import type { DrawingRegion, ExtractedSheet, Segment } from "../types.ts";

const CELL_PT_COARSE = 50;
const CELL_PT_FILTERED = 20;
// with a known scale the cell is a metre: a door or window gap (0.9–1.2 m)
// then always lands in adjacent cells and cannot cut a plan in two
const CELL_M_FILTERED = 1.0;
const MIN_WALL_SEG_M = 0.3;
const MIN_REGION_SEGMENTS = 30;

// A sheet often holds several drawings (repeated floor plans, details).
// Group segments into regions via connected occupancy on a coarse grid so a
// measurement never spans two drawings.
//
// When mmPerPt is known, first drop sub-0.30m segments (glyph strokes, hatch,
// dim ticks, arrowheads — ~68% of a dense residential sheet). These bridge the
// whole sheet into one region and swamp the ~2% that are real walls; removing
// them lets the building envelope separate from title block and notes. Filter
// only removes and the tighter grid only separates, so a building is never split.
//
// Every segment is rasterised along its whole length: a 6 m wall face on an
// A0 sheet spans nine cells, and stamping only its ends would cut the plan
// into fragments smaller than the noise floor.
export function clusterRegions(sheet: ExtractedSheet, mmPerPt?: number): DrawingRegion[] {
  const { segments } = sheet;
  if (segments.length === 0) return [];

  let cellPt = CELL_PT_COARSE;
  // a sheet border runs most of the way across the page; it encloses every
  // drawing and would join them all into one region
  const frame = frameSegments(segments);
  let indexed = segments.map((s, idx) => ({ s, idx })).filter(({ idx }) => !frame.has(idx));
  if (mmPerPt) {
    const minLenPt = (MIN_WALL_SEG_M * 1000) / mmPerPt;
    const kept = indexed.filter(({ s }) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= minLenPt);
    if (kept.length >= MIN_REGION_SEGMENTS) {
      indexed = kept;
      cellPt = Math.max(CELL_PT_FILTERED, (CELL_M_FILTERED * 1000) / mmPerPt);
    }
  }

  const cellSegments = new Map<string, number[]>();
  const stamp = (x: number, y: number, idx: number) => {
    const key = `${Math.floor(x / cellPt)}:${Math.floor(y / cellPt)}`;
    const list = cellSegments.get(key);
    if (list) {
      if (list[list.length - 1] !== idx) list.push(idx);
    } else cellSegments.set(key, [idx]);
  };
  indexed.forEach(({ s, idx }) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / (cellPt / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stamp(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t, idx);
    }
  });

  const visited = new Set<string>();
  const regions: DrawingRegion[] = [];
  let regionId = 0;

  for (const start of cellSegments.keys()) {
    if (visited.has(start)) continue;
    const cells: string[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const cell = stack.pop()!;
      cells.push(cell);
      const [cx, cy] = cell.split(":").map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const next = `${cx! + dx}:${cy! + dy}`;
          if (!visited.has(next) && cellSegments.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        }
      }
    }
    const segmentIdx = [...new Set(cells.flatMap((c) => cellSegments.get(c) ?? []))];
    if (segmentIdx.length < MIN_REGION_SEGMENTS) continue; // noise: title block fragments, north arrows
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const idx of segmentIdx) {
      const s = segments[idx]!;
      minX = Math.min(minX, s.x1, s.x2);
      maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxY = Math.max(maxY, s.y1, s.y2);
    }
    regions.push({ id: regionId++, minX, minY, maxX, maxY, kind: "unknown", segmentIdx });
  }
  return mergeNested(regions.sort((a, b) => b.segmentIdx.length - a.segmentIdx.length));
}

const FRAME_SHARE = 0.6;
const CORNER_TOL_PT = 2;

// A border is a rectangle of four lines that each run at least 60 % of the
// sheet's drawn extent and meet at their corners. A wall face never spans
// the sheet like that; a dimension line may, but it meets nothing.
export function frameSegments(segments: Segment[]): Set<number> {
  const out = new Set<number>();
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
  const wide = (maxX - minX) * FRAME_SHARE;
  const tall = (maxY - minY) * FRAME_SHARE;
  const horizontals: number[] = [];
  const verticals: number[] = [];
  segments.forEach((s, i) => {
    if (Math.abs(s.y1 - s.y2) < CORNER_TOL_PT && s.len >= wide) horizontals.push(i);
    else if (Math.abs(s.x1 - s.x2) < CORNER_TOL_PT && s.len >= tall) verticals.push(i);
  });
  if (horizontals.length > 40 || verticals.length > 40) return out;
  const meets = (a: Segment, b: Segment) =>
    [[a.x1, a.y1], [a.x2, a.y2]].some(([x, y]) => [[b.x1, b.y1], [b.x2, b.y2]].some(([bx, by]) => Math.abs(x! - bx!) <= CORNER_TOL_PT && Math.abs(y! - by!) <= CORNER_TOL_PT));
  for (const h1 of horizontals) {
    for (const h2 of horizontals) {
      if (h2 <= h1) continue;
      for (const v1 of verticals) {
        for (const v2 of verticals) {
          if (v2 <= v1) continue;
          const [a, b, c, d] = [segments[h1]!, segments[h2]!, segments[v1]!, segments[v2]!];
          if (meets(a, c) && meets(a, d) && meets(b, c) && meets(b, d)) for (const i of [h1, h2, v1, v2]) out.add(i);
        }
      }
    }
  }
  return out;
}

// A cluster whose extent lies inside another's is part of that drawing — an
// inner block of partition walls cut off by door gaps on every side, never a
// second drawing, which would sit beside the first.
function mergeNested(regions: DrawingRegion[]): DrawingRegion[] {
  const out: DrawingRegion[] = [];
  for (const r of regions) {
    const host = out.find((o) => r.minX >= o.minX && r.maxX <= o.maxX && r.minY >= o.minY && r.maxY <= o.maxY);
    if (host) host.segmentIdx.push(...r.segmentIdx);
    else out.push(r);
  }
  return out.map((r, id) => ({ ...r, id }));
}

export function segmentsInRegion(segments: Segment[], region: DrawingRegion): Segment[] {
  return region.segmentIdx.map((i) => segments[i]!);
}

// Everything drawn inside the region's extent, including the short strokes
// clustering ignored: column outlines, window frames and jambs are all shorter
// than the 0.30 m noise floor yet are exactly what element detection reads.
export function segmentsWithin(segments: Segment[], region: DrawingRegion, marginPt = 0): Segment[] {
  const minX = region.minX - marginPt;
  const minY = region.minY - marginPt;
  const maxX = region.maxX + marginPt;
  const maxY = region.maxY + marginPt;
  const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  return segments.filter((s) => inside(s.x1, s.y1) && inside(s.x2, s.y2));
}
