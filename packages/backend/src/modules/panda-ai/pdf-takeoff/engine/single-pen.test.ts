import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExtractedSheet, Segment } from "../types.ts";
import { measureWalls, wallFaceCandidates } from "./measure.ts";
import { closedRects, windowFrames } from "./shapes.ts";
import { rasterNote } from "./measure-file.ts";

// A single-pen export: every line the same width, so geometry alone must
// tell a wall face from a window frame's edge or a fitting's outline.

const MM_PER_PT = 35.28;
const pt = (mm: number) => mm / MM_PER_PT;
let nextPath = 1;
const seg = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Segment> = {}): Segment => ({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.25, color: "#000", ...extra });
function rect(x: number, y: number, w: number, h: number, extra: Partial<Segment> = {}): Segment[] {
  const path = nextPath++;
  const e = { path, closed: true, ...extra };
  return [seg(x, y, x + w, y, e), seg(x + w, y, x + w, y + h, e), seg(x + w, y + h, x, y + h, e), seg(x, y + h, x, y, e)];
}

// a 9 m wall, 225 thick, with a 1.2 m window frame (120 deep) centred in it
function windowWall(y = 100): Segment[] {
  const t = pt(225) / 2;
  const w = pt(9000);
  const out = [seg(0, y - t, w, y - t), seg(0, y + t, w, y + t)];
  out.push(...rect(w / 2 - pt(600), y - pt(60), pt(1200), pt(120)));
  return out;
}

test("the edges of a small closed outline never become wall faces, whatever pen they share", () => {
  const segments = windowWall();
  const candidates = wallFaceCandidates(segments, MM_PER_PT, 0.25);
  assert.equal(candidates.length, 2, "only the two faces remain");
  const walls = measureWalls(segments, MM_PER_PT, 0.25);
  assert.equal(walls.pairs.length, 1);
  assert.equal(walls.pairs[0]!.gapMm, 225);
  assert.ok(Math.abs(walls.pairs[0]!.lengthM - 9) < 0.05);
});

test("a run takes the partner it shares the most length with, not the nearest parallel line", () => {
  const t = pt(225) / 2;
  const w = pt(9000);
  // a 1.2 m stray line 172 mm off the top face (a frame edge drawn open, not closed)
  const segments = [seg(0, 100 - t, w, 100 - t), seg(0, 100 + t, w, 100 + t), seg(w / 2 - pt(600), 100 - t + pt(172), w / 2 + pt(600), 100 - t + pt(172))];
  const walls = measureWalls(segments, MM_PER_PT, 0.25);
  const main = walls.pairs.find((p) => p.gapMm === 225);
  assert.ok(main && Math.abs(main.lengthM - 9) < 0.05, JSON.stringify(walls.pairs));
});

test("a solid hatch filling a wall is not a window frame, even though it is a thin closed rectangle on the wall line", () => {
  const t = pt(225) / 2;
  const w = pt(3000);
  const faces = [seg(0, 100 - t, w, 100 - t, { width: 0.6 }), seg(0, 100 + t, w, 100 + t, { width: 0.6 })];
  const fill = rect(0, 100 - t, w, 2 * t, { fill: true, width: 0.1 });
  const frame = rect(w / 2 - pt(600), 100 - pt(60), pt(1200), pt(120), { width: 0.1 });
  const segments = [...faces, ...fill, ...frame];
  const walls = measureWalls(segments, MM_PER_PT, 0.6);
  const frames = windowFrames(closedRects(segments, MM_PER_PT), walls.pairs, MM_PER_PT);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.widthMm, 1200);
});

test("a page whose drawing is an embedded image is declared unmeasurable, not measured from its title block", () => {
  const vectors = Array.from({ length: 30 }, (_, i) => seg(i * 10, 0, i * 10, 50));
  const raster: ExtractedSheet = { segments: vectors, curves: [], texts: [], images: { count: 1, areaPt2: 500_000, pageShare: 0.5 } };
  const note = rasterNote(raster);
  assert.ok(note && /raster drawing/.test(note) && /unmeasurable/.test(note), note ?? "");
  const logo: ExtractedSheet = { segments: vectors, curves: [], texts: [], images: { count: 1, areaPt2: 2000, pageShare: 0.002 } };
  assert.equal(rasterNote(logo), null, "a small logo does not make a page a scan");
  assert.equal(rasterNote({ segments: vectors, curves: [], texts: [] }), null);
});
