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
  // fields the SVG renderer and the register read; all optional because
  // dwgread only emits what each entity type carries
  entmode?: number;
  ownerhandle?: number[];
  flag?: number;
  text_value?: string;
  text?: string;
  ins_pt?: number[];
  height?: number;
  scale?: number[];
  rotation?: number;
  block_header?: number[];
  start_angle?: number;
  end_angle?: number;
  // read by the geometry document builder
  color?: number;
  linewt?: number;
  tag?: string;
  user_text?: string;
  blkisxref?: number | boolean;
  xref?: number[] | null;
  // set on a model-space INSERT by the expansion pass: its ATTRIB values by tag
  attributes?: Record<string, string>;
  // set on an entity the expansion pass placed from a block: the INSERT it came from
  insertHandle?: number;
}

// The subset of the DWG header the geometry document reads: declared units
// and the model-space extents.
export interface DwgHeader {
  INSUNITS?: number | null;
  MEASUREMENT?: number | null;
  DIMLFAC?: number | null;
  EXTMIN?: number[] | null;
  EXTMAX?: number[] | null;
}

export interface DwgBlock {
  handle: number;
  name: string;
  // indices into doc.entities of the entities owned by this block definition
  members: number[];
}

export interface DwgDoc {
  entities: DwgEntity[];
  layerName(e: DwgEntity): string;
  // drawing header variables as dwgread emits them ($INSUNITS etc.), when present;
  // typed for the fields the geometry document reads, open for everything else
  header?: DwgHeader & Record<string, unknown>;
  // block definitions by header handle; model and paper space are blocks too
  blocks?: Map<number, DwgBlock>;
  modelSpaceHandle?: number | null;
}

export interface Calibration {
  scaleToMm: number;
  confidence: number;
  samples: number;
}

function lastRef(ref: number[] | undefined): number | null {
  return ref && ref.length ? (ref[ref.length - 1] ?? null) : null;
}

/** Absolute object handle, the stable id every quantity can cite. */
export const handleOf = (e: DwgEntity): number | null => lastRef(e.handle);
export const ownerOf = (e: DwgEntity): number | null => lastRef(e.ownerhandle);
export const blockRefOf = (e: DwgEntity): number | null => lastRef(e.block_header);

const MODEL_SPACE = 2;

/**
 * Model space only. Block definitions (entmode 0, owned by a BLOCK_HEADER) and
 * paper space (entmode 1) are drawn by the renderer but must never be measured:
 * a door block's own geometry sits at the block origin, and a title block is
 * not a wall.
 */
export function isModelSpace(doc: DwgDoc, e: DwgEntity): boolean {
  if (!e.entity) return false;
  if (e.entmode === MODEL_SPACE) return true;
  const owner = ownerOf(e);
  return owner !== null && doc.modelSpaceHandle != null && owner === doc.modelSpaceHandle;
}

/** Entities owned by the block an INSERT references, or none. */
export function blockMembers(doc: DwgDoc, insert: DwgEntity): number[] {
  const ref = blockRefOf(insert);
  if (ref === null) return [];
  return doc.blocks?.get(ref)?.members ?? [];
}

export function blockNameOf(doc: DwgDoc, insert: DwgEntity): string | null {
  const ref = blockRefOf(insert);
  return ref === null ? null : (doc.blocks?.get(ref)?.name ?? null);
}

/** Build the derived views (layer names, blocks, model space) over a raw entity list. */
export function buildDoc(entities: DwgEntity[], header?: Record<string, unknown>): DwgDoc {
  const names = new Map<number, string>();
  const blocks = new Map<number, DwgBlock>();
  let modelSpaceHandle: number | null = null;
  for (const e of entities) {
    if (e.object === "LAYER" && e.name) {
      const h = lastRef(e.handle);
      if (h !== null) names.set(h, e.name);
    }
    if (e.object === "BLOCK_HEADER" && e.name) {
      const h = lastRef(e.handle);
      if (h !== null) {
        blocks.set(h, { handle: h, name: e.name, members: [] });
        if (/^\*model_space$/i.test(e.name)) modelSpaceHandle = h;
      }
    }
  }
  entities.forEach((e, i) => {
    if (!e.entity || e.entmode !== 0) return;
    const owner = lastRef(e.ownerhandle);
    if (owner === null) return;
    blocks.get(owner)?.members.push(i);
  });
  return {
    entities,
    header,
    blocks,
    modelSpaceHandle,
    layerName: (e) => (lastRef(e.layer) !== null && names.get(lastRef(e.layer)!)) || "0",
  };
}

export async function parseDwgToJson(dwgPath: string): Promise<DwgDoc> {
  const tmp = path.join(os.tmpdir(), `${generateId("tko")}.json`);
  try {
    await run("dwgread", ["-O", "JSON", "-o", tmp, dwgPath], { maxBuffer: 64 * 1024 * 1024 });
    const raw = await fs.readFile(tmp, "utf8");
    const parsed = JSON.parse(raw) as { OBJECTS?: DwgEntity[]; HEADER?: Record<string, unknown> };
    return buildDoc(parsed.OBJECTS ?? [], parsed.HEADER);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export function centroid(e: DwgEntity): [number, number] | null {
  if (e.start && e.end) return [(e.start[0]! + e.end[0]!) / 2, (e.start[1]! + e.end[1]!) / 2];
  if (e.center) return [e.center[0]!, e.center[1]!];
  // inserts and text sit at their insertion point; without this a block
  // reference is invisible to clustering and to every count that depends on it
  if (e.ins_pt) return [e.ins_pt[0]!, e.ins_pt[1]!];
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

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Axis-aligned extent of an entity's own geometry (inserts: the insertion point). */
export function extentOf(e: DwgEntity): Extent | null {
  const pts: number[][] = [];
  if (e.start && e.end) pts.push(e.start, e.end);
  else if (e.points?.length) pts.push(...e.points);
  else if (e.center && e.radius !== undefined) {
    pts.push([e.center[0]! - e.radius, e.center[1]! - e.radius], [e.center[0]! + e.radius, e.center[1]! + e.radius]);
  } else if (e.ins_pt) pts.push(e.ins_pt);
  if (!pts.length) return null;
  const ext: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    ext.minX = Math.min(ext.minX, p[0]!);
    ext.maxX = Math.max(ext.maxX, p[0]!);
    ext.minY = Math.min(ext.minY, p[1]!);
    ext.maxY = Math.max(ext.maxY, p[1]!);
  }
  return ext;
}

// MTEXT carries inline formatting codes such as \A1; \P (newline) \fArial|b0; {…}
export const textOf = (e: DwgEntity): string | null => {
  const raw = e.entity === "TEXT" || e.entity === "ATTRIB" ? e.text_value : e.entity === "MTEXT" ? e.text : undefined;
  if (!raw) return null;
  const clean = e.entity === "MTEXT" ? raw.replace(/\\[A-Za-z][^;]*;/g, "").replace(/\\P/g, " ").replace(/[{}]/g, "") : raw;
  const trimmed = clean.trim();
  return trimmed.length ? trimmed : null;
};

// Kept for the benchmark harness and old callers. `act_measurement` is derived
// by LibreDWG from the same geometry as the extension points, so this ratio is
// 1 on any consistent drawing and says nothing about units. See units.ts.
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
