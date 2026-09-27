import { handleOf, type DwgDoc } from "./dwg.ts";
import { elementOf } from "./taxonomy.ts";
import { isNotWallGeometry } from "./shapes.ts";
import type { LayerElement, LayerMap, RegisterSheet } from "./types.ts";

// The straight segments a wall measurement works on: lines, polyline edges
// (with the closing edge of a closed outline) and arcs as chords.

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

/**
 * Wall faces when no layer is mapped to walls: every straight line on the
 * unmapped layers except what a wall face cannot be (swings, circles,
 * compact closed outlines). Pairing then finds the walls among them.
 */
export function autoWallSegments(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap, scaleToMm: number): WallSegment[] {
  const skip = new Set<number>();
  for (const i of sheet.members) {
    const e = doc.entities[i]!;
    const h = handleOf(e);
    if (h !== null && isNotWallGeometry(e, scaleToMm)) skip.add(h);
  }
  return wallSegments(doc, sheet, map, ["auto"]).filter((w) => w.handle === null || !skip.has(w.handle));
}

const seg = (handle: number | null, a: number[], b: number[]): WallSegment => ({
  handle,
  x1: a[0]!,
  y1: a[1]!,
  x2: b[0]!,
  y2: b[1]!,
  len: Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!),
});
