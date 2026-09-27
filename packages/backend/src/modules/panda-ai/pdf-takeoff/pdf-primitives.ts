import type { ExtractedSheet, GeoOutline, GeoSegment, GeoText, Segment } from "./types.ts";

// What a PDF page's vector content looks like to room fill and symbol
// search: every stroked or filled segment with its pen, every text run,
// and the closed subpaths rebuilt into outlines. Points are pdf.js points,
// the space the viewer draws in.

export interface PdfPrimitives {
  segments: GeoSegment[];
  texts: GeoText[];
  outlines: GeoOutline[];
}

const EPS = 1e-6;

/** Closed subpaths as polygons, in drawing order; a subpath of fewer than three sides is not a shape. */
export function closedOutlines(segments: Segment[]): GeoOutline[] {
  const byPath = new Map<number, Segment[]>();
  for (const s of segments) {
    if (!s.closed || s.path === undefined || s.len <= EPS) continue;
    const list = byPath.get(s.path);
    if (list) list.push(s);
    else byPath.set(s.path, [s]);
  }
  const outlines: GeoOutline[] = [];
  for (const parts of byPath.values()) {
    const vertices = parts.map((s) => [s.x1, s.y1]);
    const last = parts[parts.length - 1]!;
    const first = parts[0]!;
    // an explicitly closed path repeats no vertex; an open one drawn back to its start does
    if (Math.hypot(last.x2 - first.x1, last.y2 - first.y1) > EPS) vertices.push([last.x2, last.y2]);
    if (vertices.length >= 3) outlines.push({ vertices });
  }
  return outlines;
}

export function pdfPrimitives(extracted: ExtractedSheet): PdfPrimitives {
  return {
    segments: extracted.segments.map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, width: s.width })),
    texts: extracted.texts.filter((t) => !t.rotated).map((t) => ({ str: t.str, x: t.x, y: t.y, w: t.w })),
    outlines: closedOutlines(extracted.segments),
  };
}
