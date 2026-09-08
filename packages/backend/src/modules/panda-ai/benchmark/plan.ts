import type { Arc, Dimension, Line, Polyline, Primitive, Text, TruthElement, TruthRoom } from "./types.ts";

// A floor plan is a grid of rooms. Column widths and row depths define the
// wall centrelines; every wall is drawn as two parallel lines the way a CAD
// operator draws a 225 mm block wall, with openings cut out and jambed.
// Everything is in millimetres, y up, origin at the outside face corner.

export interface PlanSpec {
  id: string;
  title: string;
  level: string | null;
  colWidths: number[]; // centreline-to-centreline bay widths
  rowDepths: number[];
  names: string[][]; // names[row][col], row 0 at the bottom
  externalMm: number;
  internalMm: number;
  // interior grid edges with no door: "v:c:r" (vertical wall right of col c in row r) or "h:c:r" (wall above row r in col c)
  solid: string[];
  // rooms (row,col) that get a sanitary fitting
  sanitary: Array<[number, number]>;
  columns: boolean;
  storeyHeightM: number;
  doorMm?: number;
  windowMm?: number;
  windowHeadMm?: number;
  doorHeadMm?: number;
}

export interface OpeningStyleHooks {
  door: (id: string, x: number, y: number, rotationDeg: number, widthMm: number) => Primitive[];
  window: (id: string, x: number, y: number, rotationDeg: number, widthMm: number) => Primitive[];
  sanitary: (id: string, x: number, y: number) => Primitive[];
}

export interface PlanResult {
  primitives: Primitive[];
  rooms: TruthRoom[];
  elements: TruthElement[];
  widthMm: number;
  depthMm: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

let seq = 0;
const nid = (prefix: string) => `${prefix}_${++seq}`;

interface WallSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  external: boolean;
  openings: { at: number; width: number; kind: "door" | "window" }[];
}

// Draw one wall centreline segment as two faces plus jambs, leaving gaps for openings.
function drawWall(seg: WallSeg, out: Primitive[], ids: string[]): void {
  const horizontal = seg.y1 === seg.y2;
  const len = horizontal ? Math.abs(seg.x2 - seg.x1) : Math.abs(seg.y2 - seg.y1);
  const lo = horizontal ? Math.min(seg.x1, seg.x2) : Math.min(seg.y1, seg.y2);
  const fixed = horizontal ? seg.y1 : seg.x1;
  const t = seg.thickness / 2;
  // pieces between openings, in the wall's own axis
  const cuts = seg.openings.map((o) => [o.at - o.width / 2, o.at + o.width / 2] as const).sort((a, b) => a[0] - b[0]);
  const pieces: Array<[number, number]> = [];
  let cursor = 0;
  for (const [a, b] of cuts) {
    if (a > cursor) pieces.push([cursor, a]);
    cursor = b;
  }
  if (cursor < len) pieces.push([cursor, len]);
  for (const [a, b] of pieces) {
    for (const side of [-t, t]) {
      const id = nid("wl");
      ids.push(id);
      const line: Line = horizontal
        ? { kind: "line", id, layer: "wall", x1: lo + a, y1: fixed + side, x2: lo + b, y2: fixed + side, heavy: true }
        : { kind: "line", id, layer: "wall", x1: fixed + side, y1: lo + a, x2: fixed + side, y2: lo + b, heavy: true };
      out.push(line);
    }
  }
  // jambs close the wall at each opening edge
  for (const [a, b] of cuts) {
    for (const p of [a, b]) {
      const id = nid("wj");
      const line: Line = horizontal
        ? { kind: "line", id, layer: "wall", x1: lo + p, y1: fixed - t, x2: lo + p, y2: fixed + t, heavy: true }
        : { kind: "line", id, layer: "wall", x1: fixed - t, y1: lo + p, x2: fixed + t, y2: lo + p, heavy: true };
      out.push(line);
    }
  }
}

export function buildPlan(spec: PlanSpec, hooks: OpeningStyleHooks): PlanResult {
  const doorMm = spec.doorMm ?? 900;
  const windowMm = spec.windowMm ?? 1200;
  const cols = spec.colWidths.length;
  const rows = spec.rowDepths.length;
  const xs = [0, ...spec.colWidths.map((_, i) => sum(spec.colWidths.slice(0, i + 1)))];
  const ys = [0, ...spec.rowDepths.map((_, i) => sum(spec.rowDepths.slice(0, i + 1)))];
  const width = xs[cols]!;
  const depth = ys[rows]!;
  const out: Primitive[] = [];
  const rooms: TruthRoom[] = [];
  const elements: TruthElement[] = [];
  const extIds: string[] = [];
  const intIds: string[] = [];
  const doorIds: string[] = [];
  const windowIds: string[] = [];
  const columnIds: string[] = [];
  const sanitaryIds: string[] = [];
  const isSolid = (key: string) => spec.solid.includes(key);
  const doorHead = spec.doorHeadMm ?? 2100;
  const windowHead = spec.windowHeadMm ?? 1200;
  let doorCount = 0;
  let windowCount = 0;

  // external walls: one segment per bay so each room gets its own window
  const external: WallSeg[] = [];
  for (let c = 0; c < cols; c++) {
    external.push({ x1: xs[c]!, y1: 0, x2: xs[c + 1]!, y2: 0, thickness: spec.externalMm, external: true, openings: [] });
    external.push({ x1: xs[c]!, y1: depth, x2: xs[c + 1]!, y2: depth, thickness: spec.externalMm, external: true, openings: [] });
  }
  for (let r = 0; r < rows; r++) {
    external.push({ x1: 0, y1: ys[r]!, x2: 0, y2: ys[r + 1]!, thickness: spec.externalMm, external: true, openings: [] });
    external.push({ x1: width, y1: ys[r]!, x2: width, y2: ys[r + 1]!, thickness: spec.externalMm, external: true, openings: [] });
  }
  for (const seg of external) {
    const horizontal = seg.y1 === seg.y2;
    const len = horizontal ? seg.x2 - seg.x1 : seg.y2 - seg.y1;
    seg.openings.push({ at: len / 2, width: windowMm, kind: "window" });
    windowCount++;
    const id = nid("win");
    windowIds.push(id);
    const cx = horizontal ? seg.x1 + len / 2 : seg.x1;
    const cy = horizontal ? seg.y1 : seg.y1 + len / 2;
    out.push(...hooks.window(id, cx, cy, horizontal ? 0 : 90, windowMm));
  }

  // internal walls on interior grid lines, one segment per cell edge
  const internal: WallSeg[] = [];
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const seg: WallSeg = { x1: xs[c]!, y1: ys[r]!, x2: xs[c]!, y2: ys[r + 1]!, thickness: spec.internalMm, external: false, openings: [] };
      if (!isSolid(`v:${c - 1}:${r}`)) {
        const len = seg.y2 - seg.y1;
        seg.openings.push({ at: len / 2, width: doorMm, kind: "door" });
        doorCount++;
        const id = nid("door");
        doorIds.push(id);
        out.push(...hooks.door(id, seg.x1, seg.y1 + len / 2, 90, doorMm));
      }
      internal.push(seg);
    }
  }
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seg: WallSeg = { x1: xs[c]!, y1: ys[r]!, x2: xs[c + 1]!, y2: ys[r]!, thickness: spec.internalMm, external: false, openings: [] };
      if (!isSolid(`h:${c}:${r - 1}`)) {
        const len = seg.x2 - seg.x1;
        seg.openings.push({ at: len / 2, width: doorMm, kind: "door" });
        doorCount++;
        const id = nid("door");
        doorIds.push(id);
        out.push(...hooks.door(id, seg.x1 + len / 2, seg.y1, 0, doorMm));
      }
      internal.push(seg);
    }
  }
  for (const seg of external) drawWall(seg, out, extIds);
  for (const seg of internal) drawWall(seg, out, intIds);

  // columns at every grid intersection, 230 square, closed outline
  if (spec.columns) {
    for (const x of xs) {
      for (const y of ys) {
        const id = nid("col");
        columnIds.push(id);
        const h = 115;
        const poly: Polyline = { kind: "polyline", id, layer: "column", closed: true, points: [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]] };
        out.push(poly);
      }
    }
  }

  // rooms: net internal rectangles and their labels
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = spec.names[r]?.[c] ?? `ROOM ${r + 1}-${c + 1}`;
      const left = xs[c]! + (c === 0 ? spec.externalMm : spec.internalMm) / 2;
      const right = xs[c + 1]! - (c === cols - 1 ? spec.externalMm : spec.internalMm) / 2;
      const bottom = ys[r]! + (r === 0 ? spec.externalMm : spec.internalMm) / 2;
      const top = ys[r + 1]! - (r === rows - 1 ? spec.externalMm : spec.internalMm) / 2;
      const w = right - left;
      const d = top - bottom;
      rooms.push({ name, areaM2: r2((w * d) / 1e6), perimeterM: r2((2 * (w + d)) / 1000), sheet: spec.id });
      const label: Text = { kind: "text", id: nid("lbl"), layer: "text", x: (left + right) / 2 - 500, y: (bottom + top) / 2, height: 250, text: name };
      out.push(label);
      if (spec.sanitary.some(([sr, sc]) => sr === r && sc === c)) {
        const id = nid("san");
        sanitaryIds.push(id);
        out.push(...hooks.sanitary(id, left + 600, top - 600));
      }
    }
  }

  // dimensions: overall along the bottom and left, bay widths along the top
  const dims: Dimension[] = [
    { kind: "dimension", id: nid("dim"), layer: "dim", x1: 0, y1: 0, x2: width, y2: 0, offset: -1800, value: width },
    { kind: "dimension", id: nid("dim"), layer: "dim", x1: 0, y1: 0, x2: 0, y2: depth, offset: -1800, value: depth },
  ];
  for (let c = 0; c < cols; c++) {
    dims.push({ kind: "dimension", id: nid("dim"), layer: "dim", x1: xs[c]!, y1: depth, x2: xs[c + 1]!, y2: depth, offset: 1200, value: spec.colWidths[c]! });
  }
  for (let r = 0; r < rows; r++) {
    dims.push({ kind: "dimension", id: nid("dim"), layer: "dim", x1: width, y1: ys[r]!, x2: width, y2: ys[r + 1]!, offset: 1200, value: spec.rowDepths[r]! });
  }
  out.push(...dims);

  // title and level
  out.push({ kind: "text", id: nid("ttl"), layer: "text", x: 0, y: -3200, height: 450, text: spec.title });
  if (spec.level) out.push({ kind: "text", id: nid("lvl"), layer: "text", x: width + 2600, y: depth / 2, height: 300, text: spec.level });

  // truth: walls gross and net
  const height = spec.storeyHeightM;
  const extLen = sum(external.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1))) / 1000;
  const intLen = sum(internal.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1))) / 1000;
  const windowArea = (windowCount * windowMm * windowHead) / 1e6;
  const doorArea = (doorCount * doorMm * doorHead) / 1e6;
  elements.push({ element: "walls-external", sheet: spec.id, lengthM: r2(extLen), areaM2: r2(extLen * height - windowArea), thicknessMm: spec.externalMm, heightM: height, ids: extIds });
  elements.push({ element: "walls-internal", sheet: spec.id, lengthM: r2(intLen), areaM2: r2(intLen * height - doorArea), thicknessMm: spec.internalMm, heightM: height, ids: intIds });
  elements.push({ element: "doors", sheet: spec.id, count: doorCount, ids: doorIds });
  elements.push({ element: "windows", sheet: spec.id, count: windowCount, ids: windowIds });
  if (spec.columns) elements.push({ element: "columns", sheet: spec.id, count: columnIds.length, ids: columnIds });
  if (sanitaryIds.length) elements.push({ element: "sanitary", sheet: spec.id, count: sanitaryIds.length, ids: sanitaryIds });
  elements.push({ element: "floor-area", sheet: spec.id, areaM2: r2(sum(rooms.map((r) => r.areaM2))), ids: rooms.map((r) => r.name) });

  return { primitives: out, rooms, elements, widthMm: width, depthMm: depth };
}

// The two ways a CAD operator draws an opening: inline geometry, or a block.
export const INLINE_OPENINGS: OpeningStyleHooks = {
  door: (id, x, y, rot, w) => {
    const arc: Arc = rot === 0
      ? { kind: "arc", id, layer: "door", cx: x - w / 2, cy: y, r: w, startDeg: 0, endDeg: 90 }
      : { kind: "arc", id, layer: "door", cx: x, cy: y - w / 2, r: w, startDeg: 90, endDeg: 180 };
    const leaf: Line = rot === 0
      ? { kind: "line", id: `${id}_leaf`, layer: "door", x1: x - w / 2, y1: y, x2: x - w / 2, y2: y + w }
      : { kind: "line", id: `${id}_leaf`, layer: "door", x1: x, y1: y - w / 2, x2: x - w, y2: y - w / 2 };
    return [arc, leaf];
  },
  window: (id, x, y, rot, w) => {
    const half = w / 2;
    const t = 60;
    const pts = rot === 0
      ? [[x - half, y - t], [x + half, y - t], [x + half, y + t], [x - half, y + t]]
      : [[x - t, y - half], [x + t, y - half], [x + t, y + half], [x - t, y + half]];
    const poly: Polyline = { kind: "polyline", id, layer: "window", closed: true, points: pts };
    return [poly];
  },
  sanitary: (id, x, y) => [{ kind: "polyline", id, layer: "sanitary", closed: true, points: [[x - 200, y - 300], [x + 200, y - 300], [x + 200, y + 300], [x - 200, y + 300]] }],
};

export const BLOCK_OPENINGS: OpeningStyleHooks = {
  door: (id, x, y, rot) => [{ kind: "insert", id, layer: "door", block: "DOOR-900", x, y, rotationDeg: rot }],
  window: (id, x, y, rot) => [{ kind: "insert", id, layer: "window", block: "WIN-1200", x, y, rotationDeg: rot }],
  sanitary: (id, x, y) => [{ kind: "insert", id, layer: "sanitary", block: "WC-STD", x, y, rotationDeg: 0 }],
};

export function resetIds(): void {
  seq = 0;
}
