import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyticLengthPt,
  arcInfo,
  cornersOf,
  insertCornerAfter,
  moveArcMid,
  moveCorner,
  removeCorner,
  tessellateShape,
  toggleSegment,
  type PathShape,
} from "./shape-edit-model.ts";

// A 10-unit straight run then a semicircular arc of radius 10 (through the
// top of the circle): analytic length = 10 + π·10.
const RUN: PathShape = {
  role: "path",
  start: [0, 0],
  closed: false,
  segments: [
    { kind: "line", end: [10, 0] },
    { kind: "arc", mid: [20, 10], end: [30, 0] },
  ],
};

test("analytic length measures the arc as r·θ, not its chord", () => {
  const expected = 10 + Math.PI * 10;
  assert.ok(Math.abs(analyticLengthPt(RUN) - expected) < 1e-6, `${analyticLengthPt(RUN)} vs ${expected}`);
});

test("arcInfo finds the circle through three points and a collinear mid is null", () => {
  const arc = arcInfo([10, 0], [20, 10], [30, 0]);
  assert.ok(arc && Math.abs(arc.r - 10) < 1e-9 && Math.abs(arc.cx - 20) < 1e-9);
  assert.equal(arcInfo([0, 0], [5, 0], [10, 0]), null);
});

test("corners map to start + segment ends; moving corner 0 moves the start", () => {
  assert.deepEqual(cornersOf(RUN), [
    [0, 0],
    [10, 0],
    [30, 0],
  ]);
  const moved = moveCorner(RUN, 0, [1, 1]);
  assert.deepEqual(moved.start, [1, 1]);
  const movedEnd = moveCorner(RUN, 2, [31, 0]);
  assert.deepEqual(movedEnd.segments[1]!.end, [31, 0]);
});

test("moveArcMid bends only the named arc", () => {
  const bent = moveArcMid(RUN, 1, [20, 5]);
  assert.deepEqual((bent.segments[1] as { mid: [number, number] }).mid, [20, 5]);
  assert.deepEqual(bent.segments[0], { kind: "line", end: [10, 0] });
});

test("toggle line→arc bulges (non-collinear) and arc→line drops the mid", () => {
  const curved = toggleSegment(RUN, 0);
  const seg = curved.segments[0]!;
  assert.equal(seg.kind, "arc");
  assert.ok(arcInfo([0, 0], (seg as { mid: [number, number] }).mid, [10, 0]) !== null, "a fresh arc must not be collinear");
  const straightened = toggleSegment(RUN, 1);
  assert.deepEqual(straightened.segments[1], { kind: "line", end: [30, 0] });
});

test("insert on an arc splits it into two arcs on the SAME circle (length preserved)", () => {
  const before = analyticLengthPt(RUN);
  const split = insertCornerAfter(RUN, 1, [20, 10]);
  assert.equal(split.segments.length, 3);
  assert.ok(Math.abs(analyticLengthPt(split) - before) < 1e-6);
});

test("removeCorner merges two sides into a straight one and respects the minimum", () => {
  const removed = removeCorner(RUN, 1, 2);
  assert.deepEqual(removed?.segments, [{ kind: "line", end: [30, 0] }]);
  assert.equal(removeCorner(removed!, 1, 2), null);
});

test("tessellation starts and ends exactly on the declared corners", () => {
  const pts = tessellateShape(RUN, 8);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [30, 0]);
  assert.ok(pts.length > 5);
});
