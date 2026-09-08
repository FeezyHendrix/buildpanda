import { handleOf, isModelSpace, type DwgDoc, type DwgEntity } from "./dwg.ts";

// A sheet border drawn in model space: four lines or a closed polyline
// forming a large rectangle with other geometry inside it. Borders are
// never walls and must not glue neighbouring drawings into one cluster,
// so they are found first and left out of everything that follows.

const MIN_FRAME_M2 = 50;
const SNAP_MM = 20;

interface Line {
  handle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Handles of the entities that make up sheet borders. */
export function frameHandles(doc: DwgDoc, scaleToMm: number): Set<number> {
  const out = new Set<number>();
  const minArea = (MIN_FRAME_M2 * 1e6) / (scaleToMm * scaleToMm);
  const snap = SNAP_MM / scaleToMm;
  const key = (x: number, y: number) => `${Math.round(x / snap)}:${Math.round(y / snap)}`;
  const horizontals: Line[] = [];
  const verticals: Line[] = [];
  const centres: Array<[number, number]> = [];
  for (const e of doc.entities) {
    if (!isModelSpace(doc, e)) continue;
    const h = handleOf(e);
    if (h === null) continue;
    if (e.entity === "LWPOLYLINE" && ((e.flag ?? 0) & 512) !== 0 && e.points?.length === 4 && isRectangle(e, minArea)) out.add(h);
    if (e.entity === "LINE" && e.start && e.end) {
      const l: Line = { handle: h, x1: e.start[0]!, y1: e.start[1]!, x2: e.end[0]!, y2: e.end[1]! };
      if (Math.abs(l.y1 - l.y2) <= snap) horizontals.push(l);
      else if (Math.abs(l.x1 - l.x2) <= snap) verticals.push(l);
      centres.push([(l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2]);
    } else if (e.center) centres.push([e.center[0]!, e.center[1]!]);
  }
  // four lines meeting at their ends: match a horizontal's two ends to verticals' ends
  const byEnd = new Map<string, Line[]>();
  for (const v of verticals) {
    for (const [x, y] of [[v.x1, v.y1], [v.x2, v.y2]]) byEnd.set(key(x!, y!), [...(byEnd.get(key(x!, y!)) ?? []), v]);
  }
  for (const bottom of horizontals) {
    const left = byEnd.get(key(Math.min(bottom.x1, bottom.x2), bottom.y1)) ?? [];
    const right = byEnd.get(key(Math.max(bottom.x1, bottom.x2), bottom.y1)) ?? [];
    for (const l of left) {
      for (const r of right) {
        const top = Math.max(l.y1, l.y2);
        if (Math.abs(Math.max(r.y1, r.y2) - top) > snap || top <= bottom.y1 + snap) continue;
        const w = Math.abs(bottom.x2 - bottom.x1);
        const hgt = top - bottom.y1;
        if (w * hgt < minArea) continue;
        const topLine = horizontals.find((t) => t !== bottom && Math.abs(t.y1 - top) <= snap && Math.abs(Math.min(t.x1, t.x2) - Math.min(bottom.x1, bottom.x2)) <= snap && Math.abs(Math.max(t.x1, t.x2) - Math.max(bottom.x1, bottom.x2)) <= snap);
        if (!topLine) continue;
        // a border has a drawing inside it; a big empty rectangle is a tank or a slab outline
        const minX = Math.min(bottom.x1, bottom.x2);
        const maxX = Math.max(bottom.x1, bottom.x2);
        const inside = centres.filter(([x, y]) => x > minX + snap && x < maxX - snap && y > bottom.y1 + snap && y < top - snap).length;
        if (inside < 20) continue;
        for (const h of [bottom.handle, topLine.handle, l.handle, r.handle]) out.add(h);
      }
    }
  }
  return out;
}

function isRectangle(e: DwgEntity, minArea: number): boolean {
  const pts = e.points!;
  const xs = pts.map((p) => p[0]!);
  const ys = pts.map((p) => p[1]!);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return w * h >= minArea && pts.every((p) => (Math.abs(p[0]! - Math.min(...xs)) < 1e-6 || Math.abs(p[0]! - Math.max(...xs)) < 1e-6) && (Math.abs(p[1]! - Math.min(...ys)) < 1e-6 || Math.abs(p[1]! - Math.max(...ys)) < 1e-6));
}
