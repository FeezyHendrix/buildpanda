import type { Hatch, Line, Primitive, WallStyle } from "./types.ts";

// The ways a CAD operator draws one wall between two openings. The truth is
// the same in every style; only the primitives differ.

export interface WallSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  external: boolean;
  openings: { at: number; width: number; kind: "door" | "window" }[];
}

export interface WallDrawContext {
  style: WallStyle;
  nid: (prefix: string) => string;
}

const SPLIT_MIN_MM = 1500;
const SPLIT_MAX_MM = 3000;
const HATCH_PITCH_MM = 150;

// Solid pieces of wall between the openings, in the wall's own axis.
function pieces(seg: WallSeg): { pieces: Array<[number, number]>; cuts: Array<readonly [number, number]>; len: number } {
  const horizontal = seg.y1 === seg.y2;
  const len = horizontal ? Math.abs(seg.x2 - seg.x1) : Math.abs(seg.y2 - seg.y1);
  const cuts = seg.openings.map((o) => [o.at - o.width / 2, o.at + o.width / 2] as const).sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cursor = 0;
  for (const [a, b] of cuts) {
    if (a > cursor) out.push([cursor, a]);
    cursor = b;
  }
  if (cursor < len) out.push([cursor, len]);
  return { pieces: out, cuts, len };
}

// A deterministic jitter so regenerated fixtures are byte-identical.
function jitter(seed: number, k: number): number {
  const v = Math.abs(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
  const mm = 1 + Math.floor(v * 5); // 1–5 mm
  return k % 2 === 0 ? -mm : mm; // overlap, then gap, alternately
}

// Break one face into collinear chunks with millimetre overlaps and gaps at
// the joints, the way a face edited over several revisions ends up.
function splitFace(a: number, b: number, seed: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = a;
  let k = 0;
  while (b - start > SPLIT_MAX_MM) {
    const chunk = SPLIT_MIN_MM + (Math.abs(Math.sin(seed + k)) % 1) * (SPLIT_MAX_MM - SPLIT_MIN_MM);
    const end = start + chunk;
    out.push([start, end]);
    start = end + jitter(seed, k);
    k++;
  }
  out.push([start, b]);
  return out;
}

export function drawWall(seg: WallSeg, ctx: WallDrawContext, out: Primitive[], ids: string[]): void {
  const horizontal = seg.y1 === seg.y2;
  const lo = horizontal ? Math.min(seg.x1, seg.x2) : Math.min(seg.y1, seg.y2);
  const fixed = horizontal ? seg.y1 : seg.x1;
  const t = seg.thickness / 2;
  const { pieces: solid, cuts } = pieces(seg);
  const face = (a: number, b: number, side: number): Line => {
    const id = ctx.nid("wl");
    ids.push(id);
    return horizontal
      ? { kind: "line", id, layer: "wall", x1: lo + a, y1: fixed + side, x2: lo + b, y2: fixed + side, heavy: true }
      : { kind: "line", id, layer: "wall", x1: fixed + side, y1: lo + a, x2: fixed + side, y2: lo + b, heavy: true };
  };
  const across = (p: number, id: string, layer: Line["layer"] = "wall", heavy = true): Line =>
    horizontal
      ? { kind: "line", id, layer, x1: lo + p, y1: fixed - t, x2: lo + p, y2: fixed + t, heavy }
      : { kind: "line", id, layer, x1: fixed - t, y1: lo + p, x2: fixed + t, y2: lo + p, heavy };
  const seed = seg.x1 * 7 + seg.y1 * 13 + seg.x2 * 17 + seg.y2 * 19;

  for (const [a, b] of solid) {
    for (const side of [-t, t]) {
      // faces drawn in opposite directions, as they arrive from a real office
      const chunks = ctx.style === "split" ? splitFace(a, b, seed + side) : [[a, b] as [number, number]];
      for (const [p, q] of chunks) out.push(side < 0 ? face(p, q, side) : face(q, p, side));
    }
    if (ctx.style === "hatched") {
      const hatch: Hatch = {
        kind: "hatch",
        id: ctx.nid("wh"),
        layer: "hatch",
        points: horizontal
          ? [[lo + a, fixed - t], [lo + b, fixed - t], [lo + b, fixed + t], [lo + a, fixed + t]]
          : [[fixed - t, lo + a], [fixed + t, lo + a], [fixed + t, lo + b], [fixed - t, lo + b]],
      };
      out.push(hatch);
    }
    if (ctx.style === "hatched-exploded") {
      // 45° strokes across the wall, on the wall layer, as an exploded hatch leaves them
      for (let p = a; p + seg.thickness <= b; p += HATCH_PITCH_MM) {
        const id = ctx.nid("wx");
        out.push(
          horizontal
            ? { kind: "line", id, layer: "wall", x1: lo + p, y1: fixed - t, x2: lo + p + seg.thickness, y2: fixed + t }
            : { kind: "line", id, layer: "wall", x1: fixed - t, y1: lo + p, x2: fixed + t, y2: lo + p + seg.thickness },
        );
      }
    }
  }
  // jambs close the wall at each opening edge, unless the operator left them open
  if (ctx.style === "unjambed") return;
  for (const [a, b] of cuts) for (const p of [a, b]) out.push(across(p, ctx.nid("wj")));
}
