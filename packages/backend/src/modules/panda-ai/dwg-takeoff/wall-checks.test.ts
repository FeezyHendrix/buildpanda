import { test } from "node:test";
import assert from "node:assert/strict";
import { annotateWalls, dimensionCheck, perimeterCheck, wallSummary } from "./wall-checks.ts";
import { measureWallRuns, wallItems, type WallSegment } from "./walls.ts";
import { synth } from "./fixtures.ts";
import type { RegisterSheet, UnitsDecision } from "./types.ts";

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ handle: 1, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
const units: UnitsDecision = { unit: "mm", scaleToMm: 1, basis: "header", errorPct: 0.02, samples: 4, note: "" };
const height = { mm: 3000, basis: "level marks", assumed: false };
const openings = { doors: 2, doorWidthMm: 900, windows: 1, windowAreaM2: 1.44 };

// a 10 × 6 m box of 225 walls with a 150 wall across the middle
function box(): WallSegment[] {
  return [
    seg(0, -112, 10000, -112),
    seg(0, 112, 10000, 112),
    seg(0, 5888, 10000, 5888),
    seg(0, 6112, 10000, 6112),
    seg(-112, 0, -112, 6000),
    seg(112, 0, 112, 6000),
    seg(9888, 0, 9888, 6000),
    seg(10112, 0, 10112, 6000),
    seg(4925, 112, 4925, 5888),
    seg(5075, 112, 5075, 5888),
  ];
}

const sheet = (doc: ReturnType<ReturnType<typeof synth>["doc"]>): RegisterSheet =>
  ({ id: 0, code: "DWG-01", title: "Plan", kind: "floor-plan", bounds: { minX: -500, minY: -500, maxX: 10500, maxY: 6500 }, members: doc.entities.map((_, i) => i), labels: [] }) as unknown as RegisterSheet;

test("the summary carries every thickness, the run count, the openings and the height source", () => {
  const measure = measureWallRuns(box(), 1);
  const s = wallSummary(measure, height, openings, sheet(synth().doc()), units);
  assert.deepEqual(s.byThickness, [
    { thicknessMm: 225, lengthM: 32 },
    { thicknessMm: 150, lengthM: 5.78 },
  ]);
  assert.equal(s.runs, 10);
  assert.deepEqual(s.openings, { doors: 2, windows: 1, areaM2: 5.22 });
  assert.equal(s.height.mm, 3000);
  const items = wallItems(measure, height, openings, sheet(synth().doc()), units);
  annotateWalls(items, s);
  assert.match(items[0]!.basis, /Sheet walls: 225 mm 32 m, 150 mm 5\.78 m \(37\.78 m in 10 runs\); 3 openings deducted \(5\.22 m²\); height 3 m \(level marks\)/);
});

test("dimension strings along the external walls confirm the paired length, or send the line to review", () => {
  const measure = measureWallRuns(box(), 1);
  const s = synth();
  // overall dimensions under and beside the box, bay dimensions above it
  s.dim("DIM", 10000);
  const agreeing = s.doc();
  const overall = agreeing.entities.find((e) => e.entity === "DIMENSION_LINEAR")!;
  Object.assign(overall, { xline1_pt: [0, 0, 0], xline2_pt: [10000, 0, 0] });
  agreeing.entities.push({ entity: "DIMENSION_LINEAR", act_measurement: 6000, xline1_pt: [10000, 0, 0], xline2_pt: [10000, 6000, 0], entmode: 2 } as never);
  agreeing.entities.push({ entity: "DIMENSION_LINEAR", act_measurement: 5000, xline1_pt: [0, 6000, 0], xline2_pt: [5000, 6000, 0], entmode: 2 } as never);
  agreeing.entities.push({ entity: "DIMENSION_LINEAR", act_measurement: 5000, xline1_pt: [5000, 6000, 0], xline2_pt: [10000, 6000, 0], entmode: 2 } as never);
  const check = dimensionCheck(agreeing, sheet(agreeing), measure, units);
  assert.equal(check, "dimensions along 3 external walls cover 26 m vs 26 m paired (agree)");

  const summary = wallSummary(measure, height, openings, sheet(agreeing), units);
  summary.checks.dimensions = check;
  const items = wallItems(measure, height, openings, sheet(agreeing), units);
  annotateWalls(items, summary);
  assert.equal(items[0]!.confidence, "high");
  assert.match(items[0]!.crossCheck ?? "", /dimensions along 3 external walls cover 26 m vs 26 m paired \(agree\)/);

  // a string that stops short of the wall's end disagrees
  const s2 = synth();
  s2.dim("DIM", 8000);
  const short = s2.doc();
  Object.assign(short.entities.find((e) => e.entity === "DIMENSION_LINEAR")!, { xline1_pt: [0, 0, 0], xline2_pt: [8000, 0, 0] });
  const bad = dimensionCheck(short, sheet(short), measure, units);
  assert.match(bad, /cover 8 m vs 10 m paired \(differ by 20%\)/);
  summary.checks.dimensions = bad;
  const flagged = wallItems(measure, height, openings, sheet(short), units);
  annotateWalls(flagged, summary);
  assert.equal(flagged[0]!.confidence, "low");
  assert.equal(dimensionCheck(synth().doc(), sheet(synth().doc()), measure, units), "no dimension strings run along the external walls");
});

test("room perimeters agree with twice the internal plus the external centreline, or are inconclusive", () => {
  const measure = measureWallRuns(box(), 1);
  // two rooms of 4.775 × 5.775 m inside: perimeters 2 × 21.1 m
  assert.match(perimeterCheck(measure, { totalM: 42.2, rooms: 2, unmeasured: 0 }), /42\.2 m \(2 rooms\) vs 43\.6 m implied .*: agree/);
  assert.match(perimeterCheck(measure, { totalM: 21.1, rooms: 1, unmeasured: 0 }), /differ by 52%/);
  assert.match(perimeterCheck(measure, { totalM: 21.1, rooms: 1, unmeasured: 1 }), /inconclusive: 1 of 2 labelled rooms/);
  assert.equal(perimeterCheck(measure, { totalM: 0, rooms: 0, unmeasured: 3 }), "no rooms enclosed to check the walls against");
});
