import { test } from "node:test";
import assert from "node:assert/strict";
import { measureWallRuns, storeyHeight, wallItems, wallSegments, type WallSegment } from "./walls.ts";
import { synth } from "./fixtures.ts";
import type { RegisterSheet, UnitsDecision } from "./types.ts";

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ handle: 1, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
const units: UnitsDecision = { unit: "mm", scaleToMm: 1, basis: "header", errorPct: 0.02, samples: 0, note: "" };
const sheet = { id: 1, code: "DWG-01", title: "Plan", kind: "floor-plan", levelMm: 450 } as RegisterSheet;

test("paired faces give thickness and centreline length; a lone line is reported, not measured", () => {
  const m = measureWallRuns([seg(0, 0, 10000, 0), seg(0, 230, 10000, 230), seg(0, 5000, 4000, 5000)], 1);
  assert.deepEqual([...m.byThickness.keys()], [225]);
  assert.equal(Math.round(m.byThickness.get(225)!.lengthM), 10);
  assert.equal(m.unpairedM, 4);
});

test("a face broken into pieces with millimetre overlaps and gaps at the joints still pairs in full", () => {
  // a 10 m wall: one face whole, the other in four chunks with 3 mm overlaps and 4 mm gaps
  const chunks: Array<[number, number]> = [
    [0, 2600],
    [2597, 5100],
    [5104, 7700],
    [7697, 10000],
  ];
  const m = measureWallRuns([seg(0, 0, 10000, 0), ...chunks.map(([a, b]) => seg(b, 225, a, 225))], 1);
  const total = [...m.byThickness.values()].reduce((s, v) => s + v.lengthM, 0);
  assert.ok(Math.abs(total - 10) < 0.05, `paired ${total} m`);
});

test("the strokes of an exploded hatch between the faces are not faces; a short pier on a face's line still is", () => {
  const faces = [seg(0, 0, 10000, 0), seg(0, 225, 10000, 225)];
  const hatch: ReturnType<typeof seg>[] = [];
  for (let x = 0; x + 225 <= 10000; x += 150) hatch.push(seg(x, 0, x + 225, 225));
  const m = measureWallRuns([...faces, ...hatch], 1);
  assert.deepEqual([...m.byThickness.keys()], [225], "no phantom thickness from the diagonal strokes");
  assert.ok(Math.abs(m.byThickness.get(225)!.lengthM - 10) < 0.01);
  // a 300 mm pier between two windows, on the line of a long face
  const pier = measureWallRuns([seg(0, 0, 4000, 0), seg(0, 225, 4000, 225), seg(5200, 0, 5500, 0), seg(5200, 225, 5500, 225)], 1);
  assert.ok(Math.abs(pier.byThickness.get(225)!.lengthM - 4.3) < 0.01, `${pier.byThickness.get(225)!.lengthM}`);
  // the same 300 mm pair standing alone, off every line, is not a wall
  const lone = measureWallRuns([seg(5200, 3000, 5500, 3000), seg(5200, 3225, 5500, 3225)], 1);
  assert.equal(lone.byThickness.size, 0);
});

test("two thicknesses are two modes; a sliver of a third folds into its neighbour", () => {
  const m = measureWallRuns(
    [
      seg(0, 0, 10000, 0),
      seg(0, 230, 10000, 230),
      seg(0, 3000, 8000, 3000),
      seg(0, 3150, 8000, 3150),
      seg(20000, 0, 20600, 0),
      seg(20000, 300, 20600, 300),
    ],
    1,
  );
  const items = wallItems(m, { mm: 3000, basis: "level marks", assumed: false }, { doors: 0, doorWidthMm: null, windows: 0, windowAreaM2: null }, sheet, units);
  assert.deepEqual(items.map((i) => i.description), [
    "Sandcrete block wall in cement mortar (1:6); 225mm thick",
    "Sandcrete block wall in cement mortar (1:6); 150mm thick",
  ]);
  assert.equal(items[0]?.quantity, 31.8, "10 m × 3 m plus the 0.6 m sliver at 300 folded in");
  assert.equal(items[1]?.quantity, 24);
  assert.equal(items[0]?.confidence, "medium");
});

test("a window frame inside the wall band does not steal a face from its partner; a face split at a door still pairs in full", () => {
  const m = measureWallRuns([seg(0, 0, 10000, 0), seg(0, 230, 4000, 230), seg(4900, 230, 10000, 230), seg(4000, 100, 5200, 100)], 1);
  assert.equal(Math.round(m.byThickness.get(225)!.lengthM * 10) / 10, 9.1, "10 m of face less the 0.9 m door gap on the other side");
  assert.ok((m.byThickness.get(100)?.lengthM ?? 0) < 1, "the frame is a sliver, not the wall");
});

test("storey height is the median floor-to-floor of the plan level marks, else assumed", () => {
  const plans = (levels: number[]) => levels.map((levelMm) => ({ kind: "floor-plan", levelMm }) as RegisterSheet);
  assert.equal(storeyHeight(plans([450, 3450, 6450, 9450])).mm, 3000);
  assert.equal(storeyHeight(plans([450, 3450, 6450, 9450])).assumed, false);
  const assumed = storeyHeight(plans([450]));
  assert.equal(assumed.assumed, true);
  assert.equal(assumed.mm, 2700);
});

test("openings come off the dominant thickness and an assumed height makes the line low", () => {
  const m = measureWallRuns([seg(0, 0, 10000, 0), seg(0, 230, 10000, 230)], 1);
  const items = wallItems(m, { mm: 2700, basis: "2.7 m assumed", assumed: true }, { doors: 2, doorWidthMm: 900, windows: 1, windowAreaM2: 1.44 }, sheet, units);
  assert.equal(items[0]?.quantity, Math.round((27 - (2 * 0.9 * 2.1 + 1.44)) * 100) / 100);
  assert.equal(items[0]?.confidence, "low");
  assert.match(items[0]?.basis ?? "", /less 5.22 m² for 2 doors and 1 windows/);
});

test("segments come from lines and polyline edges, the closing edge of a closed outline and chords of an arc", () => {
  const s = synth();
  s.line("WALL", [0, 0], [1000, 0]);
  s.rect("WALL", 0, 2000, 1000, 500);
  s.arc("DOOR", [5000, 5000], 900, 0, Math.PI / 2);
  const doc = s.doc();
  const sheet = { members: doc.entities.map((_, i) => i) } as RegisterSheet;
  const map = { WALL: "walls", DOOR: "doors" } as const;
  assert.equal(wallSegments(doc, sheet, map).length, 5);
  assert.equal(wallSegments(doc, sheet, map, ["doors"]).length, 8);
});
