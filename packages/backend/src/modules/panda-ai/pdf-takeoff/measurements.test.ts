import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTypical, manualBasis, measureVertices, normaliseTypical, quantityFromStated } from "./measurements.ts";

// 1:50 on a sheet drawn at 0.3528 mm/pt: 17.64 mm per point. A length of L mm
// on the drawing is L / MM_PER_PT points.
const MM_PER_PT = 17.64;
const pt = (mm: number) => mm / MM_PER_PT;
const rect = (wMm: number, hMm: number): number[][] => [
  [0, 0],
  [pt(wMm), 0],
  [pt(wMm), pt(hMm)],
  [0, pt(hMm)],
];

test("length: two points at the sheet scale, rounded to 2 dp", () => {
  const q = measureVertices("length", [[0, 0], [pt(4000), 0]], MM_PER_PT);
  assert.deepEqual(q, { base: 4, baseUnit: "m", gross: 4, unit: "m", geometryKind: "linear" });
});

test("polyline: sums every segment", () => {
  const q = measureVertices("polyline", [[0, 0], [pt(3000), 0], [pt(3000), pt(4000)]], MM_PER_PT);
  assert.equal(q.base, 7);
  assert.equal(q.unit, "m");
  assert.equal(q.geometryKind, "linear");
});

test("area: shoelace over the closed polygon", () => {
  const q = measureVertices("area", rect(4000, 3000), MM_PER_PT);
  assert.equal(q.base, 12);
  assert.equal(q.unit, "m2");
  assert.equal(q.geometryKind, "area");
});

test("count: one per pin", () => {
  const q = measureVertices("count", [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], MM_PER_PT);
  assert.deepEqual(q, { base: 5, baseUnit: "nr", gross: 5, unit: "nr", geometryKind: "count" });
});

test("volume: area × depth, base kept as the drawn area", () => {
  const q = measureVertices("volume", rect(4000, 3000), MM_PER_PT, { depthM: 0.15 });
  assert.equal(q.base, 12);
  assert.equal(q.baseUnit, "m2");
  assert.equal(q.gross, 1.8);
  assert.equal(q.unit, "m3");
  assert.equal(q.geometryKind, "area");
});

test("wall area: polyline length × height, evidence stays linear", () => {
  const q = measureVertices("wall_area", [[0, 0], [pt(10000), 0]], MM_PER_PT, { heightM: 2.7 });
  assert.equal(q.base, 10);
  assert.equal(q.baseUnit, "m");
  assert.equal(q.gross, 27);
  assert.equal(q.unit, "m2");
  assert.equal(q.geometryKind, "linear");
});

test("tools refuse drawings they cannot turn into a number", () => {
  assert.throws(() => measureVertices("wall_area", [[0, 0], [10, 0]], MM_PER_PT), /height/);
  assert.throws(() => measureVertices("volume", rect(1000, 1000), MM_PER_PT), /depth/);
  assert.throws(() => measureVertices("area", [[0, 0], [10, 0]], MM_PER_PT), /at least 3 points/);
  assert.throws(() => measureVertices("length", [[0, 0]], MM_PER_PT), /at least 2 points/);
  assert.throws(() => measureVertices("count", [[0]], MM_PER_PT), /x and a y/);
});

test("typical multiplies the gross and must be a whole number", () => {
  assert.equal(normaliseTypical(undefined), 1);
  assert.equal(normaliseTypical(4), 4);
  assert.throws(() => normaliseTypical(1.5), /whole number/);
  assert.throws(() => normaliseTypical(0), /whole number/);
  assert.equal(applyTypical(27, 4), 108);
  assert.equal(applyTypical(12.345, 3), 37.04);
});

test("basis sentence states the drawn figure, the sheet and every factor", () => {
  const wall = measureVertices("wall_area", [[0, 0], [pt(12400), 0]], MM_PER_PT, { heightM: 2.7 });
  assert.equal(manualBasis("wall_area", wall, "on DWG-01", { heightM: 2.7 }, 4, "m2"), "12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2");
  const plain = measureVertices("length", [[0, 0], [pt(4000), 0]], MM_PER_PT);
  assert.equal(manualBasis("length", plain, "on SHT-02", undefined, 1, "m"), "4 m length on SHT-02");
  const floors = measureVertices("area", rect(4000, 3000), MM_PER_PT);
  assert.equal(manualBasis("area", floors, "on SHT-02", undefined, 3, "m2"), "12 m2 area on SHT-02 × 3 typical floors = 36 m2");
  const vol = measureVertices("volume", rect(4000, 3000), MM_PER_PT, { depthM: 0.15 });
  assert.equal(manualBasis("volume", vol, "on SHT-02", { depthM: 0.15 }, 1, "m3"), "12 m2 area on SHT-02 × 0.15 m depth = 1.8 m3");
});

test("a stated figure still takes the tool's factor", () => {
  assert.equal(quantityFromStated("wall_area", 12, { heightM: 2.7 }).gross, 32.4);
  assert.equal(quantityFromStated("volume", 20, { depthM: 0.2 }).gross, 4);
  assert.deepEqual(quantityFromStated("count", 6), { base: 6, baseUnit: "nr", gross: 6, unit: "nr", geometryKind: "count" });
  assert.throws(() => quantityFromStated("length", -1), /positive/);
  assert.throws(() => quantityFromStated("wall_area", 12), /height/);
  const q = quantityFromStated("wall_area", 12, { heightM: 2.7 });
  assert.equal(manualBasis("wall_area", q, "stated in prompt", { heightM: 2.7 }, 1, "m2"), "12 m polyline stated in prompt × 2.7 m height = 32.4 m2");
});
