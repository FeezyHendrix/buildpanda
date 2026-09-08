import { handleOf, type DwgDoc } from "./dwg.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerElement, LayerMap, MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// Walls are measured from their own geometry: thickness from the gap between
// paired faces, length from the paired runs, height from the level marks.
// Nothing here is assumed unless the drawing gives no alternative, and then
// the basis says "assumed".

export interface WallSegment {
  handle: number | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number; // drawing units
}

/** Straight segments of every entity mapped to the given elements (walls by default). */
export function wallSegments(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap, elements: LayerElement[] = ["walls"]): WallSegment[] {
  const out: WallSegment[] = [];
  for (const i of sheet.members) {
    const e = doc.entities[i]!;
    if (!elements.includes(elementOf(doc, e, map))) continue;
    const h = handleOf(e);
    if (e.entity === "LINE" && e.start && e.end) {
      out.push(seg(h, e.start, e.end));
    } else if ((e.entity === "LWPOLYLINE" || e.entity === "POLYLINE_2D") && e.points && e.points.length >= 2) {
      const pts = e.points;
      for (let k = 1; k < pts.length; k++) out.push(seg(h, pts[k - 1]!, pts[k]!));
      // the closing edge of a closed outline is a wall face too
      if (((e.flag ?? 0) & 512) !== 0) out.push(seg(h, pts[pts.length - 1]!, pts[0]!));
    } else if (e.entity === "ARC" && e.center && e.radius !== undefined && e.start_angle !== undefined && e.end_angle !== undefined) {
      // a door swing as eight chords: enough to seal the opening in a room mask
      let sweep = e.end_angle - e.start_angle;
      if (sweep < 0) sweep += Math.PI * 2;
      let prev = [e.center[0]! + e.radius * Math.cos(e.start_angle), e.center[1]! + e.radius * Math.sin(e.start_angle)];
      for (let k = 1; k <= 8; k++) {
        const a = e.start_angle + (sweep * k) / 8;
        const next = [e.center[0]! + e.radius * Math.cos(a), e.center[1]! + e.radius * Math.sin(a)];
        out.push(seg(h, prev, next));
        prev = next;
      }
    }
  }
  return out.filter((s) => s.len > 0);
}

const seg = (handle: number | null, a: number[], b: number[]): WallSegment => ({
  handle,
  x1: a[0]!,
  y1: a[1]!,
  x2: b[0]!,
  y2: b[1]!,
  len: Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!),
});

export interface WallMeasure {
  // thickness mode in mm → centreline length in m and the handles behind it
  byThickness: Map<number, { lengthM: number; evidence: Set<number> }>;
  pairedM: number;
  unpairedM: number;
}

/**
 * Pair each wall face with a parallel face 80–400 mm away that overlaps it;
 * the gap is the wall thickness and the overlap is wall length. Faces with
 * no partner are single-line walls or stray lines and are reported, not
 * measured as walls.
 */
export function measureWallRuns(segments: WallSegment[], scaleToMm: number): WallMeasure {
  const byThickness = new Map<number, { lengthM: number; evidence: Set<number> }>();
  let pairedUnits = 0;
  let unpairedUnits = 0;
  const minGap = 80 / scaleToMm;
  const maxGap = 400 / scaleToMm;
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!;
    const ax = (a.x2 - a.x1) / a.len;
    const ay = (a.y2 - a.y1) / a.len;
    // candidate partners grouped by thickness (to 25 mm: block sizes are 100,
    // 150, 225, 230, 300); the other face of a wall may be split at doors, so
    // the overlaps at one gap add up
    const byGap = new Map<number, number>();
    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const b = segments[j]!;
      const bx = (b.x2 - b.x1) / b.len;
      const by = (b.y2 - b.y1) / b.len;
      if (Math.abs(ax * bx + ay * by) < 0.995) continue; // not parallel
      // perpendicular distance from a's line to b's midpoint
      const mx = (b.x1 + b.x2) / 2 - a.x1;
      const my = (b.y1 + b.y2) / 2 - a.y1;
      const gap = Math.abs(mx * -ay + my * ax);
      if (gap < minGap || gap > maxGap) continue;
      // overlap along a's direction
      const t1 = (b.x1 - a.x1) * ax + (b.y1 - a.y1) * ay;
      const t2 = (b.x2 - a.x1) * ax + (b.y2 - a.y1) * ay;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(a.len, Math.max(t1, t2));
      const overlap = hi - lo;
      // the other face of a wall runs alongside most of this one; a window
      // frame or a skirting line crossing it briefly does not
      if (overlap < 0.5 * Math.min(a.len, b.len)) continue;
      const thicknessMm = Math.round((gap * scaleToMm) / 25) * 25;
      byGap.set(thicknessMm, Math.min(a.len, (byGap.get(thicknessMm) ?? 0) + overlap));
    }
    // the wall's own other face is the gap with the most face alongside
    const best = [...byGap.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0];
    if (!best) {
      unpairedUnits += a.len;
      continue;
    }
    const [thicknessMm, overlap] = best;
    const entry = byThickness.get(thicknessMm) ?? { lengthM: 0, evidence: new Set<number>() };
    // each face contributes half its overlap: the pair together is one wall
    entry.lengthM += (overlap * scaleToMm) / 1000 / 2;
    if (a.handle !== null) entry.evidence.add(a.handle);
    byThickness.set(thicknessMm, entry);
    pairedUnits += overlap;
  }
  return { byThickness, pairedM: (pairedUnits * scaleToMm) / 1000 / 2, unpairedM: (unpairedUnits * scaleToMm) / 1000 };
}

export interface HeightDecision {
  mm: number;
  basis: string;
  assumed: boolean;
}

/** Storey height from consecutive floor level marks, else assumed. */
export function storeyHeight(sheets: RegisterSheet[]): HeightDecision {
  const levels = [...new Set(sheets.filter((s) => s.kind === "floor-plan" && s.levelMm !== null).map((s) => s.levelMm!))].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < levels.length; i++) diffs.push(levels[i]! - levels[i - 1]!);
  const plausible = diffs.filter((d) => d >= 2400 && d <= 6000).sort((a, b) => a - b);
  if (plausible.length) {
    const mm = plausible[plausible.length >> 1]!;
    return { mm, basis: `floor-to-floor from level marks ${levels.map((l) => `+${l}`).join(", ")}`, assumed: false };
  }
  return { mm: 2700, basis: "2.7 m assumed; no floor level marks found", assumed: true };
}

export interface Openings {
  doors: number;
  doorWidthMm: number | null;
  windows: number;
  windowAreaM2: number | null;
}

export function wallItems(
  measure: WallMeasure,
  height: HeightDecision,
  openings: Openings,
  sheet: RegisterSheet,
  units: UnitsDecision,
): MeasuredItem[] {
  const items: MeasuredItem[] = [];
  const modes = [...measure.byThickness.entries()].sort((a, b) => b[1].lengthM - a[1].lengthM);
  const totalLen = modes.reduce((s, [, m]) => s + m.lengthM, 0);
  if (totalLen <= 0) return items;
  // a thickness that carries under 5 % of the wall length is pairing noise
  // (a nib, a pier, a frame); fold it into the nearest real thickness
  const major = modes.filter(([, m]) => m.lengthM / totalLen >= 0.05);
  for (const [t, m] of modes) {
    if (major.some(([mt]) => mt === t) || !major.length) continue;
    const nearest = major.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a));
    nearest[1].lengthM += m.lengthM;
    for (const h of m.evidence) nearest[1].evidence.add(h);
  }
  modes.length = 0;
  modes.push(...(major.length ? major : [...measure.byThickness.entries()]).sort((a, b) => b[1].lengthM - a[1].lengthM));
  const heightM = height.mm / 1000;
  const doorArea = openings.doors * ((openings.doorWidthMm ?? 900) / 1000) * 2.1;
  const windowArea = openings.windows * (openings.windowAreaM2 ?? 1.44);
  // openings come out of the dominant thickness, where doors and windows live
  modes.forEach(([thicknessMm, m], idx) => {
    if (m.lengthM < 1) return;
    const gross = Math.round(m.lengthM * heightM * 100) / 100;
    const deduct = idx === 0 ? Math.min(gross * 0.6, Math.round((doorArea + windowArea) * 100) / 100) : 0;
    const net = Math.round((gross - deduct) * 100) / 100;
    const scaleNote = units.errorPct > 0 ? ` ±${Math.round(units.errorPct * 100)}% scale error` : "";
    items.push({
      trade: "walls",
      description: `Sandcrete block wall in cement mortar (1:6); ${thicknessMm}mm thick`,
      quantity: net,
      unit: "m2",
      confidence: height.assumed || units.errorPct > 0.1 ? "low" : "medium",
      basis:
        `${Math.round(m.lengthM * 10) / 10} m of paired ${thicknessMm}mm wall on ${sheet.code} × ${heightM} m (${height.basis})` +
        (deduct > 0 ? `; less ${deduct} m² for ${openings.doors} doors and ${openings.windows} windows` : "") +
        scaleNote,
      sheetId: sheet.id,
      evidence: [...m.evidence],
      reason: height.assumed ? "height assumed" : "thickness measured from paired faces",
      crossCheck:
        measure.unpairedM > 0
          ? `${Math.round(measure.unpairedM)} m of wall lines had no parallel partner and are not measured`
          : "every wall line found its partner face",
    });
  });
  return items;
}
