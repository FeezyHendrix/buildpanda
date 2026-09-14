import { test } from "node:test";
import assert from "node:assert/strict";
import type { Segment } from "../types.ts";
import { measureWalls, wallPenThreshold, type DoorArcs } from "./measure.ts";
import { classifyOpenings, closedRects, countColumns, countDoorLeaves, openingBridges, windowFrames } from "./shapes.ts";

const MM_PER_PT = 35.28; // 1:100
const pt = (mm: number) => mm / MM_PER_PT;

let nextPath = 1;
function seg(x1: number, y1: number, x2: number, y2: number, width = 0.6, extra: Partial<Segment> = {}): Segment {
  return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width, color: "#000", ...extra };
}
function rect(x: number, y: number, w: number, h: number, width = 0.1): Segment[] {
  const path = nextPath++;
  const extra = { path, closed: true, width };
  return [seg(x, y, x + w, y, width, extra), seg(x + w, y, x + w, y + h, width, extra), seg(x + w, y + h, x, y + h, width, extra), seg(x, y + h, x, y, width, extra)];
}

// A 6 m horizontal 225 mm wall with a 1.2 m window in the middle, drawn as
// two faces broken at the opening and jambed, plus a thin window frame.
function windowWall(): Segment[] {
  const t = pt(225) / 2;
  const y = 100;
  const faces: Segment[] = [];
  for (const side of [-t, t]) {
    faces.push(seg(0, y + side, pt(2400), y + side));
    faces.push(seg(pt(3600), y + side, pt(6000), y + side));
  }
  faces.push(seg(pt(2400), y - t, pt(2400), y + t), seg(pt(3600), y - t, pt(3600), y + t));
  return [...faces, ...rect(pt(2400), y - pt(60), pt(1200), pt(120))];
}

test("wallPenThreshold: picks the heavy pen when it is a clear minority of the ink", () => {
  const segments = [seg(0, 0, 100, 0, 0.6), seg(0, 10, 100, 10, 0.6), seg(0, 20, 300, 20, 0.1), seg(0, 30, 300, 30, 0.1), seg(0, 40, 300, 40, 0.13)];
  assert.equal(wallPenThreshold(segments), 0.6);
});

test("wallPenThreshold: a single-pen drawing lets every line through to geometry", () => {
  assert.equal(wallPenThreshold([seg(0, 0, 100, 0, 0.05), seg(0, 10, 100, 10, 0.05)]), 0.05);
});

test("closedRects: rebuilds axis-aligned rectangles from closed four-sided subpaths only", () => {
  const open = rect(0, 0, 10, 10).map((s) => ({ ...s, closed: false }));
  const rects = closedRects([...rect(0, 0, pt(230), pt(230)), ...open, seg(50, 50, 60, 60)], MM_PER_PT);
  assert.equal(rects.length, 1);
  assert.ok(Math.abs(rects[0]!.wMm - 230) < 0.01 && Math.abs(rects[0]!.hMm - 230) < 0.01);
});

test("countColumns: compact squares on a grid are columns, a 400x600 sanitary outline is not", () => {
  const segments: Segment[] = [];
  for (const x of [0, 4000, 8000]) for (const y of [0, 5000]) segments.push(...rect(pt(x) - pt(115), pt(y) - pt(115), pt(230), pt(230)));
  segments.push(...rect(pt(2000), pt(2000), pt(400), pt(600)));
  const columns = countColumns(closedRects(segments, MM_PER_PT), MM_PER_PT);
  assert.equal(columns.count, 6);
  assert.equal(columns.griddedShare, 1);
});

test("windowFrames + classifyOpenings: a thin frame in a wall break is a window, the break is bridged for the room fill", () => {
  const segments = windowWall();
  const walls = measureWalls(segments, MM_PER_PT, 0.6);
  assert.equal(walls.pairs.length, 1);
  assert.equal(walls.pairs[0]!.openings.length, 1, "the window break is an opening of the pair");
  const windows = windowFrames(closedRects(segments, MM_PER_PT), walls.pairs, MM_PER_PT);
  assert.equal(windows.length, 1);
  assert.equal(windows[0]!.widthMm, 1200);
  const openings = classifyOpenings(walls.pairs, { count: 0, centres: [], radiiMm: [] }, windows, MM_PER_PT);
  assert.equal(openings.length, 1);
  assert.equal(openings[0]!.kind, "window");
  assert.ok(Math.abs(openings[0]!.widthMm - 1200) <= 2);
  const bridges = openingBridges(walls.pairs, openings);
  assert.equal(bridges.length, 2, "one barrier per face");
});

test("classifyOpenings: a swing hinged at the break edge makes it a door; a bare break stays unknown", () => {
  const t = pt(150) / 2;
  const y = 50;
  const faces: Segment[] = [];
  for (const side of [-t, t]) {
    faces.push(seg(0, y + side, pt(2000), y + side), seg(pt(2900), y + side, pt(5000), y + side));
    faces.push(seg(pt(6000), y + side, pt(8000), y + side));
  }
  const walls = measureWalls(faces, MM_PER_PT, 0.6);
  assert.equal(walls.pairs.length, 1);
  assert.equal(walls.pairs[0]!.openings.length, 2);
  const doors: DoorArcs = { count: 1, centres: [[pt(2000), y]], radiiMm: [900] };
  const kinds = classifyOpenings(walls.pairs, doors, [], MM_PER_PT).map((o) => o.kind);
  assert.deepEqual(kinds, ["door", "unknown"]);
});

test("countDoorLeaves: a thin line of swing radius starting at the hinge confirms the swing", () => {
  const doors: DoorArcs = { count: 2, centres: [[100, 100], [300, 300]], radiiMm: [900, 900] };
  const leaves = [seg(100, 100, 100, 100 + pt(900), 0.1), seg(300, 300, 300 + pt(500), 300, 0.1)];
  assert.equal(countDoorLeaves(leaves, doors, MM_PER_PT), 1);
});

test("measureWalls: a 300 mm external wall pairs, and an opening up to 2 m is bridged into one run", () => {
  const t = pt(300) / 2;
  const faces: Segment[] = [];
  for (const side of [-t, t]) faces.push(seg(0, 50 + side, pt(3000), 50 + side), seg(pt(4800), 50 + side, pt(9000), 50 + side));
  const walls = measureWalls(faces, MM_PER_PT, 0.6);
  assert.equal(walls.pairs.length, 1);
  assert.equal(walls.pairs[0]!.gapMm, 300);
  assert.ok(Math.abs(walls.pairs[0]!.lengthM - 9) < 0.05, `got ${walls.pairs[0]!.lengthM}`);
});
