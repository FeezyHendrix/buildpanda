import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { TakeoffItem } from "./types.ts";

interface DwgEntity {
  entity?: string;
  object?: string;
  handle?: number[];
  layer?: number[];
  name?: string;
  start?: number[];
  end?: number[];
  points?: number[][];
  act_measurement?: number;
  xline1_pt?: number[];
  xline2_pt?: number[];
  center?: number[];
  radius?: number;
}

export interface DwgModel {
  entities: DwgEntity[];
  layerNameByHandle: Map<number, string>;
}

function lastRef(ref: number[] | undefined): number | null {
  if (!ref || ref.length === 0) return null;
  return ref[ref.length - 1] ?? null;
}

export function parseDwg(dwgPath: string): DwgModel {
  const tmp = path.join(os.tmpdir(), `dwg-${Date.now()}.json`);
  execFileSync("dwgread", ["-O", "JSON", "-o", tmp, dwgPath], { stdio: ["ignore", "ignore", "ignore"] });
  const d = JSON.parse(fs.readFileSync(tmp, "utf8")) as { OBJECTS?: DwgEntity[] };
  fs.unlinkSync(tmp);
  const objs = d.OBJECTS ?? [];
  const layerNameByHandle = new Map<number, string>();
  for (const o of objs) {
    if (o.object === "LAYER" && o.name) {
      const h = lastRef(o.handle);
      if (h !== null) layerNameByHandle.set(h, o.name);
    }
  }
  return { entities: objs, layerNameByHandle };
}

export function layerOf(e: DwgEntity, model: DwgModel): string {
  const h = lastRef(e.layer);
  return (h !== null && model.layerNameByHandle.get(h)) || "0";
}

function dist(a: number[], b: number[]): number {
  return Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
}

function midpoint(e: DwgEntity): [number, number] | null {
  if (e.start && e.end) return [(e.start[0]! + e.end[0]!) / 2, (e.start[1]! + e.end[1]!) / 2];
  if (e.points && e.points.length > 0) {
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

// A DWG sheet usually holds MANY drawings (plans, elevations, sections, details)
// laid out in separate regions of model space. Summing geometry across all of
// them massively overcounts. Cluster entities into spatial regions on a coarse
// grid; the QS then measures one drawing (region), not the whole sheet.
export interface DrawingRegion {
  id: number;
  cellX: number;
  cellY: number;
  bboxMinX: number;
  bboxMinY: number;
  bboxMaxX: number;
  bboxMaxY: number;
  wallEntityCount: number;
}

export function detectDrawingRegions(model: DwgModel, cal: Calibration): DrawingRegion[] {
  const cellSize = 60000 / (cal.scaleToMm || 1);
  const cells = new Map<string, { x: number; y: number; n: number; minX: number; minY: number; maxX: number; maxY: number }>();
  for (const e of model.entities) {
    const tradeName = layerOf(e, model);
    if (!/wall/i.test(tradeName)) continue;
    const mid = midpoint(e);
    if (!mid) continue;
    const cx = Math.round(mid[0] / cellSize);
    const cy = Math.round(mid[1] / cellSize);
    const key = `${cx},${cy}`;
    const cell = cells.get(key) ?? { x: cx, y: cy, n: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    cell.n += 1;
    cell.minX = Math.min(cell.minX, mid[0]);
    cell.minY = Math.min(cell.minY, mid[1]);
    cell.maxX = Math.max(cell.maxX, mid[0]);
    cell.maxY = Math.max(cell.maxY, mid[1]);
    cells.set(key, cell);
  }
  return [...cells.values()]
    .filter((c) => c.n >= 20)
    .sort((a, b) => b.n - a.n)
    .map((c, i) => ({
      id: i,
      cellX: c.x,
      cellY: c.y,
      bboxMinX: c.minX,
      bboxMinY: c.minY,
      bboxMaxX: c.maxX,
      bboxMaxY: c.maxY,
      wallEntityCount: c.n,
    }));
}

function inRegion(mid: [number, number] | null, region: DrawingRegion | null): boolean {
  if (!region) return true;
  if (!mid) return false;
  const pad = 5000;
  return (
    mid[0] >= region.bboxMinX - pad &&
    mid[0] <= region.bboxMaxX + pad &&
    mid[1] >= region.bboxMinY - pad &&
    mid[1] <= region.bboxMaxY + pad
  );
}

// Self-calibration: compare each linear dimension's annotated value to the
// geometric distance between its extension-line origins. The median ratio is the
// scale factor from model units to the dimension's real units (mm). A tight
// cluster around the median means the drawing is trustworthy to measure from.
export interface Calibration {
  scaleToMm: number;
  confidence: number;
  sampleCount: number;
}

export function calibrateScale(model: DwgModel): Calibration {
  const ratios: number[] = [];
  for (const e of model.entities) {
    if (!String(e.entity ?? "").startsWith("DIMENSION")) continue;
    const m = e.act_measurement;
    if (!m || m <= 1 || !e.xline1_pt || !e.xline2_pt) continue;
    const geo = dist(e.xline1_pt, e.xline2_pt);
    if (geo > 1) ratios.push(m / geo);
  }
  if (ratios.length === 0) return { scaleToMm: 1, confidence: 0, sampleCount: 0 };
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)]!;
  const near = ratios.filter((r) => Math.abs(r - median) / median < 0.02).length;
  return { scaleToMm: median, confidence: near / ratios.length, sampleCount: ratios.length };
}

const LAYER_TRADE: Array<{ match: RegExp; trade: string }> = [
  { match: /wall|block/i, trade: "walls" },
  { match: /column|stanchion|pillar/i, trade: "columns" },
  { match: /door/i, trade: "doors" },
  { match: /wind/i, trade: "windows" },
  { match: /roof/i, trade: "roof" },
  { match: /floor|slab|finish/i, trade: "floor" },
];

const NOISE = /dim|text|grid|draft|defpoint|hide|hatch|^0$|line|level|handrail/i;

export function classifyLayer(name: string): string | null {
  if (NOISE.test(name)) return null;
  for (const { match, trade } of LAYER_TRADE) if (match.test(name)) return trade;
  return null;
}

export interface TakeoffOptions {
  wallHeightM: number;
  unknownLayerTrades?: Record<string, string | null>;
  // Segments longer than this (metres) are treated as borders/viewports/section
  // lines, not building elements, and excluded. Real wall runs are rarely >~20m.
  maxSegmentM?: number;
  region?: DrawingRegion | null;
}

const DEFAULT_MAX_SEGMENT_M = 30;

// Deterministic measurement. Lengths in mm (post-calibration) -> metres.
export function runTakeoff(model: DwgModel, cal: Calibration, opts: TakeoffOptions): TakeoffItem[] {
  const toM = cal.scaleToMm / 1000;
  const maxSeg = opts.maxSegmentM ?? DEFAULT_MAX_SEGMENT_M;
  const lengthByTrade = new Map<string, number>();
  const countByTrade = new Map<string, number>();
  const layersSeen = new Map<string, string | null>();

  for (const e of model.entities) {
    const lname = layerOf(e, model);
    if (!layersSeen.has(lname)) {
      const override = opts.unknownLayerTrades?.[lname];
      layersSeen.set(lname, override !== undefined ? override : classifyLayer(lname));
    }
    const trade = layersSeen.get(lname) ?? null;
    if (!trade) continue;

    if (opts.region !== undefined && !inRegion(midpoint(e), opts.region)) continue;

    const ent = e.entity;
    if (ent === "LINE" && e.start && e.end) {
      const lenM = dist(e.start, e.end) * toM;
      if (lenM <= maxSeg) lengthByTrade.set(trade, (lengthByTrade.get(trade) ?? 0) + lenM);
    } else if (ent === "LWPOLYLINE" && e.points && e.points.length > 1) {
      // Filter per-segment so a polyline border doesn't sneak through in bulk.
      let len = 0;
      for (let i = 1; i < e.points.length; i++) {
        const s = dist(e.points[i - 1]!, e.points[i]!) * toM;
        if (s <= maxSeg) len += s;
      }
      lengthByTrade.set(trade, (lengthByTrade.get(trade) ?? 0) + len);
    } else if (ent === "INSERT") {
      countByTrade.set(trade, (countByTrade.get(trade) ?? 0) + 1);
    }
  }

  const items: TakeoffItem[] = [];

  const wallLen = lengthByTrade.get("walls") ?? 0;
  if (wallLen > 0) {
    // Double-line walls: plans draw each wall as 2 parallel lines, so raw line
    // length roughly double-counts the wall run. Halve to approximate centreline.
    const centreline = wallLen / 2;
    items.push({
      trade: "walls",
      layer: "walls/WALL",
      description: "Wall blockwork (assumed 225mm sandcrete block)",
      quantity: round2(centreline * opts.wallHeightM),
      unit: "m2",
      basis: `${round2(centreline)} m centreline wall (halved from ${round2(wallLen)} m raw line length) x ${opts.wallHeightM} m height`,
      assumptions: [`wall height ${opts.wallHeightM} m`, "225mm sandcrete blockwork", "double-line walls halved to centreline"],
    });
  }

  for (const trade of ["columns", "doors", "windows"]) {
    const n = countByTrade.get(trade) ?? 0;
    if (n > 0) {
      items.push({
        trade,
        layer: trade,
        description:
          trade === "columns" ? "Structural columns (count)" : trade === "doors" ? "Doors (count from blocks)" : "Windows (count from blocks)",
        quantity: n,
        unit: "nr",
        basis: `${n} block insertions on ${trade} layer`,
        assumptions: ["count = number of block references; verify against schedule"],
      });
    }
  }

  return items;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
