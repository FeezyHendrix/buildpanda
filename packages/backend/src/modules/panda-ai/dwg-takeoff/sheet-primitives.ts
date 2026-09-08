import { blockNameOf, extentOf, handleOf, isModelSpace, textOf, type DwgDoc, type DwgEntity } from "./dwg.ts";
import { expandInserts } from "./dwg-inserts.ts";
import type { GeoInsert, GeoOutline, GeoSegment, GeoText, SheetBounds } from "../pdf-takeoff/types.ts";

// The primitives one register sheet is drawn from, in drawing units: the
// straight segments of its lines, polylines, arcs and circles (block
// contents expanded and placed), its closed outlines, its texts and the
// block references placed on it. Model space only, clipped to the sheet's
// window so the neighbouring drawing does not leak in.

export interface SheetPrimitives {
  segments: GeoSegment[];
  texts: GeoText[];
  inserts: GeoInsert[];
  outlines: GeoOutline[];
}

const ARC_CHORDS = 8;
const CIRCLE_CHORDS = 16;
// a text glyph is about 0.6 of its height wide in every CAD font
const GLYPH_ASPECT = 0.6;
const CLOSED_FLAG = 512;

function inWindow(e: DwgEntity, bounds: SheetBounds | null): boolean {
  if (!bounds) return true;
  const ext = extentOf(e);
  if (!ext) return false;
  return ext.maxX >= bounds.minX && ext.minX <= bounds.maxX && ext.maxY >= bounds.minY && ext.minY <= bounds.maxY;
}

const seg = (a: number[], b: number[]): GeoSegment => ({ x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]!, width: 0 });

function chords(center: number[], radius: number, start: number, end: number, n: number, out: GeoSegment[]): number[][] {
  let sweep = end - start;
  if (sweep <= 0) sweep += Math.PI * 2;
  const pts: number[][] = [];
  let prev = [center[0]! + radius * Math.cos(start), center[1]! + radius * Math.sin(start)];
  pts.push(prev);
  for (let k = 1; k <= n; k++) {
    const a = start + (sweep * k) / n;
    const next = [center[0]! + radius * Math.cos(a), center[1]! + radius * Math.sin(a)];
    out.push(seg(prev, next));
    pts.push(next);
    prev = next;
  }
  return pts;
}

/** Everything drawable inside the sheet's window, as segments, outlines, texts and inserts. */
export function sheetPrimitives(doc: DwgDoc, bounds: SheetBounds | null): SheetPrimitives {
  const out: SheetPrimitives = { segments: [], texts: [], inserts: [], outlines: [] };
  // block references first, from the raw document: the expansion replaces
  // nothing, but the INSERT is the object a symbol search names
  for (const e of doc.entities) {
    if (e.entity !== "INSERT" || !isModelSpace(doc, e) || !e.ins_pt || !inWindow(e, bounds)) continue;
    const handle = handleOf(e);
    const name = blockNameOf(doc, e);
    // anonymous blocks (*D dimensions, *U groups, *X hatches) are not symbols
    if (handle === null || !name || name.startsWith("*")) continue;
    out.inserts.push({ handle, name, x: e.ins_pt[0]!, y: e.ins_pt[1]! });
  }
  const expanded = expandInserts(doc).doc;
  for (const e of expanded.entities) {
    if (!isModelSpace(expanded, e) || !inWindow(e, bounds)) continue;
    switch (e.entity) {
      case "LINE":
        if (e.start && e.end) out.segments.push(seg(e.start, e.end));
        break;
      case "LWPOLYLINE":
      case "POLYLINE_2D": {
        const pts = e.points;
        if (!pts || pts.length < 2) break;
        for (let k = 1; k < pts.length; k++) out.segments.push(seg(pts[k - 1]!, pts[k]!));
        if (((e.flag ?? 0) & CLOSED_FLAG) !== 0) {
          out.segments.push(seg(pts[pts.length - 1]!, pts[0]!));
          if (pts.length >= 3) out.outlines.push({ vertices: pts.map((p) => [p[0]!, p[1]!]) });
        }
        break;
      }
      case "ARC":
        if (e.center && e.radius !== undefined && e.start_angle !== undefined && e.end_angle !== undefined) {
          chords(e.center, e.radius, e.start_angle, e.end_angle, ARC_CHORDS, out.segments);
        }
        break;
      case "CIRCLE":
        if (e.center && e.radius !== undefined) {
          const pts = chords(e.center, e.radius, 0, Math.PI * 2, CIRCLE_CHORDS, out.segments);
          out.outlines.push({ vertices: pts.slice(0, CIRCLE_CHORDS) });
        }
        break;
      case "TEXT":
      case "MTEXT": {
        const str = textOf(e);
        if (!str || !e.ins_pt) break;
        const height = e.height ?? 0;
        out.texts.push({ str, x: e.ins_pt[0]!, y: e.ins_pt[1]!, w: height * GLYPH_ASPECT * str.length });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
