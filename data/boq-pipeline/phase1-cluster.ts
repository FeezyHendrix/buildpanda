import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Ent {
  entity?: string;
  object?: string;
  layer?: number[];
  handle?: number[];
  name?: string;
  start?: number[];
  end?: number[];
  points?: number[][];
  center?: number[];
  radius?: number;
  block_header?: number[];
  act_measurement?: number;
  xline1_pt?: number[];
  xline2_pt?: number[];
}

export interface DwgDoc {
  entities: Ent[];
  layerName: (e: Ent) => string;
}

function lastRef(r?: number[]): number | null {
  return r && r.length ? (r[r.length - 1] ?? null) : null;
}

export function loadDwg(dwgPath: string): DwgDoc {
  const tmp = path.join(os.tmpdir(), `p1-${Date.now()}.json`);
  execFileSync("dwgread", ["-O", "JSON", "-o", tmp, dwgPath], { stdio: ["ignore", "ignore", "ignore"] });
  const d = JSON.parse(fs.readFileSync(tmp, "utf8")) as { OBJECTS?: Ent[] };
  fs.unlinkSync(tmp);
  const entities = d.OBJECTS ?? [];
  const names = new Map<number, string>();
  for (const e of entities) {
    if (e.object === "LAYER" && e.name) {
      const h = lastRef(e.handle);
      if (h !== null) names.set(h, e.name);
    }
  }
  return { entities, layerName: (e) => (lastRef(e.layer) !== null && names.get(lastRef(e.layer)!)) || "0" };
}

export function centroid(e: Ent): [number, number] | null {
  if (e.start && e.end) return [(e.start[0]! + e.end[0]!) / 2, (e.start[1]! + e.end[1]!) / 2];
  if (e.center) return [e.center[0]!, e.center[1]!];
  if (e.points && e.points.length) {
    let sx = 0;
    let sy = 0;
    for (const p of e.points) {
      sx += p[0]!;
      sy += p[1]!;
    }
    return [sx / e.points.length, sy / e.points.length];
  }
  return null;
}

export function calibrate(doc: DwgDoc): { scaleToMm: number; confidence: number; samples: number } {
  const ratios: number[] = [];
  for (const e of doc.entities) {
    if (!String(e.entity ?? "").startsWith("DIMENSION")) continue;
    const m = e.act_measurement;
    if (!m || m <= 1 || !e.xline1_pt || !e.xline2_pt) continue;
    const geo = Math.hypot(e.xline2_pt[0]! - e.xline1_pt[0]!, e.xline2_pt[1]! - e.xline1_pt[1]!);
    if (geo > 1) ratios.push(m / geo);
  }
  if (!ratios.length) return { scaleToMm: 1, confidence: 0, samples: 0 };
  ratios.sort((a, b) => a - b);
  const med = ratios[ratios.length >> 1]!;
  const near = ratios.filter((r) => Math.abs(r - med) / med < 0.02).length;
  return { scaleToMm: med, confidence: near / ratios.length, samples: ratios.length };
}

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

// Grid-accelerated DBSCAN over entity centroids. eps is a fraction of drawing
// extent so it adapts to model units; a drawing is a dense region of geometry
// separated from its neighbours by whitespace (the gutters between sheets).
export function clusterDrawings(
  doc: DwgDoc,
  scaleToMm: number,
  opts: { epsMm?: number; minPts?: number } = {},
): Cluster[] {
  const epsMm = opts.epsMm ?? 2500;
  const minPts = opts.minPts ?? 8;
  const eps = epsMm / scaleToMm;

  const pts: Array<{ i: number; x: number; y: number }> = [];
  for (let i = 0; i < doc.entities.length; i++) {
    const e = doc.entities[i]!;
    if (!e.entity) continue;
    if (/dim|text|defpoint|grid/i.test(doc.layerName(e))) continue;
    const c = centroid(e);
    if (c) pts.push({ i, x: c[0], y: c[1] });
  }

  // Spatial hash grid for neighbour queries.
  const cell = eps;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  pts.forEach((p, idx) => {
    const k = key(p.x, p.y);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(idx);
  });
  const neighbours = (idx: number): number[] => {
    const p = pts[idx]!;
    const out: number[] = [];
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          const q = pts[j]!;
          if (Math.hypot(q.x - p.x, q.y - p.y) <= eps) out.push(j);
        }
      }
    return out;
  };

  const labels = new Array<number>(pts.length).fill(-2); // -2 unvisited, -1 noise
  let cid = 0;
  for (let i = 0; i < pts.length; i++) {
    if (labels[i] !== -2) continue;
    const nb = neighbours(i);
    if (nb.length < minPts) {
      labels[i] = -1;
      continue;
    }
    labels[i] = cid;
    const queue = [...nb];
    while (queue.length) {
      const j = queue.pop()!;
      if (labels[j] === -1) labels[j] = cid;
      if (labels[j] !== -2) continue;
      labels[j] = cid;
      const nb2 = neighbours(j);
      if (nb2.length >= minPts) queue.push(...nb2);
    }
    cid += 1;
  }

  const clusters = new Map<number, Cluster>();
  pts.forEach((p, idx) => {
    const lab = labels[idx]!;
    if (lab < 0) return;
    const c =
      clusters.get(lab) ??
      clusters.set(lab, { id: lab, count: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, widthM: 0, heightM: 0, members: [] }).get(lab)!;
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
