import type { DrawingRegion, ExtractedSheet, Segment } from "../types.ts";

const CELL_PT_COARSE = 50;
const CELL_PT_FILTERED = 20;
const MIN_WALL_SEG_M = 0.3;

// A sheet often holds several drawings (repeated floor plans, details).
// Group segments into regions via connected occupancy on a coarse grid so a
// measurement never spans two drawings.
//
// When mmPerPt is known, first drop sub-0.30m segments (glyph strokes, hatch,
// dim ticks, arrowheads — ~68% of a dense residential sheet). These bridge the
// whole sheet into one region and swamp the ~2% that are real walls; removing
// them lets the building envelope separate from title block and notes. Filter
// only removes and the tighter grid only separates, so a building is never split.
export function clusterRegions(sheet: ExtractedSheet, mmPerPt?: number): DrawingRegion[] {
  const { segments } = sheet;
  if (segments.length === 0) return [];

  let cellPt = CELL_PT_COARSE;
  let indexed = segments.map((s, idx) => ({ s, idx }));
  if (mmPerPt) {
    const minLenPt = MIN_WALL_SEG_M * 1000 / mmPerPt;
    const kept = indexed.filter(({ s }) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= minLenPt);
    if (kept.length >= 30) {
      indexed = kept;
      cellPt = CELL_PT_FILTERED;
    }
  }

  const cellOf = (x: number, y: number) => `${Math.floor(x / cellPt)}:${Math.floor(y / cellPt)}`;
  const cellSegments = new Map<string, number[]>();
  indexed.forEach(({ s, idx }) => {
    // stamp both endpoints and the midpoint; enough for connectivity
    for (const [x, y] of [
      [s.x1, s.y1],
      [(s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2],
      [s.x2, s.y2],
    ]) {
      const key = cellOf(x!, y!);
      const list = cellSegments.get(key);
      if (list) list.push(idx);
      else cellSegments.set(key, [idx]);
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
    if (segmentIdx.length < 30) continue; // noise: title block fragments, north arrows
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
  return regions.sort((a, b) => b.segmentIdx.length - a.segmentIdx.length);
}

export function segmentsInRegion(segments: Segment[], region: DrawingRegion): Segment[] {
  return region.segmentIdx.map((i) => segments[i]!);
}
