import type { GeoOutline, SheetGeometry, SymbolMatchesResult } from "./types.ts";

// "Find symbol": the person boxes one symbol and gets every other one on the
// sheet. On a DWG a symbol is a block reference, so the INSERTs inside the
// box name it and every INSERT of that name is a match. On a PDF (or a DWG
// drawn without blocks) the closed outlines inside the box give a shape
// signature — vertex count, proportions and size within 10 % — and every
// outline with the same signature is a match.

const SIZE_TOLERANCE = 0.1;

type Rect = [number, number, number, number];

export interface SymbolMatchOptions {
  excludeSeed?: boolean;
}

interface Signature {
  n: number;
  ratio: number;
  size: number;
}

interface Shape {
  outline: GeoOutline;
  bbox: Rect;
  cx: number;
  cy: number;
  sig: Signature;
}

function normalise(rect: Rect): Rect {
  return [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
}

const inside = (r: Rect, x: number, y: number) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

function shape(outline: GeoOutline): Shape {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outline.vertices) {
    minX = Math.min(minX, x!);
    maxX = Math.max(maxX, x!);
    minY = Math.min(minY, y!);
    maxY = Math.max(maxY, y!);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const long = Math.max(w, h);
  const short = Math.max(Math.min(w, h), 1e-9);
  return {
    outline,
    bbox: [minX, minY, maxX, maxY],
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    // orientation-free: a door swing turned 90° is the same symbol
    sig: { n: outline.vertices.length, ratio: long / short, size: long },
  };
}

const within = (a: number, b: number) => Math.abs(a - b) <= SIZE_TOLERANCE * Math.max(Math.abs(b), 1e-9);

export function sameSignature(a: Signature, b: Signature): boolean {
  return a.n === b.n && within(a.ratio, b.ratio) && within(a.size, b.size);
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Matches for the symbol boxed by `rect`, or null when the box holds nothing recognisable. */
export function symbolMatches(geo: SheetGeometry, rect: Rect, opts: SymbolMatchOptions = {}): SymbolMatchesResult | null {
  const box = normalise(rect);
  const seedInserts = geo.inserts.filter((i) => inside(box, i.x, i.y));
  if (seedInserts.length) {
    // the box may clip a neighbour: the name seen most inside it is the symbol
    const tally = new Map<string, number>();
    for (const i of seedInserts) tally.set(i.name, (tally.get(i.name) ?? 0) + 1);
    const name = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    const seeds = new Set(seedInserts.filter((i) => i.name === name).map((i) => i.handle));
    const points = geo.inserts
      .filter((i) => i.name === name && !(opts.excludeSeed && seeds.has(i.handle)))
      .map((i) => [round(i.x), round(i.y)]);
    return { points, name, count: points.length };
  }
  const shapes = geo.outlines.map(shape);
  const seeds = shapes.filter((s) => inside(box, s.bbox[0], s.bbox[1]) && inside(box, s.bbox[2], s.bbox[3]));
  if (!seeds.length) return null;
  // the biggest outline in the box is the symbol; the smaller ones are its detail
  const seed = seeds.sort((a, b) => b.sig.size - a.sig.size)[0]!;
  const seedSet = new Set(seeds.filter((s) => sameSignature(s.sig, seed.sig)));
  const points = shapes
    .filter((s) => sameSignature(s.sig, seed.sig) && !(opts.excludeSeed && seedSet.has(s)))
    .map((s) => [round(s.cx), round(s.cy)]);
  return { points, name: null, count: points.length };
}
