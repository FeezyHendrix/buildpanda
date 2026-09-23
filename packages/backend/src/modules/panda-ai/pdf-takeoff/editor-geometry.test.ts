import assert from "node:assert/strict";
import { test } from "node:test";
import { arcLengthPt, arcSignedAreaPt, tessellateArc } from "./measurement-arcs.ts";
import { polygonDifference, polygonIntersection, polygonUnion } from "./measurement-topology.ts";

// The geometry primitives the editor measures with, pinned down on their own.
// Pure arithmetic: no database, no HTTP, every figure hand-checkable against
// schoolbook circle and polygon maths.
//
// They exist because a takeoff asks two questions the shoelace formula cannot
// answer: what a curved run is actually worth (its arc length, not its chord),
// and what overlapping shapes are worth together (their union, not their sum).

/** Two points cannot enclose an area; a polygon boolean needs at least three. */
const TWO_POINTS: [number, number][] = [
  [0, 0],
  [6, 0],
];

// ---------- arcs: a curved run bills the curve, not its chord ----------

test("an arc measures its true length, not its chord", () => {
  // A half circle of radius 1 is π long; its chord is only 2.
  const length = arcLengthPt({ start: [-1, 0], mid: [0, 1], end: [1, 0] });
  assert.ok(Math.abs(length - Math.PI) < 1e-9, `a half circle of radius 1 is π long, got ${length}`);
  assert.ok(length > 2, "the chord under-measures the pipe that was actually laid");

  // A quarter circle of radius 2 is 2 × π/2 = π.
  const quarter = arcLengthPt({ start: [2, 0], mid: [Math.SQRT2, Math.SQRT2], end: [0, 2] });
  assert.ok(Math.abs(quarter - Math.PI) < 1e-6, `a quarter circle of radius 2 is π long, got ${quarter}`);
});

test("three collinear points are a straight line, not an arc", () => {
  assert.ok(
    Number.isNaN(arcLengthPt({ start: [0, 0], mid: [1, 0], end: [2, 0] })),
    "a degenerate arc has no radius; the caller measures it as a chord",
  );
  assert.equal(arcSignedAreaPt({ start: [0, 0], mid: [1, 0], end: [2, 0] }), 0, "a straight side bulges by nothing");
});

test("an arc's signed area is its circular segment, and its sign follows the winding", () => {
  const bulge = arcSignedAreaPt({ start: [-1, 0], mid: [0, 1], end: [1, 0] });
  const mirrored = arcSignedAreaPt({ start: [1, 0], mid: [0, 1], end: [-1, 0] });
  assert.ok(Math.abs(Math.abs(bulge) - Math.PI / 2) < 1e-9, `a half disc of radius 1 is π/2, got ${bulge}`);
  assert.ok(Math.abs(bulge + mirrored) < 1e-9, "reversing the arc reverses the area it contributes");
});

test("tessellating an arc holds its sagitta inside the tolerance and tightens on zoom", () => {
  const arc = { start: [-1, 0] as [number, number], mid: [0, 1] as [number, number], end: [1, 0] as [number, number] };
  const coarse = tessellateArc(arc, 1, 1);
  const fine = tessellateArc(arc, 1, 400);
  assert.ok(fine.length > coarse.length, "zooming in asks for more points");
  assert.deepEqual(fine[0], arc.start, "both ends are included");
  assert.deepEqual(fine[fine.length - 1], arc.end);
  for (const [x, y] of fine) {
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9, "every tessellated point sits on the circle");
  }
  // chord sum of a fine tessellation converges on the analytic length from below
  let chordSum = 0;
  for (let i = 1; i < fine.length; i++) {
    chordSum += Math.hypot(fine[i]![0] - fine[i - 1]![0], fine[i]![1] - fine[i - 1]![1]);
  }
  assert.ok(chordSum < Math.PI && Math.PI - chordSum < 0.01, `tessellation ${chordSum} approaches π from below`);
});

// ---------- topology: overlapping shapes are measured once ----------

test("the union of two overlapping rooms is measured once, not twice", () => {
  const left = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ] as [number, number][];
  const right = [
    [1, 0],
    [3, 0],
    [3, 2],
    [1, 2],
  ] as [number, number][];
  const [merged, ...extra] = polygonUnion([left, right]);
  assert.equal(extra.length, 0, "two overlapping squares merge into one outline");
  assert.ok(merged, "the union produced a ring");
  const xs = merged!.map(([x]) => x);
  const ys = merged!.map(([, y]) => y);
  assert.deepEqual(
    [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
    [0, 3, 0, 2],
    "2×2 plus 2×2 overlapping by 1×2 is a 3×2 outline — 6 m2, not 8",
  );
});

test("difference and intersection answer the slab-with-a-lift-core question", () => {
  const slab = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ] as [number, number][];
  const core = [
    [1, 1],
    [2, 1],
    [2, 2],
    [1, 2],
  ] as [number, number][];
  const rings = polygonDifference(slab, core);
  assert.equal(rings.length, 2, "the slab keeps its outline and gains a hole");
  assert.equal(polygonIntersection(slab, core).length, 1, "the core sits wholly inside the slab");
  assert.equal(polygonDifference(core, slab).length, 0, "taking the slab out of the core leaves nothing");
});

test("a polygon boolean refuses a shape that cannot enclose an area", () => {
  assert.throws(() => polygonUnion([TWO_POINTS]), /at least 3 points/i);
});

