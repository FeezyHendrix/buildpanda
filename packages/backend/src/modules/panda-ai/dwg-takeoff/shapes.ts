import type { DwgEntity } from "./dwg.ts";

// What an entity looks like, regardless of the layer it sits on. These are the
// rules the engine falls back to when a layer name says nothing ("0", "A-1")
// or a drawing keeps everything on one layer: a 230 square is a column, a thin
// closed outline across a wall is a window, a quarter-circle is a door swing.

const CLOSED = 512;

export interface ShapeSides {
  long: number; // mm
  short: number; // mm
}

export const isClosedOutline = (e: DwgEntity): boolean =>
  e.entity === "LWPOLYLINE" && ((e.flag ?? 0) & CLOSED) !== 0 && (e.points?.length ?? 0) >= 3;

/** Bounding-box sides of a polyline, in mm. */
export function shapeSides(e: DwgEntity, scaleToMm: number): ShapeSides {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of e.points ?? []) {
    minX = Math.min(minX, p[0]!);
    maxX = Math.max(maxX, p[0]!);
    minY = Math.min(minY, p[1]!);
    maxY = Math.max(maxY, p[1]!);
  }
  const w = (maxX - minX) * scaleToMm;
  const h = (maxY - minY) * scaleToMm;
  return { long: Math.max(w, h), short: Math.min(w, h) };
}

/** A compact closed square: a column on plan (150–900 mm, near-square). */
export function isSquareColumn(e: DwgEntity, scaleToMm: number): boolean {
  if (!isClosedOutline(e)) return false;
  const s = shapeSides(e, scaleToMm);
  return s.long >= 150 && s.long <= 900 && s.short >= 150 && s.short / s.long >= 0.75;
}

/** A thin closed outline across a wall: a window frame on plan. */
export function isWindowFrame(e: DwgEntity, scaleToMm: number): boolean {
  if (!isClosedOutline(e)) return false;
  const s = shapeSides(e, scaleToMm);
  return s.long >= 400 && s.long <= 2400 && s.short <= 150;
}

/** A compact closed oblong (WC, basin, shower tray) or a small circle (basin). */
export function isFitting(e: DwgEntity, scaleToMm: number): boolean {
  if (e.entity === "CIRCLE" && typeof e.radius === "number") {
    const r = e.radius * scaleToMm;
    return r >= 150 && r <= 450;
  }
  if (!isClosedOutline(e)) return false;
  const s = shapeSides(e, scaleToMm);
  return s.long >= 300 && s.long <= 1800 && s.short >= 150 && s.short / s.long < 0.75;
}

/** A quarter-circle of door-leaf radius: a door swing. */
/**
 * A quarter-circle drawn as a polyline: the arc lives in the vertex bulges,
 * so an architect's swing is often not an ARC entity at all. Its bounding box
 * is about the leaf's length on both sides.
 */
export function isBulgedSwing(e: DwgEntity, scaleToMm: number): boolean {
  if (e.entity !== "LWPOLYLINE" && e.entity !== "POLYLINE_2D") return false;
  const bulges = (e as { bulges?: number[] }).bulges;
  if (!Array.isArray(bulges) || !bulges.some((b) => Math.abs(b) > 1e-6)) return false;
  const s = shapeSides(e, scaleToMm);
  return s.long >= 500 && s.long <= 1600 && s.short >= 200;
}

/**
 * Anything on a door layer that is the size of a door: a swing, a leaf drawn
 * closed (a rectangle or a single line), a frame, or a door block. One door is
 * usually several of these, so they are grouped before they are counted.
 */
export function isDoorMark(e: DwgEntity, scaleToMm: number): boolean {
  if (e.entity === "INSERT") return true;
  if (isBulgedSwing(e, scaleToMm)) return true;
  if (e.entity === "ARC" && typeof e.radius === "number") {
    const r = e.radius * scaleToMm;
    return r >= 500 && r <= 1500;
  }
  if (e.entity === "LINE" && e.start && e.end) {
    const len = Math.hypot(e.end[0]! - e.start[0]!, e.end[1]! - e.start[1]!) * scaleToMm;
    return len >= 600 && len <= 2400;
  }
  if (e.entity === "LWPOLYLINE" || e.entity === "POLYLINE_2D") {
    const s = shapeSides(e, scaleToMm);
    return s.long >= 600 && s.long <= 2400 && s.short <= 900;
  }
  return false;
}

export function isDoorSwing(e: DwgEntity, scaleToMm: number): boolean {
  if (isBulgedSwing(e, scaleToMm)) return true;
  if (e.entity !== "ARC" || typeof e.radius !== "number") return false;
  const r = e.radius * scaleToMm;
  if (r < 500 || r > 1500) return false;
  if (e.start_angle === undefined || e.end_angle === undefined) return true;
  let sweep = e.end_angle - e.start_angle;
  if (sweep < 0) sweep += Math.PI * 2;
  return sweep >= Math.PI / 4 && sweep <= (3 * Math.PI) / 4;
}

/** Anything a wall face cannot be: swings, circles and compact closed outlines. */
export function isNotWallGeometry(e: DwgEntity, scaleToMm: number): boolean {
  if (e.entity === "ARC" || e.entity === "CIRCLE") return true;
  if (!isClosedOutline(e)) return false;
  return shapeSides(e, scaleToMm).long <= 2400;
}
