import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SAVED_MIN_VERTICES,
  appendVertex,
  extendedPoint,
  insertVertexAfter,
  metersToPt,
  moveVertex,
  removeVertex,
  segmentReadout,
} from "./saved-edit-model.ts";

const A = [0, 0];
const B = [3, 0];
const C = [3, 4];

test("removing the middle vertex of a 3-point polyline leaves the two ends", () => {
  const next = removeVertex("linear", [A, B, C], 1);
  assert.deepEqual(next, [A, C]);
});

test("a 2-point line refuses to lose a vertex but the geometry is untouched", () => {
  const vertices = [A, B];
  const next = removeVertex("linear", vertices, 0);
  assert.equal(next, null);
  assert.deepEqual(vertices, [A, B]);
});

test("a triangle refuses to drop below three vertices", () => {
  assert.equal(removeVertex("area", [A, B, C], 2), null);
  assert.deepEqual(removeVertex("area", [A, B, C, [0, 4]], 3), [A, B, C]);
});

test("one count marker can be removed only while more than one remains", () => {
  assert.deepEqual(removeVertex("count", [A, B], 1), [A]);
  assert.equal(removeVertex("count", [A], 0), null);
});

test("an out-of-range index is refused", () => {
  assert.equal(removeVertex("linear", [A, B, C], 3), null);
  assert.equal(removeVertex("linear", [A, B, C], -1), null);
});

test("insertVertexAfter places the point between the segment's ends", () => {
  const next = insertVertexAfter([A, B, C], 0, [1.5, 0]);
  assert.deepEqual(next, [A, [1.5, 0], B, C]);
});

test("insertVertexAfter at the last segment extends before the final vertex", () => {
  const next = insertVertexAfter([A, B, C], 1, [3, 2]);
  assert.deepEqual(next, [A, B, [3, 2], C]);
});

test("moveVertex replaces exactly one vertex without mutating the input", () => {
  const vertices = [A, B, C];
  const next = moveVertex(vertices, 1, [5, 5]);
  assert.deepEqual(next, [A, [5, 5], C]);
  assert.deepEqual(vertices, [A, B, C]);
});

test("minimums match the tools: line 2, area 3, count 1 remaining after the block", () => {
  assert.equal(SAVED_MIN_VERTICES.linear, 2);
  assert.equal(SAVED_MIN_VERTICES.area, 3);
  assert.equal(SAVED_MIN_VERTICES.count, 1);
  assert.equal(SAVED_MIN_VERTICES.deduction, 3);
});

test("appendVertex at the end extends the run; at the start it prepends", () => {
  assert.deepEqual(appendVertex([A, B], [5, 5], "end"), [A, B, [5, 5]]);
  assert.deepEqual(appendVertex([A, B], [5, 5], "start"), [[5, 5], A, B]);
});

test("extendedPoint walks the stated distance at the stated angle from the anchor", () => {
  // 0 deg = +x; sheet points, y up. 3-4-5: 5 units at atan2(4,3) from origin
  const pt = extendedPoint([10, 10], 5, 0);
  assert.ok(Math.abs(pt[0]! - 15) < 1e-9 && Math.abs(pt[1]! - 10) < 1e-9);
  const up = extendedPoint([10, 10], 2, 90);
  assert.ok(Math.abs(up[0]! - 10) < 1e-9 && Math.abs(up[1]! - 12) < 1e-9);
});

test("metersToPt converts through the sheet scale (50 mm/pt: 1 m = 20 pt)", () => {
  assert.equal(metersToPt(1, 50), 20);
  assert.equal(metersToPt(0.5, 50), 10);
  assert.equal(metersToPt(1, null), null);
});

test("segmentReadout reports the live segment's length and angle", () => {
  const r = segmentReadout([[0, 0], [30, 40]], 50);
  assert.equal(r?.lengthM, 2.5); // 50 pt * 50 mm = 2500 mm
  assert.ok(Math.abs(r!.angleDeg - 53.13) < 0.01);
  assert.equal(segmentReadout([[0, 0]], 50), null);
});
