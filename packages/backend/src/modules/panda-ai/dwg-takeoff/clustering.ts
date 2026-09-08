import { centroid, handleOf, isModelSpace, type DwgDoc, type DwgEntity } from "./dwg.ts";
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
  opts: { epsMm?: number; minPts?: number; map?: LayerMap; exclude?: Set<number> } = {},
): Cluster[] {
  const epsMm = opts.epsMm ?? 4000;
  const minPts = opts.minPts ?? 8;
  const eps = epsMm / (scaleToMm || 1);
  const map = opts.map ?? {};
  const exclude = opts.exclude ?? new Set<number>();

  const pts: ClusterPoint[] = [];
  for (let i = 0; i < doc.entities.length; i++) {
    const e = doc.entities[i]!;
    if (!isModelSpace(doc, e)) continue;
    if (String(e.entity).startsWith("DIMENSION") || e.entity === "TEXT" || e.entity === "MTEXT" || e.entity === "HATCH") continue;
    if (ANNOTATION.has(elementOf(doc, e, map))) continue;
    const h = handleOf(e);
    if (h !== null && exclude.has(h)) continue;
    const c = centroid(e);
    if (c) pts.push({ i, x: c[0], y: c[1] });
    // a long line is present all along its length: an elevation's floor
    // line ties its windows together even when they sit a bay apart
    for (const [x, y] of samplesAlong(e, eps / 2)) pts.push({ i, x, y });
  }

  const labels = dbscan(pts, eps, minPts);
  // a small drawing (a simple elevation or section is a dozen lines) never
  // reaches minPts neighbours, or reaches them for a handful of points and
  // is then too small to keep; either way a looser pass over the leftovers
  // finds it whole
  const sizes = new Map<number, Set<number>>();
  labels.forEach((l, k) => {
    if (l >= 0) (sizes.get(l) ?? sizes.set(l, new Set()).get(l)!).add(pts[k]!.i);
  });
  for (let k = 0; k < labels.length; k++) if (labels[k]! >= 0 && (sizes.get(labels[k]!)?.size ?? 0) < minPts * 3) labels[k] = -1;
  const noise = pts.map((p, idx) => ({ p, idx })).filter(({ idx }) => labels[idx]! < 0);
  const rescued = dbscan(noise.map(({ p }) => p), eps, 3);
  const firstPass = Math.max(-1, ...labels) + 1;
  noise.forEach(({ idx }, k) => {
    if (rescued[k]! >= 0) labels[idx] = firstPass + rescued[k]!;
  });
  // an entity belongs to the cluster most of its points fell in; the count
  // is entities, not points, so a long line is one member however finely sampled
  const clusters = new Map<number, Cluster>();
  const votes = new Map<number, Map<number, number>>();
  pts.forEach((p, idx) => {
    const label = labels[idx]!;
    if (label < 0) return;
    const v = votes.get(p.i) ?? new Map<number, number>();
    v.set(label, (v.get(label) ?? 0) + 1);
    votes.set(p.i, v);
  });
  const memberOf = new Map<number, number>();
  for (const [i, v] of votes) memberOf.set(i, [...v.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
  pts.forEach((p, idx) => {
    const label = labels[idx]!;
    if (label < 0 || memberOf.get(p.i) !== label) return;
    let c = clusters.get(label);
    if (!c) {
      c = { id: label, count: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, widthM: 0, heightM: 0, members: [] };
      clusters.set(label, c);
    }
    c.minX = Math.min(c.minX, p.x);
    c.minY = Math.min(c.minY, p.y);
    c.maxX = Math.max(c.maxX, p.x);
    c.maxY = Math.max(c.maxY, p.y);
    if (c.members[c.members.length - 1] !== p.i) {
      c.members.push(p.i);
      c.count += 1;
    }
  });

  const toM = scaleToMm / 1000;
  return [...clusters.values()]
    .map((c) => ({ ...c, widthM: (c.maxX - c.minX) * toM, heightM: (c.maxY - c.minY) * toM }))
    .filter((c) => (c.id < firstPass ? c.count >= minPts * 3 : c.count >= minPts && Math.max(c.widthM, c.heightM) >= 2))
    .sort((a, b) => b.count - a.count);
}

const MAX_SAMPLES = 64;

// Points along a line or polyline edge every `step`, ends excluded (the
// centroid already stands for a short entity).
function samplesAlong(e: DwgEntity, step: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const edges: Array<[number[], number[]]> = [];
  if (e.entity === "LINE" && e.start && e.end) edges.push([e.start, e.end]);
  else if ((e.entity === "LWPOLYLINE" || e.entity === "POLYLINE_2D") && e.points && e.points.length >= 2) {
    for (let k = 1; k < e.points.length; k++) edges.push([e.points[k - 1]!, e.points[k]!]);
  }
  for (const [a, b] of edges) {
    const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    const n = Math.min(MAX_SAMPLES, Math.floor(len / step));
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0.5 : k / n;
      out.push([a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t]);
    }
  }
  return out;
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
  // a view is at least a storey tall and a few bays wide; a scale bar is neither
  if (aspect > 1.5 && openings === 0 && c.heightM >= 2.5 && c.widthM >= 4) return "elevation";
  if (c.widthM < 3 || c.heightM < 3) return "detail";
  return "unknown";
}
