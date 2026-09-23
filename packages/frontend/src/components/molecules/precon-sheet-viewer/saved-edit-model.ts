// Pure vertex arithmetic for editing a SAVED measurement's shape. No React,
// no imports, so `saved-edit-model.test.ts` runs under the plain node runner.
// The minimums are the tools' own: a line needs 2 points, a polygon 3, a count
// at least 1 marker — an edit that would break them is refused (returns null)
// and the caller blocks only that action, never the geometry.

export type SavedKind = "linear" | "area" | "count" | "deduction";

export const SAVED_MIN_VERTICES: Record<SavedKind, number> = {
  linear: 2,
  area: 3,
  count: 1,
  deduction: 3,
};

/** Null when removing would break the kind's minimum or the index is out of range. */
export function removeVertex(kind: SavedKind, vertices: readonly number[][], index: number): number[][] | null {
  if (index < 0 || index >= vertices.length) return null;
  if (vertices.length - 1 < SAVED_MIN_VERTICES[kind]) return null;
  return vertices.filter((_, i) => i !== index);
}

/** Insert `pt` after vertex `segmentIndex` — on the segment it starts. */
export function insertVertexAfter(vertices: readonly number[][], segmentIndex: number, pt: number[]): number[][] {
  const next = vertices.map((v) => [...v]);
  next.splice(segmentIndex + 1, 0, [pt[0]!, pt[1]!]);
  return next;
}

export function moveVertex(vertices: readonly number[][], index: number, pt: number[]): number[][] {
  return vertices.map((v, i) => (i === index ? [pt[0]!, pt[1]!] : [...v]));
}

export type RunEnd = "start" | "end";

/** Continue a run at either end: append after the last vertex or before the first. */
export function appendVertex(vertices: readonly number[][], pt: number[], end: RunEnd): number[][] {
  const copy = vertices.map((v) => [...v]);
  const next = [pt[0]!, pt[1]!];
  return end === "start" ? [next, ...copy] : [...copy, next];
}

/** The point `lengthPt` away from `anchor` at `angleDeg` (0° = +x, 90° = +y; sheet points, y up). */
export function extendedPoint(anchor: readonly number[], lengthPt: number, angleDeg: number): number[] {
  const rad = (angleDeg * Math.PI) / 180;
  return [anchor[0]! + lengthPt * Math.cos(rad), anchor[1]! + lengthPt * Math.sin(rad)];
}

/** Metres → sheet points through the sheet scale; null when the sheet has no scale. */
export function metersToPt(meters: number, mmPerPt: number | null): number | null {
  return mmPerPt && mmPerPt > 0 ? (meters * 1000) / mmPerPt : null;
}

/** Length (m) and angle (deg) of the run's LAST segment — the live rubber band. */
export function segmentReadout(vertices: readonly number[][], mmPerPt: number | null): { lengthM: number; angleDeg: number } | null {
  const b = vertices[vertices.length - 1];
  const a = vertices[vertices.length - 2];
  if (!a || !b || !mmPerPt || mmPerPt <= 0) return null;
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  return {
    lengthM: (Math.hypot(dx, dy) * mmPerPt) / 1000,
    angleDeg: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
  };
}

/** The midpoint of each segment, where an insert handle sits. */
export function segmentMidpoints(vertices: readonly number[][], closed: boolean): number[][] {
  const mids: number[][] = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    mids.push([(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2]);
  }
  return mids;
}
