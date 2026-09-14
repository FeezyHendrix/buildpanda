import type { WallLineSummary } from "./walls.ts";

// A measured wall is two parallel faces. The bill line quantifies the pair
// once; the drawing wants the run drawn once too, so the two face lines are
// paired back up and the shape is the centreline between them — the line a
// quantity surveyor would scale off, in the drawing's own coordinates.

export interface WallRunShape {
  thicknessMm: number;
  // [start, end] on the run's centreline, in drawing units
  vertices: number[][];
}

// the two faces of one wall sit a thickness apart; the recorded thickness is
// rounded to 25 mm, so the measured gap may miss it by half a step
const GAP_TOLERANCE_MM = 25;
const PARALLEL = 0.005;

/** The point at `along` on the line through `offset` with direction `dir`. */
function pointOn(dir: [number, number], offset: number, along: number): number[] {
  const [dx, dy] = dir;
  return [along * dx - offset * dy, along * dy + offset * dx];
}

/**
 * Pair the face lines of `measure.lines` into wall runs and return each run's
 * centreline. Faces pair when they share a direction and a thickness, sit a
 * thickness apart across the wall, and overlap along it; the longest overlap
 * wins, so a face flanked by two others joins the one it really belongs to.
 * A face with no partner left is a wall drawn against something already
 * paired and contributes no shape — its length is already in the line.
 */
export function wallCentrelines(lines: WallLineSummary[], scaleToMm: number): WallRunShape[] {
  const out: WallRunShape[] = [];
  const used = new Array<boolean>(lines.length).fill(false);
  const overlaps = (a: WallLineSummary, b: WallLineSummary) => Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    const a = lines[i]!;
    let best = -1;
    let bestOverlap = 0;
    for (let j = i + 1; j < lines.length; j++) {
      if (used[j]) continue;
      const b = lines[j]!;
      if (b.thicknessMm !== a.thicknessMm) continue;
      if (Math.abs(a.dir[0] - b.dir[0]) > PARALLEL || Math.abs(a.dir[1] - b.dir[1]) > PARALLEL) continue;
      const gapMm = Math.abs(b.offset - a.offset) * scaleToMm;
      if (Math.abs(gapMm - a.thicknessMm) > GAP_TOLERANCE_MM) continue;
      const overlap = overlaps(a, b);
      if (overlap <= bestOverlap) continue;
      bestOverlap = overlap;
      best = j;
    }
    if (best < 0) continue;
    const b = lines[best]!;
    used[i] = true;
    used[best] = true;
    const centre = (a.offset + b.offset) / 2;
    const lo = Math.max(a.lo, b.lo);
    const hi = Math.min(a.hi, b.hi);
    out.push({ thicknessMm: a.thicknessMm, vertices: [pointOn(a.dir, centre, lo), pointOn(a.dir, centre, hi)] });
  }
  return out;
}
