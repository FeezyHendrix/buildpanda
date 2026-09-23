import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError } from "../../../lib/errors.ts";
import { validateDefinitionV1 } from "./editor-types.ts";
import { measureDeduction, quantityFromRedraw, resolveMeasureTool } from "./measurement-resolve.ts";
import { isSelfIntersecting } from "./measurement-topology.ts";
import { assertMeasurable, measureVertices, validateGeometry } from "./measurements.ts";
import { quantityFromVertices } from "./service.ts";
import type { DefinitionConfirmation } from "./types.ts";

// The quantity maths behind the takeoff editor, pinned down before it is
// changed. Pure arithmetic only: no database, no HTTP, no network — every
// figure below is hand-checkable.
//
// Two code paths used to measure the same drawn shape and disagree:
//   * measureVertices(tool, ...) knows the TOOL and its factor, so a wall area
//     is its polyline length × height and a volume is its area × depth.
//   * quantityFromVertices(kind, ...) — the one updateGeometry called when a
//     line was redrawn — only knew the GEOMETRY KIND ("linear", "area"), took
//     no factor, and so could only return the base measurement.
//
// The tests marked "REGRESSION" failed on purpose while that was true. The
// redraw path now resolves the tool from the stored definition and measures
// through quantityFromRedraw, so they pass: a redrawn wall keeps its height,
// a redrawn slab keeps its depth, and a two-point "area" is refused.
// quantityFromVertices survives untouched as the raw geometry-kind maths the
// engine's own extraction still uses; nothing calls it to re-bill a line.

/** 1 sheet unit = 1000 mm = 1 m, so every expected figure is exact. */
const MM_PER_UNIT = 1000;

/** 3 m across then 4 m up: a 7 m run of wall. */
const POLYLINE_PATH = [
  [0, 0],
  [3, 0],
  [3, 4],
];

/** A 6 m × 4 m rectangle: 24 m². */
const AREA_RECT = [
  [0, 0],
  [6, 0],
  [6, 4],
  [0, 4],
];

/** Two points cannot enclose an area; an area needs at least three. */
const TWO_POINTS = [
  [0, 0],
  [6, 0],
];

const WALL_HEIGHT_M = 2.7;
const SLAB_DEPTH_M = 0.15;

test("a polyline measures the sum of its segments", () => {
  const measured = measureVertices("polyline", POLYLINE_PATH, MM_PER_UNIT);
  assert.equal(measured.base, 7, "3 m across + 4 m up is a 7 m run");
  assert.equal(measured.gross, 7, "a plain polyline has no factor to apply");
  assert.equal(measured.unit, "m");
  assert.equal(measured.baseUnit, "m");

  // The redraw path agrees here, because a polyline's gross IS its base.
  const redrawn = quantityFromVertices("linear", POLYLINE_PATH, MM_PER_UNIT);
  assert.equal(redrawn.quantity, 7);
  assert.equal(redrawn.unit, "m");
});

test("an area measures the polygon it encloses", () => {
  const measured = measureVertices("area", AREA_RECT, MM_PER_UNIT);
  assert.equal(measured.base, 24, "6 m × 4 m is 24 m2");
  assert.equal(measured.gross, 24);
  assert.equal(measured.unit, "m2");

  const redrawn = quantityFromVertices("area", AREA_RECT, MM_PER_UNIT);
  assert.equal(redrawn.quantity, 24);
  assert.equal(redrawn.unit, "m2");
});

test("a wall area is its run times its height", () => {
  const measured = measureVertices("wall_area", POLYLINE_PATH, MM_PER_UNIT, { heightM: WALL_HEIGHT_M });
  assert.equal(measured.base, 7, "the drawn figure is still the 7 m run");
  assert.equal(measured.baseUnit, "m");
  assert.equal(measured.gross, 18.9, "7 m × 2.7 m high is 18.9 m2");
  assert.equal(measured.unit, "m2");
});

test("a volume is its area times its depth", () => {
  const measured = measureVertices("volume", AREA_RECT, MM_PER_UNIT, { depthM: SLAB_DEPTH_M });
  assert.equal(measured.base, 24, "the drawn figure is still the 24 m2 slab");
  assert.equal(measured.baseUnit, "m2");
  assert.equal(measured.gross, 3.6, "24 m2 × 0.15 m deep is 3.6 m3");
  assert.equal(measured.unit, "m3");
});

// ---------- REGRESSION: redrawing a line loses the factor that made it ----------
//
// The redraw now starts from the stored definition, so it recovers the tool and
// the factor before it measures anything. `redraw()` is exactly what
// updateGeometry does between reading the row and writing the new quantity.

function redraw(definition: unknown, vertices: number[][], confirm?: DefinitionConfirmation) {
  const { tool, factor } = resolveMeasureTool(definition, confirm);
  return quantityFromRedraw(tool, vertices, MM_PER_UNIT, factor);
}

const storedWall = {
  schemaVersion: 1,
  role: "measurement",
  tool: "wall_area",
  shape: { role: "points", points: POLYLINE_PATH },
  factor: { heightM: WALL_HEIGHT_M },
};

const storedSlab = {
  schemaVersion: 1,
  role: "measurement",
  tool: "volume",
  shape: { role: "points", points: AREA_RECT },
  factor: { depthM: SLAB_DEPTH_M },
};

const storedArea = { schemaVersion: 1, role: "measurement", tool: "area", shape: { role: "points", points: AREA_RECT } };

test("REGRESSION: redrawing a wall area keeps its height factor", () => {
  const correct = measureVertices("wall_area", POLYLINE_PATH, MM_PER_UNIT, { heightM: WALL_HEIGHT_M });
  const redrawn = redraw(storedWall, POLYLINE_PATH);

  assert.equal(
    redrawn.quantity,
    correct.gross,
    `redrawing the same 7 m wall at ${WALL_HEIGHT_M} m high must still be ${correct.gross} m2, not its bare ${redrawn.base} m run`,
  );
  assert.equal(redrawn.unit, correct.unit, "a redrawn wall area is still measured in m2, not m");
  assert.equal(redrawn.base, 7, "the drawn figure behind it is still the 7 m run");
});

test("REGRESSION: redrawing a volume keeps its depth factor", () => {
  const correct = measureVertices("volume", AREA_RECT, MM_PER_UNIT, { depthM: SLAB_DEPTH_M });
  const redrawn = redraw(storedSlab, AREA_RECT);

  assert.equal(
    redrawn.quantity,
    correct.gross,
    `redrawing the same 24 m2 slab at ${SLAB_DEPTH_M} m deep must still be ${correct.gross} m3, not its bare ${redrawn.base} m2 footprint`,
  );
  assert.equal(redrawn.unit, correct.unit, "a redrawn volume is still measured in m3, not m2");
});

// ---------- REGRESSION: the redraw path skips the minimum-vertex check ----------

test("drawing an area with two points is refused", () => {
  // The control: the drawing path DOES validate, and says why.
  assert.throws(
    () => assertMeasurable("area", TWO_POINTS, undefined),
    /at least 3 points/i,
    "an area needs at least three points",
  );
  assert.throws(() => measureVertices("area", TWO_POINTS, MM_PER_UNIT), /at least 3 points/i);
});

test("REGRESSION: redrawing an area with two points is refused too", () => {
  // A two-point "area" used to shoelace to a quiet 0 m2 and silently zero the
  // bill line; the redraw path validates first, so it is refused with a reason.
  assert.throws(
    () => redraw(storedArea, TWO_POINTS),
    /at least 3 points/i,
    `a two-point area must be rejected on redraw, not silently measured as ${quantityFromVertices("area", TWO_POINTS, MM_PER_UNIT).quantity} m2`,
  );
});

// ---------- unified: one measurement path, whichever way the shape arrives ----------

test("unifying: redrawing a wall area keeps its height factor", () => {
  const drawn = measureVertices("wall_area", POLYLINE_PATH, MM_PER_UNIT, { heightM: WALL_HEIGHT_M });
  const redrawn = redraw(storedWall, POLYLINE_PATH);
  assert.deepEqual(
    { q: redrawn.quantity, u: redrawn.unit, b: redrawn.base },
    { q: drawn.gross, u: drawn.unit, b: drawn.base },
    "drawing a wall and redrawing it are the same measurement",
  );
});

test("unifying: a legacy row with no definition is redrawn from the QS's confirmation", () => {
  const recovered = redraw(null, POLYLINE_PATH, { tool: "wall_area", factor: { heightM: WALL_HEIGHT_M }, unit: "m2" });
  assert.equal(recovered.quantity, 18.9, "the confirmed height is the height that redraws it");
  assert.equal(recovered.unit, "m2");
});

test("unifying: a legacy row's basis sentence is NOT a source of parameters", () => {
  // The sentence reads "× 2.7 m height", and an earlier version scraped 2.7 out
  // of it. It is a description, not a record: wording that differs by a word
  // re-bills a priced line at a different figure. Refusing is the contract.
  assert.throws(
    () => redraw(null, POLYLINE_PATH),
    /confirm the tool/i,
    "a height read out of prose is a guess dressed as a measurement",
  );
});

test("unifying: a row whose tool cannot be established is refused, not guessed", () => {
  // "m2" alone could be a floor area or a wall elevation, and they bill
  // differently — guessing produces a smaller number that still looks measured.
  assert.throws(
    () => redraw(null, AREA_RECT),
    /confirm the tool/i,
    "an ambiguous line must ask for the tool rather than silently re-bill itself",
  );
});

test("unifying: confirming wall_area without a height is refused", () => {
  assert.throws(
    () => redraw(null, POLYLINE_PATH, { tool: "wall_area", unit: "m2" }),
    /confirm the wall height/i,
    "a wall with no height is not a confirmation, it is the same missing factor",
  );
});

test("unifying: a bow-tie polygon is refused instead of measured", () => {
  const BOW_TIE = [
    [0, 0],
    [6, 0],
    [0, 4],
    [6, 4],
  ];
  assert.ok(isSelfIntersecting(BOW_TIE), "the two lobes cross");
  assert.throws(() => validateGeometry("area", BOW_TIE, undefined), /self-intersect/i);
  assert.throws(() => redraw(storedArea, BOW_TIE), /self-intersect/i);
});

test("unifying: a zero-length side is refused instead of measured", () => {
  const DOUBLE_CLICK = [
    [0, 0],
    [6, 0],
    [6, 0],
    [6, 4],
  ];
  assert.throws(() => validateGeometry("area", DOUBLE_CLICK, undefined), /duplicate adjacent points/i);
});

// ---------- deductions are taken in the unit of the line they net off ----------

test("unifying: deduction on a length row must be in m not m2", () => {
  // The same 6 m × 4 m drawing, read as the run it traces: 6 + 4 + 6 = 16 m.
  const cut = measureDeduction("m", AREA_RECT, MM_PER_UNIT);
  assert.equal(cut.unit, "m", "a deduction off a 40 m run of skirting is a length, never an area");
  assert.equal(cut.tool, "polyline");
  assert.equal(cut.qty, 16, "6 m + 4 m + 6 m along the drawn path");

  const sameShapeOffAnArea = measureDeduction("m2", AREA_RECT, MM_PER_UNIT);
  assert.equal(sameShapeOffAnArea.unit, "m2", "the same shape off an area row is the 24 m2 it encloses");
  assert.equal(sameShapeOffAnArea.qty, 24);
  assert.notEqual(cut.qty, sameShapeOffAnArea.qty, "the parent's unit changes what the same drawing means");
});

test("a deduction cannot be taken off a line that was never measured", () => {
  assert.throws(() => measureDeduction(null, AREA_RECT, MM_PER_UNIT), /before taking a deduction/i);
});

test("a deduction off a volume needs the depth it is cut out of", () => {
  assert.throws(() => measureDeduction("m3", AREA_RECT, MM_PER_UNIT), /needs the depth/i);
  const cut = measureDeduction("m3", AREA_RECT, MM_PER_UNIT, { depthM: SLAB_DEPTH_M });
  assert.equal(cut.unit, "m3");
  assert.equal(cut.qty, 3.6, "24 m2 of opening × 0.15 m deep is 3.6 m3");
});

// ---------- the lossless definition: what a stored measurement must carry ----------
//
// A definition records the measurement as it was MADE — tool, shape, factor and
// the scale it was taken against — so a redraw or a re-calibration can rebuild
// the figure instead of guessing it. Anything half-valid is refused: a stored
// definition that cannot be re-measured makes a bill line look defensible when
// it is not.

/** The same 7 m wall run as above, as a path definition at 2.7 m high. */
const WALL_DEFINITION = {
  schemaVersion: 1,
  role: "measurement",
  tool: "wall_area",
  shape: {
    role: "path",
    start: [0, 0],
    segments: [
      { kind: "line", end: [3, 0] },
      { kind: "line", end: [3, 4] },
    ],
    closed: false,
  },
  factor: { heightM: WALL_HEIGHT_M },
  scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: MM_PER_UNIT },
};

test("valid wall_area measurement definition is accepted", () => {
  const definition = validateDefinitionV1(WALL_DEFINITION);
  assert.equal(definition.role, "measurement");
  if (definition.role !== "measurement") return;
  assert.equal(definition.tool, "wall_area", "the tool survives, so the redraw knows it is a wall area");
  assert.equal(definition.factor?.heightM, WALL_HEIGHT_M, "the height that made it an area survives");
  assert.equal(definition.scale?.appliedMmPerPt, MM_PER_UNIT);
  assert.equal(definition.scale?.sheetVersion, 1, "the sheet version it was true for is pinned");
  assert.equal(definition.shape.role, "path");
  if (definition.shape.role !== "path") return;
  assert.deepEqual(definition.shape.start, [0, 0]);
  assert.equal(definition.shape.segments.length, 2);
  assert.equal(definition.shape.closed, false);
});

test("definition with nonfinite coordinate is rejected", () => {
  const broken = {
    ...WALL_DEFINITION,
    shape: { ...WALL_DEFINITION.shape, segments: [{ kind: "line", end: [Number.POSITIVE_INFINITY, 0] }] },
  };
  assert.throws(() => validateDefinitionV1(broken), BadRequestError, "an infinite coordinate measures nothing");
});

test("definition with zero heightM is rejected", () => {
  const broken = { ...WALL_DEFINITION, factor: { heightM: 0 } };
  assert.throws(() => validateDefinitionV1(broken), BadRequestError, "a wall 0 m high is not a measurement");
});

test("definition with unknown tool is rejected", () => {
  const broken = { ...WALL_DEFINITION, tool: "perimeter" };
  assert.throws(() => validateDefinitionV1(broken), BadRequestError, "only the six measuring tools are storable");
});
