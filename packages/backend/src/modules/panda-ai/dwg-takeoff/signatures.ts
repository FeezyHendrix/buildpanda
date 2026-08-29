import type { DwgDoc, DwgEntity } from "./dwg.ts";
import { centroid } from "./dwg.ts";
import type { MeasuredItem } from "./types.ts";

function bbox(pts: number[][]): { w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p[0]!);
    minY = Math.min(minY, p[1]!);
    maxX = Math.max(maxX, p[0]!);
    maxY = Math.max(maxY, p[1]!);
  }
  return { w: maxX - minX, h: maxY - minY };
}

function groupByProximity(ents: DwgEntity[], radius: number): number {
  const pts = ents.map(centroid).filter((c): c is [number, number] => c !== null);
  const used = new Array<boolean>(pts.length).fill(false);
  let groups = 0;
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    groups += 1;
    const stack = [i];
    while (stack.length) {
      const a = stack.pop()!;
      for (let j = 0; j < pts.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(pts[a]![0] - pts[j]![0], pts[a]![1] - pts[j]![1]) <= radius) {
          used[j] = true;
          stack.push(j);
        }
      }
    }
  }
  return groups;
}

// Each building element is drawn with a recognisable geometric signature (like
// a barcode), detected deterministically within a single drawing. Counts are
// per-drawing so a repeated floor plan is not multiplied by floor count.
export function countElements(doc: DwgDoc, members: number[], scaleToMm: number): MeasuredItem[] {
  const ents = members.map((i) => doc.entities[i]!);
  const onLayer = (re: RegExp): DwgEntity[] => ents.filter((e) => re.test(doc.layerName(e)));
  const items: MeasuredItem[] = [];

  const sanitary = onLayer(/sanitar|toilet|plumb/i).filter((e) => e.entity === "INSERT");
  if (sanitary.length > 0) {
    items.push({
      trade: "sanitary",
      description: "Sanitary fittings (WC, WHB, etc.)",
      quantity: sanitary.length,
      unit: "nr",
      confidence: "high",
      basis: `${sanitary.length} block insertions on the sanitary layer`,
    });
  }

  // Columns: a compact near-square polygon (e.g. 230x230 RC column), 100-900mm.
  const columns = onLayer(/column|stanchion|pillar/i).filter((e) => {
    if (e.entity !== "LWPOLYLINE" || !e.points || e.points.length < 4) return false;
    const { w, h } = bbox(e.points);
    const wMm = w * scaleToMm;
    const hMm = h * scaleToMm;
    if (wMm < 100 || wMm > 900 || hMm < 100 || hMm > 900) return false;
    return Math.max(wMm, hMm) / Math.max(Math.min(wMm, hMm), 1) <= 2.5;
  });
  if (columns.length > 0) {
    items.push({
      trade: "columns",
      description: "Structural columns",
      quantity: columns.length,
      unit: "nr",
      confidence: "medium",
      basis: `${columns.length} compact column-section polygons`,
    });
  }

  // Doors: the swing arc (radius ~ leaf width, 500-1500mm) is the signature.
  const doorArcs = onLayer(/door/i).filter((e) => {
    if (e.entity !== "ARC" || typeof e.radius !== "number") return false;
    const rMm = e.radius * scaleToMm;
    return rMm >= 500 && rMm <= 1500;
  });
  if (doorArcs.length > 0) {
    items.push({
      trade: "doors",
      description: "Doors",
      quantity: doorArcs.length,
      unit: "nr",
      confidence: "medium",
      basis: `${doorArcs.length} door-swing arcs (r 500-1500mm)`,
    });
  }

  const windows = onLayer(/wind/i).filter((e) => {
    if (e.entity !== "LWPOLYLINE" || !e.points) return false;
    const { w, h } = bbox(e.points);
    const longMm = Math.max(w, h) * scaleToMm;
    return longMm >= 600 && longMm <= 3000;
  });
  const windowCount = groupByProximity(windows, 1500 / scaleToMm);
  if (windowCount > 0) {
    items.push({
      trade: "windows",
      description: "Windows",
      quantity: windowCount,
      unit: "nr",
      confidence: "low",
      basis: `${windowCount} opening groups on the window layer`,
    });
  }

  return items;
}
