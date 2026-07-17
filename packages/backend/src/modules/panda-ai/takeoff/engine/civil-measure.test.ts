import { test } from "node:test";
import assert from "node:assert/strict";
import { measureCivil, civilToItems } from "./civil-measure.ts";
import type { Segment } from "../types.ts";

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return { x1, y1, x2, y2, len, width: 0.3, color: "#000" };
}

// A carriageway: two long parallel edges 20pt apart, running 1000pt long.
// At mmPerPt = 100 (1pt = 100mm = 0.1m), the run is 1000 * 0.1 = 100m and the
// bounding area is 1000 x 20 pt = 20000 pt^2 -> 20000 * 0.01 m2 = 200 m2.
function carriageway(): Segment[] {
  return [
    seg(0, 0, 1000, 0),
    seg(0, 20, 1000, 20),
    seg(0, 0, 0, 20),
    seg(1000, 0, 1000, 20),
  ];
}

test("measureCivil: paved area and road run from carriageway geometry", () => {
  const m = measureCivil(carriageway(), 100);
  assert.equal(m.roadLengthM, 100);
  assert.equal(m.pavedAreaM2, 200);
  assert.equal(m.edgeCount, 2); // two 1000pt edges are the long lines; 20pt ends are short
});

test("measureCivil: too little linework -> zero (refuses to invent area)", () => {
  const m = measureCivil([seg(0, 0, 30, 0)], 100);
  assert.equal(m.pavedAreaM2, 0);
  assert.equal(m.roadLengthM, 0);
});

test("civilToItems: emits pavement m2 + road length m in section 2T", () => {
  const items = civilToItems(measureCivil(carriageway(), 100), 2);
  const area = items.find((i) => i.unit === "m2");
  const length = items.find((i) => i.unit === "m");
  assert.ok(area && length);
  assert.equal(area!.workSection.code, "2T");
  assert.equal(area!.qty, 200);
  assert.equal(length!.qty, 100);
  for (const item of items) assert.equal(item.confidence, "low");
});

test("civilToItems: no measurable geometry -> no items", () => {
  const items = civilToItems(measureCivil([], 100), 1);
  assert.equal(items.length, 0);
});

test("measureCivil: sheet title-block border is excluded, not measured", () => {
  // a 1000x20pt road inside a 1400x900pt sheet frame; at mmPerPt=100 -> 200 m2
  const road = [seg(0, 0, 1000, 0), seg(0, 20, 1000, 20)];
  const frame = [
    seg(-100, -100, 1300, -100),
    seg(-100, 800, 1300, 800),
    seg(-100, -100, -100, 800),
    seg(1300, -100, 1300, 800),
  ];
  const m = measureCivil([...road, ...frame], 100);
  assert.equal(m.pavedAreaM2, 200); // NOT 12600 (frame bounding box)
  assert.equal(m.roadLengthM, 100); // NOT 140 (frame width)
});
