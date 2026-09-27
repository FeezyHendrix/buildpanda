import type { DwgDoc, DwgEntity } from "./dwg.ts";
import type { RegisterSheet, UnitsDecision } from "./types.ts";

// What a roof plan draws: an outline, and inside it the lines where the slopes
// meet. A ridge runs along the roof, a hip runs out to a corner, a valley runs
// into one. Which of those are present is what makes a roof flat, gabled or
// hipped, and each is its own item in the bill.

export type RoofType = "flat" | "gable" | "hipped" | "pitched";

export interface RoofLine {
  a: number[];
  b: number[];
  lengthM: number;
}

export interface RoofShape {
  type: RoofType;
  outline: number[][];
  areaM2: number;
  perimeterM: number;
  ridges: RoofLine[];
  hips: RoofLine[];
  valleys: RoofLine[];
  /** Shared panel edges that run eaves to eaves: where two roof blocks abut. */
  divisions: RoofLine[];
  /** Degrees from the horizontal, when the drawing states it. */
  pitchDeg: number | null;
  reason: string;
}

const CORNER_TOLERANCE_MM = 500;
const AXIS_TOLERANCE_DEG = 8;
const PITCH = /(\d{1,2}(?:\.\d)?)\s*(?:°|deg\b|degrees\b)|\bpitch\D{0,12}(\d{1,2})\s*(?:°|deg)?|\b1\s*[:/]\s*(\d{1,2})\b/i;

const toDeg = (rad: number): number => (rad * 180) / Math.PI;

function angleOf(a: number[], b: number[]): number {
  const deg = toDeg(Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!));
  const wrapped = ((deg % 180) + 180) % 180;
  return wrapped;
}

function nearAxis(deg: number): boolean {
  return deg <= AXIS_TOLERANCE_DEG || deg >= 180 - AXIS_TOLERANCE_DEG || Math.abs(deg - 90) <= AXIS_TOLERANCE_DEG;
}

function distance(a: number[], b: number[]): number {
  return Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
}

/** The pitch stated anywhere on the sheet: "30°", "PITCH 25", or a 1:3 fall. */
export function pitchFromLabels(labels: string[]): number | null {
  for (const label of labels) {
    const m = label.match(PITCH);
    if (!m) continue;
    if (m[1]) return Number(m[1]);
    if (m[2]) return Number(m[2]);
    if (m[3]) {
      const run = Number(m[3]);
      if (run > 0) return Math.round(toDeg(Math.atan(1 / run)) * 10) / 10;
    }
  }
  return null;
}

function touchesCorner(point: number[], corners: number[][], tolerance: number): boolean {
  return corners.some((c) => distance(point, c) <= tolerance);
}

/**
 * Sort the lines drawn inside the outline into ridges, hips and valleys, then
 * name the roof from what is there. A hip reaches a corner of the outline; a
 * ridge runs along an axis without reaching one; anything else is a valley.
 */
export function classifyRoof(
  outline: number[][],
  lines: RoofLine[],
  scaleToMm: number,
  labels: string[],
  sorted?: { ridges: RoofLine[]; hips: RoofLine[]; valleys: RoofLine[]; divisions: RoofLine[] },
): RoofShape {
  const toM = scaleToMm / 1000;
  const tolerance = CORNER_TOLERANCE_MM / scaleToMm;
  const ridges: RoofLine[] = sorted ? sorted.ridges : [];
  const hips: RoofLine[] = sorted ? sorted.hips : [];
  const valleys: RoofLine[] = sorted ? sorted.valleys : [];
  const divisions: RoofLine[] = sorted ? sorted.divisions : [];
  for (const line of sorted ? [] : lines) {
    const deg = angleOf(line.a, line.b);
    const atCorner = touchesCorner(line.a, outline, tolerance) || touchesCorner(line.b, outline, tolerance);
    if (atCorner && !nearAxis(deg)) hips.push(line);
    else if (nearAxis(deg)) ridges.push(line);
    else valleys.push(line);
  }
  let type: RoofType;
  let reason: string;
  if (!lines.length) {
    type = "flat";
    reason = "nothing is drawn inside the outline, so the roof reads as flat";
  } else if (hips.length >= 2 && (ridges.length || divisions.length)) {
    type = "hipped";
    reason = `${hips.length} hips run out to the corners from ${ridges.length === 1 ? "a ridge" : `${ridges.length} ridges`}`;
  } else if (hips.length >= 2) {
    type = "hipped";
    reason = `${hips.length} hips meet at a point: a pyramid roof`;
  } else if (ridges.length || divisions.length) {
    type = "gable";
    reason = `a ridge with no hips: the ends are gables`;
  } else {
    type = "pitched";
    reason = "lines inside the outline, but not a shape this reads as flat, gabled or hipped";
  }
  let area = 0;
  let perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i]!;
    const [x2, y2] = outline[(i + 1) % outline.length]!;
    area += x1! * y2! - x2! * y1!;
    perimeter += Math.hypot(x2! - x1!, y2! - y1!);
  }
  return {
    type,
    outline,
    areaM2: Math.round(Math.abs(area / 2) * toM * toM * 100) / 100,
    perimeterM: Math.round(perimeter * toM * 100) / 100,
    ridges,
    hips,
    valleys,
    divisions,
    pitchDeg: pitchFromLabels(labels),
    reason,
  };
}

/**
 * The roof's own lines inside its outline. A roof plan also carries the walls
 * below it, the grid and the dimensions; those say nothing about the slopes,
 * so only lines the layer map calls roof are read (or, on a drawing with no
 * roof layer, the unmapped ones).
 */
export function linesInside(
  doc: DwgDoc,
  sheet: RegisterSheet,
  outline: number[][],
  units: UnitsDecision,
  isRoofLine: (e: DwgEntity) => boolean = () => true,
): RoofLine[] {
  const xs = outline.map((p) => p[0]!);
  const ys = outline.map((p) => p[1]!);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 200 / units.scaleToMm;
  const inside = (p: number[]) => p[0]! >= minX - pad && p[0]! <= maxX + pad && p[1]! >= minY - pad && p[1]! <= maxY + pad;
  const out: RoofLine[] = [];
  const push = (a: number[], b: number[]) => {
    if (!inside(a) || !inside(b)) return;
    const lengthM = (distance(a, b) * units.scaleToMm) / 1000;
    if (lengthM >= 0.5) out.push({ a, b, lengthM: Math.round(lengthM * 100) / 100 });
  };
  for (const index of sheet.members) {
    const e = doc.entities[index] as DwgEntity | undefined;
    if (!e) continue;
    if (!isRoofLine(e)) continue;
    if (e.entity === "LINE" && e.start && e.end) push([e.start[0]!, e.start[1]!], [e.end[0]!, e.end[1]!]);
    // a ridge, hip or valley is drawn as a line; a closed polyline inside the
    // roof is another outline (the wall below the overhang, a rooflight, plant)
    if ((e.entity === "LWPOLYLINE" || e.entity === "POLYLINE_2D") && e.points && e.points.length >= 2 && ((e.flag ?? 0) & 512) === 0) {
      for (let k = 1; k < e.points.length; k++) push([e.points[k - 1]![0]!, e.points[k - 1]![1]!], [e.points[k]![0]!, e.points[k]![1]!]);
    }
  }
  return out;
}
