import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { generateId } from "../../../lib/ids.ts";

const run = promisify(execFile);

export interface DwgEntity {
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
  act_measurement?: number;
  xline1_pt?: number[];
  xline2_pt?: number[];
}

export interface DwgDoc {
  entities: DwgEntity[];
  layerName(e: DwgEntity): string;
}

export interface Calibration {
  scaleToMm: number;
  confidence: number;
  samples: number;
}

function lastRef(ref: number[] | undefined): number | null {
  return ref && ref.length ? (ref[ref.length - 1] ?? null) : null;
}

export async function parseDwgToJson(dwgPath: string): Promise<DwgDoc> {
  const tmp = path.join(os.tmpdir(), `${generateId("tko")}.json`);
  try {
    await run("dwgread", ["-O", "JSON", "-o", tmp, dwgPath]);
    const raw = await fs.readFile(tmp, "utf8");
    const parsed = JSON.parse(raw) as { OBJECTS?: DwgEntity[] };
    const entities = parsed.OBJECTS ?? [];
    const names = new Map<number, string>();
    for (const e of entities) {
      if (e.object === "LAYER" && e.name) {
        const h = lastRef(e.handle);
        if (h !== null) names.set(h, e.name);
      }
    }
    return {
      entities,
      layerName: (e) => (lastRef(e.layer) !== null && names.get(lastRef(e.layer)!)) || "0",
    };
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export function centroid(e: DwgEntity): [number, number] | null {
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

// Derive the model->mm scale by comparing each linear dimension's annotated
// value to the geometric span of its extension points. Median ratio is the
// scale; the share clustering near it is the confidence that the drawing is
// dimensioned consistently enough to measure from.
export function calibrate(doc: DwgDoc): Calibration {
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
  const median = ratios[ratios.length >> 1]!;
  const near = ratios.filter((r) => Math.abs(r - median) / median < 0.02).length;
  return { scaleToMm: median, confidence: near / ratios.length, samples: ratios.length };
}
