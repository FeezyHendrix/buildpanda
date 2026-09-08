import { buildDoc, type DwgDoc, type DwgEntity } from "./dwg.ts";

// Synthetic DwgDoc builder for the engine's tests: a model space, named
// layers, block definitions and entities in the shape LibreDWG emits them
// (handles as ref arrays, layer as a ref to the LAYER object).

const MODEL_SPACE = 10;
const PAPER_SPACE = 11;

export interface InsertOptions {
  scale?: number[];
  rotation?: number;
  // ATTRIB entities owned by the insert, tag → value
  attributes?: Record<string, string>;
}

// a block member may name its own layer; without one it sits on layer 0
export type BlockMember = DwgEntity & { layerName?: string };

export interface Synth {
  doc: () => DwgDoc;
  layer: (name: string) => number;
  block: (name: string, members: BlockMember[]) => number;
  line: (layer: string, a: number[], b: number[], opts?: { paper?: boolean }) => number;
  poly: (layer: string, points: number[][], closed?: boolean) => number;
  rect: (layer: string, x: number, y: number, w: number, h: number) => number;
  arc: (layer: string, center: number[], radius: number, start: number, end: number) => number;
  circle: (layer: string, center: number[], radius: number) => number;
  text: (layer: string, at: number[], value: string, height?: number) => number;
  mtext: (layer: string, at: number[], value: string, height?: number) => number;
  insert: (layer: string, block: number, at: number[], opts?: InsertOptions) => number;
  dim: (layer: string, measurement: number, userText?: string) => number;
  header: (h: Record<string, unknown>) => void;
}

export function synth(): Synth {
  const entities: DwgEntity[] = [];
  const layers = new Map<string, number>();
  let next = 100;
  let header: Record<string, unknown> | undefined;
  const handle = () => [5, 1, next, next++];
  entities.push({ object: "BLOCK_HEADER", name: "*Model_Space", handle: [5, 1, MODEL_SPACE, MODEL_SPACE] });
  entities.push({ object: "BLOCK_HEADER", name: "*Paper_Space", handle: [5, 1, PAPER_SPACE, PAPER_SPACE] });
  const layer = (name: string): number => {
    const known = layers.get(name);
    if (known !== undefined) return known;
    const h = next++;
    layers.set(name, h);
    entities.push({ object: "LAYER", name, handle: [5, 1, h, h] });
    return h;
  };
  const push = (e: DwgEntity, layerName: string, paper = false): number => {
    const h = handle();
    const l = layer(layerName);
    const owner = paper ? PAPER_SPACE : MODEL_SPACE;
    entities.push({ ...e, handle: h, layer: [5, 1, l, l], entmode: paper ? 1 : 2, ownerhandle: [4, 1, owner, owner] });
    return h[2]!;
  };
  return {
    doc: () => buildDoc(entities, header),
    layer,
    block: (name, members) => {
      const h = next++;
      entities.push({ object: "BLOCK_HEADER", name, handle: [5, 1, h, h] });
      for (const { layerName, ...m } of members) {
        const mh = handle();
        const l = layer(layerName ?? "0");
        entities.push({ ...m, handle: mh, layer: [5, 1, l, l], entmode: 0, ownerhandle: [4, 1, h, h] });
      }
      return h;
    },
    line: (l, a, b, opts) => push({ entity: "LINE", start: a, end: b }, l, opts?.paper),
    poly: (l, points, closed = false) => push({ entity: "LWPOLYLINE", points, flag: closed ? 512 : 0 }, l),
    rect: (l, x, y, w, h) =>
      push({ entity: "LWPOLYLINE", points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], flag: 512 }, l),
    arc: (l, center, radius, start, end) => push({ entity: "ARC", center, radius, start_angle: start, end_angle: end }, l),
    circle: (l, center, radius) => push({ entity: "CIRCLE", center, radius }, l),
    text: (l, at, value, height = 250) => push({ entity: "TEXT", ins_pt: at, text_value: value, height }, l),
    mtext: (l, at, value, height = 250) => push({ entity: "MTEXT", ins_pt: at, text: value, height }, l),
    insert: (l, block, at, opts) => {
      const h = push({ entity: "INSERT", ins_pt: at, block_header: [5, 1, block, block], scale: opts?.scale ?? [1, 1, 1], rotation: opts?.rotation ?? 0 }, l);
      for (const [tag, value] of Object.entries(opts?.attributes ?? {})) {
        const ah = handle();
        const tl = layer("TEXT");
        entities.push({ entity: "ATTRIB", tag, text_value: value, ins_pt: at, height: 200, handle: ah, layer: [5, 1, tl, tl], entmode: 0, ownerhandle: [8, 1, h, h] });
      }
      return h;
    },
    dim: (l, measurement, userText) => push({ entity: "DIMENSION_LINEAR", act_measurement: measurement, ins_pt: [0, 0], ...(userText ? { user_text: userText } : {}) }, l),
    header: (h) => {
      header = h;
    },
  };
}

// the four sides of a rectangle as wall-layer lines no longer than 1.5 m
function faces(s: Synth, x: number, y: number, w: number, h: number): void {
  const side = (a: number[], b: number[]) => {
    const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    const n = Math.ceil(len / 1500);
    for (let i = 0; i < n; i++) {
      const p = [a[0]! + ((b[0]! - a[0]!) * i) / n, a[1]! + ((b[1]! - a[1]!) * i) / n];
      const q = [a[0]! + ((b[0]! - a[0]!) * (i + 1)) / n, a[1]! + ((b[1]! - a[1]!) * (i + 1)) / n];
      s.line("WALL", p, q);
    }
  };
  side([x, y], [x + w, y]);
  side([x + w, y], [x + w, y + h]);
  side([x + w, y + h], [x, y + h]);
  side([x, y + h], [x, y]);
}

/**
 * A small two-storey building: a 12 × 8 m plan with 230 mm walls drawn as
 * paired faces, four columns, three doors, two windows, two labelled rooms,
 * a level mark and a title; a second identical plan at +3000 beside it and
 * an elevation with the level stack. Distances are millimetres.
 */
export function smallBuilding(s: Synth, opts: { floors?: number; storeyMm?: number } = {}): void {
  const floors = opts.floors ?? 2;
  const storey = opts.storeyMm ?? 3000;
  s.header({ INSUNITS: 4 });
  for (let f = 0; f < floors; f++) {
    const ox = f * 20000;
    const level = 450 + f * storey;
    // outer wall faces 230 apart, drawn in 1.5 m pieces as a CAD wall usually is
    faces(s, ox, 0, 12000, 8000);
    faces(s, ox + 230, 230, 11540, 7540);
    // an internal wall with two faces, a 900 gap for the door
    s.line("WALL", [ox + 6000, 230], [ox + 6000, 3000]);
    s.line("WALL", [ox + 6230, 230], [ox + 6230, 3000]);
    s.line("WALL", [ox + 6000, 3900], [ox + 6000, 7770]);
    s.line("WALL", [ox + 6230, 3900], [ox + 6230, 7770]);
    // a nib wall in the lounge, two faces
    s.line("WALL", [ox + 6230, 5500], [ox + 9000, 5500]);
    s.line("WALL", [ox + 6230, 5730], [ox + 9000, 5730]);
    const corners: [number, number][] = [
      [0, 0],
      [11700, 0],
      [0, 7700],
      [11700, 7700],
    ];
    for (const [cx, cy] of corners) s.rect("COLUMN", ox + cx, cy, 300, 300);
    // doors: leaf outline plus swing arc
    const doors: [number, number][] = [
      [6000, 3000],
      [3000, 0],
      [9000, 0],
    ];
    for (const [dx, dy] of doors) {
      s.rect("DOOR", ox + dx, dy, 50, 900);
      s.arc("DOOR", [ox + dx, dy], 900, 0, Math.PI / 2);
    }
    // six windows: three on the south wall, three on the north
    for (const wx of [1500, 4500, 8500]) {
      s.rect("WIND", ox + wx, 0, 1200, 230);
      s.rect("WIND", ox + wx, 7770, 1200, 230);
    }
    s.text("TEXT", [ox + 2000, 4000], "BEDROOM");
    s.text("TEXT", [ox + 8000, 4000], "LOUNGE");
    s.text("level", [ox + 2000, 5000], `+${level}`);
    s.text("TEXT", [ox + 4000, -2500], f === 0 ? "GROUND FLOOR PLAN" : `${f}${f === 1 ? "ST" : f === 2 ? "ND" : "TH"} FLOOR PLAN`);
    for (let d = 0; d < 20; d++) s.dim("DIM", 900 + d * 100);
  }
  // an elevation beside the plans: a 12 m wide face, storeys stacked, level marks down one side
  const ex = floors * 20000;
  const height = 450 + floors * storey;
  s.rect("WALL", ex, 0, 12000, height);
  for (let f = 0; f <= floors; f++) s.line("WALL", [ex, 450 + f * storey], [ex + 12000, 450 + f * storey]);
  // windows as frame, pane and sill so an elevation clusters like a real one
  for (let f = 0; f < floors; f++) {
    for (let w = 0; w < 4; w++) {
      const wx = ex + 1000 + w * 2800;
      const wy = 1350 + f * storey;
      s.rect("WIND", wx, wy, 1200, 1200);
      s.rect("WIND", wx + 100, wy + 100, 1000, 1000);
      s.line("WALL", [wx - 100, wy], [wx + 1300, wy]);
    }
  }
  for (let f = 0; f <= floors; f++) s.text("level", [ex - 3000, 450 + f * storey], `+${450 + f * storey}${f === 0 ? " GROUND FLOOR LEVEL" : ""}`);
  s.text("TEXT", [ex + 4000, -2500], "NORTH VIEW");
}
