// Polygons that overlap, and polygons that fold over themselves.
//
// Two takeoff questions the shoelace formula cannot answer. "What is the floor
// area of these six rooms?" is not the sum of six areas when two of them share
// a wall thickness — the shared strip would be billed twice. "What is left of
// this slab once the lift core is taken out?" is a difference, not a
// subtraction of two independent figures. Both are polygon boolean operations,
// and getting them wrong overstates a bill.
//
// The third question is whether a drawn shape is a polygon at all: a bow-tie
// (a path that crosses itself) has no defensible area, because shoelace quietly
// nets the two lobes against each other and returns a number that looks fine.

import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Pair, Polygon } from "polygon-clipping";
import { BadRequestError } from "../../../lib/errors.ts";

/** A closed outline in sheet points. The closing point is implied, not required. */
export type VertexRing = [number, number][];

const MIN_RING_POINTS = 3;

/**
 * A vertex list as a polygon-clipping ring: a single outer ring, closed by
 * repeating its first point. Refuses anything that cannot enclose an area,
 * because a two-point "polygon" silently clips to nothing.
 */
function toRing(vertices: VertexRing): Pair[] {
  if (vertices.length < MIN_RING_POINTS) {
    throw new BadRequestError(`A polygon needs at least ${MIN_RING_POINTS} points`);
  }
  const ring: Pair[] = vertices.map((v) => {
    const [x, y] = v;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new BadRequestError("Every vertex needs a finite x and y");
    return [x, y] as Pair;
  });
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring;
}

/**
 * One closed outline and the voids inside it. This is the shape a merge actually
 * produces and the shape a bill can express: the outer ring is a measurement, each
 * hole is an opening taken out of it.
 */
export interface PolygonWithHoles {
  outer: VertexRing;
  holes: VertexRing[];
}

const openRing = (ring: readonly Pair[]): VertexRing => {
  const out: VertexRing = ring.map(([x, y]) => [x, y] as [number, number]);
  const last = out.length - 1;
  // polygon-clipping closes its rings; the rest of the module works with the
  // closing point implied, so drop it rather than measure the side twice.
  if (last > 0 && out[0]![0] === out[last]![0] && out[0]![1] === out[last]![1]) out.pop();
  return out;
};

/**
 * The library's result with its topology INTACT. `toRings` used to flatten outer
 * rings and holes into one list, which is why a donut could not be told from two
 * slabs and why the only safe thing left to do was refuse both. Ring 0 of each
 * polygon is its outer boundary; the rest are its voids.
 */
function toPolygons(result: MultiPolygon): PolygonWithHoles[] {
  return result
    .filter((polygon) => polygon.length > 0)
    .map((polygon) => ({
      outer: openRing(polygon[0]!),
      holes: polygon.slice(1).map(openRing),
    }))
    .filter((polygon) => polygon.outer.length >= MIN_RING_POINTS);
}

/** Flattens to plain rings. Only for callers that genuinely do not care which is which. */
function toRings(result: MultiPolygon): VertexRing[] {
  return toPolygons(result).flatMap((polygon) => [polygon.outer, ...polygon.holes]);
}

/**
 * The union of two or more closed polygons: overlapping rooms merge into one
 * outline, so the shared strip is measured once rather than twice.
 */
export function polygonUnion(polygons: VertexRing[]): VertexRing[] {
  if (polygons.length === 0) return [];
  const [head, ...rest] = polygons;
  const first: Polygon = [toRing(head!)];
  if (rest.length === 0) return toRings([first]);
  const others: Polygon[] = rest.map((p) => [toRing(p)]);
  return toRings(polygonClipping.union(first, ...others));
}

/**
 * The same union, keeping what the result actually IS: one entry per disjoint
 * outline, each with its own voids. Two slabs that overlap come back as one
 * outline; four bars around a courtyard come back as one outline with a hole;
 * two slabs that do not touch come back as two outlines — and nothing invents a
 * connecting edge between them.
 */
export function polygonUnionStructured(polygons: VertexRing[]): PolygonWithHoles[] {
  if (polygons.length === 0) return [];
  const [head, ...rest] = polygons;
  const first: Polygon = [toRing(head!)];
  if (rest.length === 0) return toPolygons([first]);
  return toPolygons(polygonClipping.union(first, ...rest.map((p): Polygon => [toRing(p)])));
}

/** Polygon A minus B, topology intact — what a polygon split and a cut-out both need. */
export function polygonDifferenceStructured(a: VertexRing, b: VertexRing): PolygonWithHoles[] {
  return toPolygons(polygonClipping.difference([toRing(a)], [toRing(b)]));
}

export function polygonIntersectionStructured(a: VertexRing, b: VertexRing): PolygonWithHoles[] {
  return toPolygons(polygonClipping.intersection([toRing(a)], [toRing(b)]));
}

/**
 * How much of `b` lies inside `a`, in raw sheet units.
 *
 * Ranking only — it answers "which of these outlines holds this cut", never
 * "what does this measure", so it is deliberately unscaled. Shared rather than
 * written twice because a merge and a deduction ask the identical question and
 * must not answer it differently.
 */
export function overlapArea(a: VertexRing, b: VertexRing): number {
  if (a.length < MIN_RING_POINTS || b.length < MIN_RING_POINTS) return 0;
  let total = 0;
  for (const piece of polygonIntersectionStructured(a, b)) {
    let doubled = 0;
    for (let i = 0; i < piece.outer.length; i++) {
      const [x1, y1] = piece.outer[i]!;
      const [x2, y2] = piece.outer[(i + 1) % piece.outer.length]!;
      doubled += x1 * y2 - x2 * y1;
    }
    total += Math.abs(doubled / 2);
  }
  return total;
}

/**
 * The two halves a straight cut makes of an outline.
 *
 * The cut is a segment, not a polygon, so it is extended well past the shape's
 * bounding box and swept sideways into two enormous half-plane rectangles; each
 * is intersected with the shape. Doing it this way means the library performs the
 * actual geometry — the alternative is hand-rolled edge-walking, which is exactly
 * the polygon boolean code plan contract 7 forbids writing.
 */
export function splitPolygonByCut(outline: VertexRing, from: Pair, to: Pair): PolygonWithHoles[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const span = Math.hypot(dx, dy);
  if (!(span > 0)) throw new BadRequestError("A cut line needs two different points");

  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const reach = (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + span) * 4 + 1;
  const ux = dx / span;
  const uy = dy / span;
  // along the cut, and perpendicular to it
  const ax = ux * reach;
  const ay = uy * reach;
  const px = -uy * reach;
  const py = ux * reach;
  const mid: Pair = [from[0] + dx / 2, from[1] + dy / 2];

  const halfPlane = (sign: number): VertexRing => [
    [mid[0] - ax, mid[1] - ay],
    [mid[0] + ax, mid[1] + ay],
    [mid[0] + ax + sign * px, mid[1] + ay + sign * py],
    [mid[0] - ax + sign * px, mid[1] - ay + sign * py],
  ];

  const pieces = [...polygonIntersectionStructured(outline, halfPlane(1)), ...polygonIntersectionStructured(outline, halfPlane(-1))];
  if (pieces.length < 2) {
    throw new BadRequestError("That cut line does not divide the shape; draw it right across the outline");
  }
  return pieces;
}

/** Polygon A with polygon B taken out of it. Empty when B swallows A whole. */
export function polygonDifference(a: VertexRing, b: VertexRing): VertexRing[] {
  return toRings(polygonClipping.difference([toRing(a)], [toRing(b)]));
}

/** The overlap of A and B — what two measurements would otherwise double-count. */
export function polygonIntersection(a: VertexRing, b: VertexRing): VertexRing[] {
  return toRings(polygonClipping.intersection([toRing(a)], [toRing(b)]));
}

// ---------- self-intersection ----------

/** True when the two open segments cross at a point interior to both. */
function segmentsCross(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): boolean {
  const d1x = p2[0] - p1[0];
  const d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  // parallel or collinear: a bow-tie needs a genuine crossing, not a touch
  if (Math.abs(denom) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

/**
 * Does the closed outline cross itself? A bow-tie has no area a QS can defend:
 * shoelace nets its two lobes against each other, so a badly-drawn slab can
 * measure a plausible figure — or zero — instead of being refused.
 */
export function isSelfIntersecting(vertices: number[][]): boolean {
  const pts: [number, number][] = [];
  for (const v of vertices) {
    const x = v[0];
    const y = v[1];
    if (typeof x !== "number" || typeof y !== "number") return false;
    const previous = pts[pts.length - 1];
    // a repeated point is a degenerate side, not a crossing; it is caught elsewhere
    if (previous && previous[0] === x && previous[1] === y) continue;
    pts.push([x, y]);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last && pts.length > 1 && first[0] === last[0] && first[1] === last[1]) pts.pop();
  const n = pts.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // adjacent sides share an endpoint by construction, including the wrap
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(pts[i]!, pts[(i + 1) % n]!, pts[j]!, pts[(j + 1) % n]!)) return true;
    }
  }
  return false;
}
