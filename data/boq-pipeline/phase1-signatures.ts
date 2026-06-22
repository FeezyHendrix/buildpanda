import { centroid, type DwgDoc, type Ent } from "./phase1-cluster.ts";

export interface ElementCount {
  element: string;
  count: number;
  unit: "nr";
  signature: string;
  confidence: "high" | "medium" | "low";
  crossCheck?: string;
}

function polyBBox(pts: number[][]): { w: number; h: number; closed: boolean } {
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
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const closed = Math.hypot(last[0]! - first[0]!, last[1]! - first[1]!) < (maxX - minX) * 0.15 + 1;
  return { w: maxX - minX, h: maxY - minY, closed };
}

// The "barcode catalog": each element type has a geometric signature we detect
// deterministically. Counts are taken WITHIN a single drawing (cluster) so we
// never sum the same element across repeated floor plans on the sheet.
export function countElements(doc: DwgDoc, members: Set<number>, scaleToMm: number): ElementCount[] {
  const toMm = scaleToMm;
  const ents = [...members].map((i) => doc.entities[i]!);
  const onLayer = (name: RegExp) => ents.filter((e) => name.test(doc.layerName(e)));

  const results: ElementCount[] = [];

  // 1) SANITARY — block insertions are an explicit barcode. Count INSERTs.
  const sanInserts = onLayer(/sanitar|toilet|wc|plumb/i).filter((e) => e.entity === "INSERT");
  if (sanInserts.length > 0) {
    results.push({
      element: "Sanitary fittings",
      count: sanInserts.length,
      unit: "nr",
      signature: "INSERT block on sanitary layer",
      confidence: "high",
    });
  }

  // 2) COLUMNS — small compact polygons. A column in plan is a tight
  // rectangle/square, typically 150-600mm across (e.g. 230x230 RC column).
  // Aspect ratio near 1 and small footprint is the signature, regardless of
  // whether the polyline explicitly closes.
  const colPolys = onLayer(/column|stanchion|pillar/i).filter((e) => {
    if (e.entity !== "LWPOLYLINE" || !e.points || e.points.length < 4) return false;
    const bb = polyBBox(e.points);
    const wMm = bb.w * toMm;
    const hMm = bb.h * toMm;
    if (wMm < 100 || wMm > 900 || hMm < 100 || hMm > 900) return false;
    const aspect = Math.max(wMm, hMm) / Math.max(Math.min(wMm, hMm), 1);
    return aspect <= 2.5;
  });
  if (colPolys.length > 0) {
    results.push({
      element: "Structural columns",
      count: colPolys.length,
      unit: "nr",
      signature: "small closed polygon (100-900mm) on column layer",
      confidence: "medium",
    });
  }

  // 3) DOORS — the door-swing ARC is the classic signature (radius ~ leaf width,
  // 600-1200mm). Count swing arcs on the door layer.
  const doorArcs = onLayer(/door/i).filter((e) => {
    if (e.entity !== "ARC" || typeof e.radius !== "number") return false;
    const rMm = e.radius * toMm;
    return rMm >= 500 && rMm <= 1500;
  });
  // Fallback: doors as repeated leaf rectangles when no swings are drawn.
  const doorLeaves = onLayer(/door/i).filter((e) => {
    if (e.entity !== "LWPOLYLINE" || !e.points) return false;
    const bb = polyBBox(e.points);
    const longMm = Math.max(bb.w, bb.h) * toMm;
    const shortMm = Math.min(bb.w, bb.h) * toMm;
    return bb.closed && longMm >= 600 && longMm <= 1200 && shortMm <= 120;
  });
  const doorCount = doorArcs.length > 0 ? doorArcs.length : doorLeaves.length;
  if (doorCount > 0) {
    results.push({
      element: "Doors",
      count: doorCount,
      unit: "nr",
      signature: doorArcs.length > 0 ? "swing arc (r 500-1500mm)" : "door-leaf rectangle",
      confidence: doorArcs.length > 0 ? "medium" : "low",
    });
  }

  // 4) WINDOWS — opening in wall shown as a short run of parallel lines (sill +
  // frame). Count distinct opening groups on the window layer.
  const windPolys = onLayer(/wind/i).filter((e) => {
    if (e.entity !== "LWPOLYLINE" || !e.points) return false;
    const bb = polyBBox(e.points);
    const longMm = Math.max(bb.w, bb.h) * toMm;
    return longMm >= 600 && longMm <= 3000;
  });
  // Windows are usually a few polylines each; estimate by clustering centroids.
  const windCount = groupByProximity(windPolys, 1500 / toMm);
  if (windCount > 0) {
    results.push({
      element: "Windows",
      count: windCount,
      unit: "nr",
      signature: "opening polyline group (0.6-3.0m) on window layer",
      confidence: "low",
    });
  }

  return results;
}

// Merge nearby element fragments into single counts (one window = several
// polylines). Greedy single-link grouping by centroid distance.
function groupByProximity(ents: Ent[], radius: number): number {
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
