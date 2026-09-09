import { drawWall, type WallSeg } from "./plan-walls.ts";
import type { Arc, Dimension, Line, Polyline, Primitive, Text, TruthElement, TruthRoom, WallStyle } from "./types.ts";

// A floor plan is a grid of cells, some of which may be omitted to notch the
// footprint into an L. Every cell edge is a wall: external where one side is
// outside, internal where two cells meet. Walls are drawn as two faces in the
// chosen style, with openings cut out. Everything is in millimetres, y up,
// origin at the outside face corner of the bounding grid.

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
  // cells (row,col) that do not exist: the notch of an L-shaped plan
  omit?: Array<[number, number]>;
  columns: boolean;
  storeyHeightM: number;
  doorMm?: number;
  windowMm?: number;
  windowHeadMm?: number;
  doorHeadMm?: number;
}

export interface OpeningStyleHooks {
  door: (id: string, x: number, y: number, rotationDeg: number, widthMm: number) => Primitive[];
  window: (id: string, x: number, y: number, rotationDeg: number, widthMm: number, heightMm: number) => Primitive[];
  sanitary: (id: string, x: number, y: number) => Primitive[];
}

export interface PlanOptions {
  hooks: OpeningStyleHooks;
  walls: WallStyle;
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

interface Edge extends WallSeg {
  key: string; // solid key for internal edges
}

export function buildPlan(spec: PlanSpec, opts: PlanOptions): PlanResult {
  const { hooks } = opts;
  const doorMm = spec.doorMm ?? 900;
  const windowMm = spec.windowMm ?? 1200;
  const windowHead = spec.windowHeadMm ?? 1200;
  const doorHead = spec.doorHeadMm ?? 2100;
  const cols = spec.colWidths.length;
  const rows = spec.rowDepths.length;
  const xs = [0, ...spec.colWidths.map((_, i) => sum(spec.colWidths.slice(0, i + 1)))];
  const ys = [0, ...spec.rowDepths.map((_, i) => sum(spec.rowDepths.slice(0, i + 1)))];
  const width = xs[cols]!;
  const depth = ys[rows]!;
  const exists = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && !(spec.omit ?? []).some(([or, oc]) => or === r && oc === c);
  const out: Primitive[] = [];
  const rooms: TruthRoom[] = [];
  const elements: TruthElement[] = [];
  const ids = { ext: [] as string[], int: [] as string[], door: [] as string[], win: [] as string[], col: [] as string[], san: [] as string[] };
  const isSolid = (key: string) => spec.solid.includes(key);

  // every grid edge between an existing cell and its neighbour or the outside
  const external: Edge[] = [];
  const internal: Edge[] = [];
  const edge = (x1: number, y1: number, x2: number, y2: number, a: boolean, b: boolean, key: string) => {
    if (!a && !b) return;
    const ext = a !== b;
    const seg: Edge = { x1, y1, x2, y2, thickness: ext ? spec.externalMm : spec.internalMm, external: ext, openings: [], key };
    (ext ? external : internal).push(seg);
  };
  for (let c = 0; c <= cols; c++) for (let r = 0; r < rows; r++) edge(xs[c]!, ys[r]!, xs[c]!, ys[r + 1]!, exists(r, c - 1), exists(r, c), `v:${c - 1}:${r}`);
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) edge(xs[c]!, ys[r]!, xs[c + 1]!, ys[r]!, exists(r - 1, c), exists(r, c), `h:${c}:${r - 1}`);

  // one window per external bay, one door per internal edge unless solid
  for (const seg of external) {
    const horizontal = seg.y1 === seg.y2;
    const len = horizontal ? seg.x2 - seg.x1 : seg.y2 - seg.y1;
    seg.openings.push({ at: len / 2, width: windowMm, kind: "window" });
    const id = nid("win");
    ids.win.push(id);
    out.push(...hooks.window(id, horizontal ? seg.x1 + len / 2 : seg.x1, horizontal ? seg.y1 : seg.y1 + len / 2, horizontal ? 0 : 90, windowMm, windowHead));
  }
  for (const seg of internal) {
    if (isSolid(seg.key)) continue;
    const horizontal = seg.y1 === seg.y2;
    const len = horizontal ? seg.x2 - seg.x1 : seg.y2 - seg.y1;
    seg.openings.push({ at: len / 2, width: doorMm, kind: "door" });
    const id = nid("door");
    ids.door.push(id);
    out.push(...hooks.door(id, horizontal ? seg.x1 + len / 2 : seg.x1, horizontal ? seg.y1 : seg.y1 + len / 2, horizontal ? 0 : 90, doorMm));
  }
  const wallCtx = { style: opts.walls, nid };
  for (const seg of external) drawWall(seg, wallCtx, out, ids.ext);
  for (const seg of internal) drawWall(seg, wallCtx, out, ids.int);

  // columns at every grid intersection that touches a cell, 230 square
  if (spec.columns) {
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        if (![exists(j, i), exists(j - 1, i), exists(j, i - 1), exists(j - 1, i - 1)].some(Boolean)) continue;
        const id = nid("col");
        ids.col.push(id);
        const h = 115;
        const x = xs[i]!;
        const y = ys[j]!;
        const poly: Polyline = { kind: "polyline", id, layer: "column", closed: true, points: [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]] };
        out.push(poly);
      }
    }
  }

  // rooms: net internal rectangles inside whatever wall bounds each side
  const half = (nr: number, nc: number) => (exists(nr, nc) ? spec.internalMm : spec.externalMm) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!exists(r, c)) continue;
      const name = spec.names[r]?.[c] ?? `ROOM ${r + 1}-${c + 1}`;
      const left = xs[c]! + half(r, c - 1);
      const right = xs[c + 1]! - half(r, c + 1);
      const bottom = ys[r]! + half(r - 1, c);
      const top = ys[r + 1]! - half(r + 1, c);
      const w = right - left;
      const d = top - bottom;
      rooms.push({ name, areaM2: r2((w * d) / 1e6), perimeterM: r2((2 * (w + d)) / 1000), sheet: spec.id });
      const label: Text = { kind: "text", id: nid("lbl"), layer: "text", x: (left + right) / 2 - 500, y: (bottom + top) / 2, height: 250, text: name };
      out.push(label);
      if (spec.sanitary.some(([sr, sc]) => sr === r && sc === c)) {
        const id = nid("san");
        ids.san.push(id);
        out.push(...hooks.sanitary(id, left + 600, top - 600));
      }
    }
  }

  // dimensions: overall along the bottom and left, bays above each column's
  // topmost cell, rows beside each row's rightmost cell
  const topOf = (c: number) => ys[Math.max(...Array.from({ length: rows }, (_, r) => (exists(r, c) ? r + 1 : 0)))]!;
  const rightOf = (r: number) => xs[Math.max(...Array.from({ length: cols }, (_, c) => (exists(r, c) ? c + 1 : 0)))]!;
  const dims: Dimension[] = [
    { kind: "dimension", id: nid("dim"), layer: "dim", x1: 0, y1: 0, x2: rightOf(0), y2: 0, offset: -1800, value: rightOf(0) },
    { kind: "dimension", id: nid("dim"), layer: "dim", x1: 0, y1: 0, x2: 0, y2: topOf(0), offset: -1800, value: topOf(0) },
  ];
  for (let c = 0; c < cols; c++) dims.push({ kind: "dimension", id: nid("dim"), layer: "dim", x1: xs[c]!, y1: topOf(c), x2: xs[c + 1]!, y2: topOf(c), offset: 1200, value: spec.colWidths[c]! });
  for (let r = 0; r < rows; r++) dims.push({ kind: "dimension", id: nid("dim"), layer: "dim", x1: rightOf(r), y1: ys[r]!, x2: rightOf(r), y2: ys[r + 1]!, offset: 1200, value: spec.rowDepths[r]! });
  out.push(...dims);

  out.push({ kind: "text", id: nid("ttl"), layer: "text", x: 0, y: -3200, height: 450, text: spec.title });
  if (spec.level) out.push({ kind: "text", id: nid("lvl"), layer: "text", x: width + 2600, y: depth / 2, height: 300, text: spec.level });

  // truth: centreline lengths gross, areas net of the openings
  const height = spec.storeyHeightM;
  const lengthM = (segs: WallSeg[]) => sum(segs.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1))) / 1000;
  const extLen = lengthM(external);
  const intLen = lengthM(internal);
  const windowArea = (ids.win.length * windowMm * windowHead) / 1e6;
  const doorArea = (ids.door.length * doorMm * doorHead) / 1e6;
  elements.push({ element: "walls-external", sheet: spec.id, lengthM: r2(extLen), areaM2: r2(extLen * height - windowArea), thicknessMm: spec.externalMm, heightM: height, ids: ids.ext });
  elements.push({ element: "walls-internal", sheet: spec.id, lengthM: r2(intLen), areaM2: r2(intLen * height - doorArea), thicknessMm: spec.internalMm, heightM: height, ids: ids.int });
  elements.push({ element: "doors", sheet: spec.id, count: ids.door.length, ids: ids.door });
  elements.push({ element: "windows", sheet: spec.id, count: ids.win.length, ids: ids.win });
  if (spec.columns) elements.push({ element: "columns", sheet: spec.id, count: ids.col.length, ids: ids.col });
  if (ids.san.length) elements.push({ element: "sanitary", sheet: spec.id, count: ids.san.length, ids: ids.san });
  elements.push({ element: "floor-area", sheet: spec.id, areaM2: r2(sum(rooms.map((r) => r.areaM2))), ids: rooms.map((r) => r.name) });

  return { primitives: out, rooms, elements, widthMm: width, depthMm: depth };
}

// The ways a CAD operator draws an opening: inline geometry, a block, or a
// block carrying attributes (mark and size) with a schedule elsewhere.
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

// The DOOR and WINDOW blocks are drawn at the sizes the attributes state.
export const ATTRIB_OPENINGS: OpeningStyleHooks = {
  door: (id, x, y, rot, w) => [{ kind: "insert", id, layer: "door", block: "DOOR", x, y, rotationDeg: rot, attributes: { MARK: "D01", WIDTH: String(w) } }],
  window: (id, x, y, rot, w, h) => [{ kind: "insert", id, layer: "window", block: "WINDOW", x, y, rotationDeg: rot, attributes: { MARK: "W01", SIZE: `${w}x${h}` } }],
  sanitary: (id, x, y) => [{ kind: "insert", id, layer: "sanitary", block: "WC-STD", x, y, rotationDeg: 0 }],
};

export function resetIds(): void {
  seq = 0;
}
