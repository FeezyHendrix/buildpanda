// Picking among STACKED shapes: every geometry under the click, in a stable
// order, so repeated clicks cycle instead of always selecting the topmost.
import type { PreconGeometry } from "@/api/precon";

const pointInPolygon = (pt: [number, number], vs: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = [vs[i]![0]!, vs[i]![1]!];
    const [xj, yj] = [vs[j]![0]!, vs[j]![1]!];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const distToSegment = (p: [number, number], a: number[], b: number[]): number => {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]!) * dx + (p[1] - a[1]!) * dy) / len2));
  return Math.hypot(p[0] - (a[0]! + t * dx), p[1] - (a[1]! + t * dy));
};

const nearPolyline = (pt: [number, number], vs: number[][], tol: number): boolean => {
  for (let i = 0; i < vs.length - 1; i += 1) if (distToSegment(pt, vs[i]!, vs[i + 1]!) <= tol) return true;
  return false;
};

/** Every measuring geometry under `pt`, areas by containment, runs/counts by proximity. */
export function stackedHitsAt(pt: [number, number], geometries: PreconGeometry[], tolPt: number): PreconGeometry[] {
  return geometries.filter((g) => {
    if (g.kind === "deduction" || g.vertices.length === 0) return false;
    if (g.kind === "area") return pointInPolygon(pt, g.vertices) || nearPolyline(pt, [...g.vertices, g.vertices[0]!], tolPt);
    if (g.kind === "count") return g.vertices.some((v) => Math.hypot(pt[0] - v[0]!, pt[1] - v[1]!) <= tolPt);
    return nearPolyline(pt, g.vertices, tolPt);
  });
}

export interface StackCycle {
  /** The click position the cycle is anchored to (a new spot restarts it). */
  anchor: [number, number];
  ids: string[];
  index: number;
}

/**
 * The next pick at `pt`: the same spot advances the cycle, a fresh spot (or a
 * changed stack) starts at the top. Returns null when nothing is under the click.
 */
export function nextInStack(
  cycle: StackCycle | null,
  pt: [number, number],
  hits: PreconGeometry[],
  tolPt: number,
): { pick: PreconGeometry; cycle: StackCycle } | null {
  if (hits.length === 0) return null;
  const ids = hits.map((g) => g.id);
  const samePlace = cycle !== null && Math.hypot(pt[0] - cycle.anchor[0], pt[1] - cycle.anchor[1]) <= tolPt;
  const sameStack = cycle !== null && JSON.stringify(cycle.ids) === JSON.stringify(ids);
  const index = samePlace && sameStack ? (cycle.index + 1) % ids.length : 0;
  return { pick: hits[index]!, cycle: { anchor: samePlace && cycle ? cycle.anchor : pt, ids, index } };
}
