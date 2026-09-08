import { centroid, isModelSpace, type DwgDoc } from "./dwg.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerMap } from "./types.ts";

export interface Cluster {
  id: number;
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthM: number;
  heightM: number;
  members: number[];
}

export interface ClusterPoint {
  i: number;
  x: number;
  y: number;
}

/** Grid-accelerated DBSCAN. Returns a label per point; -1 is noise. */
export function dbscan(pts: ClusterPoint[], eps: number, minPts: number): number[] {
  const cell = eps;
  const grid = new Map<string, number[]>();
  const cellKey = (x: number, y: number): string => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  pts.forEach((p, idx) => {
    const k = cellKey(p.x, p.y);
    const bucket = grid.get(k);
    if (bucket) bucket.push(idx);
    else grid.set(k, [idx]);
  });
  const neighbours = (idx: number): number[] => {
    const p = pts[idx]!;
    const out: number[] = [];
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          const q = pts[j]!;
          if (Math.hypot(q.x - p.x, q.y - p.y) <= eps) out.push(j);
        }
      }
    }
    return out;
  };
  const UNVISITED = -2;
  const NOISE = -1;
  const labels = new Array<number>(pts.length).fill(UNVISITED);
  let clusterId = 0;
  for (let i = 0; i < pts.length; i++) {
    if (labels[i] !== UNVISITED) continue;
    const seeds = neighbours(i);
    if (seeds.length < minPts) {
      labels[i] = NOISE;
      continue;
    }
    labels[i] = clusterId;
    const queue = [...seeds];
    while (queue.length) {
      const j = queue.pop()!;
      if (labels[j] === NOISE) labels[j] = clusterId;
      if (labels[j] !== UNVISITED) continue;
      labels[j] = clusterId;
      const next = neighbours(j);
      if (next.length >= minPts) queue.push(...next);
    }
    clusterId += 1;
  }
  return labels;
}

const ANNOTATION = new Set(["dimensions", "text", "grid", "levels", "ignore"]);

/**
 * A DWG model space holds many drawings (plans, elevations, sections, details)
 * laid out in separate regions. Summing geometry across all of them overcounts
 * by the number of drawings. DBSCAN over the centroids of model-space geometry
 * recovers the individual drawings as dense regions separated by the gutters
 * between them. Annotation layers are left out so a dimension string bridging
 * two drawings does not merge them; block inserts are in, so a plan drawn
 * mostly from blocks still forms a region.
 */
export function clusterDrawings(
  doc: DwgDoc,
  scaleToMm: number,
  opts: { epsMm?: number; minPts?: number; map?: LayerMap } = {},
): Cluster[] {
  const epsMm = opts.epsMm ?? 4000;
  const minPts = opts.minPts ?? 8;
  const eps = epsMm / (scaleToMm || 1);
  const map = opts.map ?? {};

  const pts: ClusterPoint[] = [];
  for (let i = 0; i < doc.entities.length; i++) {
    const e = doc.entities[i]!;
    if (!isModelSpace(doc, e)) continue;
    if (String(e.entity).startsWith("DIMENSION") || e.entity === "TEXT" || e.entity === "MTEXT") continue;
    if (ANNOTATION.has(elementOf(doc, e, map))) continue;
    const c = centroid(e);
    if (c) pts.push({ i, x: c[0], y: c[1] });
  }

  const labels = dbscan(pts, eps, minPts);
  const clusters = new Map<number, Cluster>();
  pts.forEach((p, idx) => {
    const label = labels[idx]!;
    if (label < 0) return;
    let c = clusters.get(label);
    if (!c) {
      c = { id: label, count: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, widthM: 0, heightM: 0, members: [] };
      clusters.set(label, c);
    }
    c.count += 1;
    c.minX = Math.min(c.minX, p.x);
    c.minY = Math.min(c.minY, p.y);
    c.maxX = Math.max(c.maxX, p.x);
    c.maxY = Math.max(c.maxY, p.y);
    c.members.push(p.i);
  });

  const toM = scaleToMm / 1000;
  return [...clusters.values()]
    .map((c) => ({ ...c, widthM: (c.maxX - c.minX) * toM, heightM: (c.maxY - c.minY) * toM }))
    .filter((c) => c.count >= minPts * 3)
    .sort((a, b) => b.count - a.count);
}

// Geometry-only fallback for a drawing that carries no usable labels.
export function classifyDrawing(doc: DwgDoc, c: Cluster, map: LayerMap = {}): string {
  let walls = 0;
  let openings = 0;
  for (const i of c.members) {
    const el = elementOf(doc, doc.entities[i]!, map);
    if (el === "walls") walls++;
    if (el === "doors" || el === "windows") openings++;
  }
  const aspect = c.widthM / Math.max(c.heightM, 0.1);
  const squareish = aspect > 0.4 && aspect < 2.5;
  if (squareish && walls > 20 && openings > 5 && c.widthM > 6 && c.heightM > 6) return "floor-plan";
  if (aspect > 2.5 && openings === 0) return "elevation";
  if (c.widthM < 6 || c.heightM < 6) return "detail";
  return "unknown";
}
