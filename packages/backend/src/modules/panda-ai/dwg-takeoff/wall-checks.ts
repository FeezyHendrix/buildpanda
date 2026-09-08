import { isModelSpace, type DwgDoc } from "./dwg.ts";
import { openingAreaM2, thicknessModes, type HeightDecision, type Openings, type WallLineSummary, type WallMeasure } from "./walls.ts";
import type { MeasuredItem, RegisterSheet, UnitsDecision, WallSummary } from "./types.ts";

// Walls are the line the estimator prices first, so every sheet carries a
// summary of what was measured and two independent checks on the length:
// the dimension strings the architect ran along the external walls, and
// the perimeters of the rooms the fill enclosed.

export interface RoomPerimeters {
  totalM: number;
  rooms: number;
  unmeasured: number;
}

const DIMENSION_REACH_MM = 3000;
const AGREE = 0.03;

export function wallSummary(measure: WallMeasure, height: HeightDecision, openings: Openings, sheet: RegisterSheet, units: UnitsDecision): WallSummary {
  const modes = thicknessModes(measure).map((m) => ({ thicknessMm: m.thicknessMm, lengthM: Math.round(m.lengthM * 100) / 100 }));
  return {
    sheetId: sheet.id,
    code: sheet.code,
    byThickness: modes,
    totalLengthM: Math.round(modes.reduce((s, m) => s + m.lengthM, 0) * 100) / 100,
    runs: measure.lines.filter((l) => l.extentUnits > 0).length,
    openings: { doors: openings.doors, windows: openings.windows, areaM2: Math.round(openingAreaM2(openings) * 100) / 100 },
    height: { mm: height.mm, basis: height.basis, assumed: height.assumed },
    bridgedM: Math.round(measure.bridgedM * 100) / 100,
    unpairedM: Math.round(measure.unpairedM * 100) / 100,
    units: units.unit,
    checks: { dimensions: "", roomPerimeters: "" },
  };
}

export function summarySentence(s: WallSummary): string {
  const modes = s.byThickness.map((m) => `${m.thicknessMm} mm ${m.lengthM} m`).join(", ");
  return `Sheet walls: ${modes} (${s.totalLengthM} m in ${s.runs} runs); ${s.openings.doors + s.openings.windows} openings deducted (${s.openings.areaM2} m²); height ${s.height.mm / 1000} m (${s.height.basis})`;
}

/**
 * The outermost wall line in each direction is an external wall. The
 * dimension strings whose extension points run along it (overall and bay
 * dimensions alike, merged so they are not summed twice) should cover its
 * paired length.
 */
export function dimensionCheck(doc: DwgDoc, sheet: RegisterSheet, measure: WallMeasure, units: UnitsDecision): string {
  const external = externalLines(measure, units.scaleToMm);
  if (!external.length) return "no wall lines to check against dimensions";
  const reach = DIMENSION_REACH_MM / units.scaleToMm;
  const pad = 4000 / units.scaleToMm;
  const dims = doc.entities.filter((e) => {
    if (!String(e.entity ?? "").startsWith("DIMENSION") || !isModelSpace(doc, e)) return false;
    if (!e.xline1_pt || !e.xline2_pt || typeof e.act_measurement !== "number" || e.act_measurement <= 0) return false;
    return [e.xline1_pt, e.xline2_pt].every((p) => p[0]! >= sheet.bounds.minX - pad && p[0]! <= sheet.bounds.maxX + pad && p[1]! >= sheet.bounds.minY - pad && p[1]! <= sheet.bounds.maxY + pad);
  });
  let covered = 0;
  let paired = 0;
  let wallsWithDims = 0;
  for (const line of external) {
    const [dx, dy] = line.dir;
    const along = (x: number, y: number) => x * dx + y * dy;
    const across = (x: number, y: number) => x * -dy + y * dx;
    const intervals: Array<[number, number]> = [];
    for (const d of dims) {
      const [p, q] = [d.xline1_pt!, d.xline2_pt!];
      const len = Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!);
      if (len <= 0) continue;
      const ux = (q[0]! - p[0]!) / len;
      const uy = (q[1]! - p[1]!) / len;
      if (Math.abs(ux * dx + uy * dy) < 0.995) continue;
      if (Math.abs(across(p[0]!, p[1]!) - line.offset) > reach || Math.abs(across(q[0]!, q[1]!) - line.offset) > reach) continue;
      const a = along(p[0]!, p[1]!);
      const b = along(q[0]!, q[1]!);
      // only the part of the string that runs beside this wall counts
      const lo = Math.max(line.lo, Math.min(a, b));
      const hi = Math.min(line.hi, Math.max(a, b));
      if (hi > lo) intervals.push([lo, hi]);
    }
    if (!intervals.length) continue;
    wallsWithDims++;
    covered += union(intervals);
    paired += line.extentUnits;
  }
  if (!wallsWithDims) return "no dimension strings run along the external walls";
  const toM = (u: number) => Math.round((u * units.scaleToMm) / 100) / 10;
  const diff = paired > 0 ? Math.abs(covered - paired) / paired : 1;
  return `dimensions along ${wallsWithDims} external wall${wallsWithDims > 1 ? "s" : ""} cover ${toM(covered)} m vs ${toM(paired)} m paired (${diff <= AGREE ? "agree" : `differ by ${Math.round(diff * 100)}%`})`;
}

/**
 * Every internal wall bounds two rooms and every external wall one, so the
 * room perimeters should sum to about twice the internal centreline plus
 * the external one. The thickest mode is taken as external.
 */
export function perimeterCheck(measure: WallMeasure, rooms: RoomPerimeters): string {
  if (rooms.rooms === 0) return "no rooms enclosed to check the walls against";
  const labelled = rooms.rooms + rooms.unmeasured;
  if (rooms.unmeasured / labelled > 0.25) return `room perimeters inconclusive: ${rooms.unmeasured} of ${labelled} labelled rooms were not enclosed`;
  const modes = thicknessModes(measure).sort((a, b) => b.thicknessMm - a.thicknessMm);
  const total = modes.reduce((s, m) => s + m.lengthM, 0);
  const coverage = rooms.unmeasured ? ` (${rooms.rooms} rooms; ${rooms.unmeasured} not enclosed)` : ` (${rooms.rooms} rooms)`;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  if (modes.length < 2) {
    const inside = rooms.totalM >= total * 0.9 && rooms.totalM <= total * 2.1;
    return `room perimeters sum to ${r1(rooms.totalM)} m${coverage}; one thickness, so ${r1(total)}–${r1(2 * total)} m expected (${inside ? "agree" : "disagree"})`;
  }
  const external = modes[0]!.lengthM;
  const implied = 2 * (total - external) + external;
  const diff = Math.abs(rooms.totalM - implied) / implied;
  // rooms that were not enclosed take their perimeter out of the sum
  const tolerance = 0.1 + rooms.unmeasured / labelled;
  return `room perimeters sum to ${r1(rooms.totalM)} m${coverage} vs ${r1(implied)} m implied by the paired walls (2 × internal + external): ${diff <= tolerance ? "agree" : `differ by ${Math.round(diff * 100)}%`}`;
}

/** Fold the checks into the wall lines: the summary on the basis, the checks on the cross-check. */
export function annotateWalls(items: MeasuredItem[], summary: WallSummary): void {
  const checks = [summary.checks.dimensions, summary.checks.roomPerimeters].filter(Boolean).join("; ");
  for (const item of items) {
    if (item.trade !== "walls" || item.sheetId !== summary.sheetId) continue;
    item.basis = `${item.basis}. ${summarySentence(summary)}`;
    item.crossCheck = [item.crossCheck, checks].filter(Boolean).join("; ");
    // the dimension strings are an independent measure of the length: they
    // confirm the line or send it to review
    if (summary.checks.dimensions.includes("differ")) {
      item.confidence = "low";
      item.reason = "dimension strings disagree with the paired length";
    } else if (summary.checks.dimensions.includes("agree") && item.confidence === "medium" && !summary.height.assumed) {
      item.confidence = "high";
      item.reason = "dimension strings confirm the paired length";
    }
  }
}

/**
 * The outermost long line in each direction. A balcony edge or a nib at the
 * outside does not count: the line must run at least half as far as the
 * longest line in its direction.
 */
function externalLines(measure: WallMeasure, scaleToMm: number): WallLineSummary[] {
  const minExtent = 2000 / scaleToMm;
  const byDir = new Map<number, WallLineSummary[]>();
  for (const line of measure.lines) {
    if (line.extentUnits < minExtent) continue;
    // lines within 5° share a direction
    const key = Math.round((Math.atan2(line.dir[1], line.dir[0]) * 180) / Math.PI / 5);
    byDir.set(key, [...(byDir.get(key) ?? []), line]);
  }
  const out: WallLineSummary[] = [];
  for (const lines of byDir.values()) {
    const longest = Math.max(...lines.map((l) => l.extentUnits));
    const sorted = lines.filter((l) => l.extentUnits >= longest / 2).sort((a, b) => a.offset - b.offset);
    out.push(sorted[0]!);
    if (sorted.length > 1) out.push(sorted[sorted.length - 1]!);
  }
  return out;
}

function union(ivs: Array<[number, number]>): number {
  const sorted = [...ivs].sort((p, q) => p[0] - q[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [lo, hi] of sorted) {
    if (cur && lo <= cur[1]) cur[1] = Math.max(cur[1], hi);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [lo, hi];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}
