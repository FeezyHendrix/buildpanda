import assert from "node:assert/strict";
import { SESSION_ID } from "./editor-regression-fixtures.ts";
import { editDeductionIn, removeDeductionIn } from "./editor-deduction-writers.ts";
import { test } from "node:test";
import {
  DOOR,
  DOOR_RECT,
  SLAB_GEOMETRY,
  SLAB_ROW,
  WINDOW,
  WINDOW_RECT,
  deductionGeometry,
  rowUnderEdit,
} from "./editor-edit-fixtures.ts";
import type { Deduction, PreconBoqRowRow } from "./types.ts";

// Correcting and withdrawing the openings netted off a measured line.
//
// An opening is rarely cut once and left: a window moves, a door that was
// never there is deleted long after sign-off. Each of those restates a priced
// quantity, so each has to arrive at the same net the arithmetic says — and
// has to refuse the two shapes that produce a plausible wrong number: an
// opening overlapping another (the shared area is deducted twice) and one
// measured in a dimension the parent line is not billed in.

const WINDOW_ID = WINDOW.geometryId!;
const DOOR_ID = DOOR.geometryId!;

test("editor-service.removeDeduction: the opening comes back onto the line and its shape is tombstoned", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  const withdrawn: string[] = [];
  r.context.geometries.softDeleteGeometry = async (id) => {
    withdrawn.push(id);
  };

  const row = await removeDeductionIn(r.context, SESSION_ID, SLAB_ROW.id, WINDOW_ID, { version: SLAB_ROW.version }, "u_qs");

  assert.deepEqual(r.written[0]!["deductions"], [], "the window is off the line");
  assert.equal(r.written[0]!["qty"], 48, "24 m2 × 2 floors with nothing cut out is 48 m2");
  assert.equal(r.written[0]!["status"], "needs_review");
  assert.deepEqual(withdrawn, [WINDOW_ID], "the drawn opening is tombstoned, never erased");
  assert.equal(row.qty, 48);
  assert.deepEqual(
    r.events.map((e) => e.type),
    ["geometry.updated"],
  );
});

test("editor-service.removeDeduction: only the named opening is withdrawn", async () => {
  const twoCuts: PreconBoqRowRow = { ...SLAB_ROW, deductions: [WINDOW, DOOR], qty: 36 };
  const r = rowUnderEdit(twoCuts);
  r.context.geometries.softDeleteGeometry = async () => undefined;

  await removeDeductionIn(r.context, SESSION_ID, twoCuts.id, WINDOW_ID, { version: twoCuts.version }, "u_qs");

  assert.deepEqual(r.written[0]!["deductions"], [DOOR], "the door stays cut out of the line");
  assert.equal(r.written[0]!["qty"], 40, "(24 − 4) × 2 floors is 40 m2");
});

test("editor-service.removeDeduction: an opening this line never had is a 404, not a silent no-op", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  await assert.rejects(
    removeDeductionIn(r.context, SESSION_ID, SLAB_ROW.id, "pgeo_nothing", { version: SLAB_ROW.version }, "u_qs"),
    /not found/i,
  );
  assert.equal(r.written.length, 0);
});

test("editor-service.removeDeduction: a stale version withdraws nothing", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  const withdrawn: string[] = [];
  r.context.geometries.softDeleteGeometry = async (id) => {
    withdrawn.push(id);
  };
  await assert.rejects(
    removeDeductionIn(r.context, SESSION_ID, SLAB_ROW.id, WINDOW_ID, { version: SLAB_ROW.version - 1 }, "u_qs"),
    /refresh and retry/i,
  );
  assert.deepEqual(withdrawn, [], "the shape survives an edit that was refused");
  assert.deepEqual(r.events, []);
});

test("editor-service.editDeduction: a redrawn window restates the net from its new area", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  const shapes: { id: string; quantity: number | undefined }[] = [];
  r.context.geometries.measurementGeometryForRow = async () => SLAB_GEOMETRY;
  r.context.geometries.geometryById = async () => deductionGeometry(WINDOW_ID, WINDOW_RECT);
  r.context.geometries.geometriesByRow = async () => [SLAB_GEOMETRY, deductionGeometry(WINDOW_ID, WINDOW_RECT)];
  r.context.geometries.updateGeometryMeasurement = async (id, patch) => {
    shapes.push({ id, quantity: patch.quantity });
  };

  // the same window redrawn 2 m × 2 m: 4 m2 instead of 2 m2
  const REDRAWN = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  const row = await editDeductionIn(r.context, SESSION_ID, 
    SLAB_ROW.id,
    WINDOW_ID,
    { version: SLAB_ROW.version, vertices: REDRAWN },
    "u_qs",
  );

  const written = r.written[0]!["deductions"] as Deduction[];
  assert.equal(written.length, 1);
  assert.equal(written[0]!.geometryId, WINDOW_ID, "the opening keeps the id the bill line names");
  assert.equal(written[0]!.label, WINDOW.label, "and keeps the label the QS gave it");
  assert.equal(written[0]!.qty, 4);
  assert.equal(r.written[0]!["qty"], 40, "(24 − 4) × 2 floors is 40 m2");
  assert.deepEqual(shapes, [{ id: WINDOW_ID, quantity: 4 }], "the shape is updated in place, keeping its id");
  assert.equal(row.qty, 40);
});

test("editor-service.editDeduction: an opening that overlaps another is refused", async () => {
  const twoCuts: PreconBoqRowRow = { ...SLAB_ROW, deductions: [WINDOW, DOOR], qty: 36 };
  const r = rowUnderEdit(twoCuts);
  r.context.geometries.measurementGeometryForRow = async () => SLAB_GEOMETRY;
  r.context.geometries.geometryById = async () => deductionGeometry(WINDOW_ID, WINDOW_RECT);
  r.context.geometries.geometriesByRow = async () => [
    SLAB_GEOMETRY,
    deductionGeometry(WINDOW_ID, WINDOW_RECT),
    deductionGeometry(DOOR_ID, DOOR_RECT),
  ];

  // dragged across the slab until it sits on top of the door
  const OVER_THE_DOOR = [
    [4, 2],
    [6, 2],
    [6, 3],
    [4, 3],
  ];
  await assert.rejects(
    editDeductionIn(r.context, SESSION_ID, twoCuts.id, WINDOW_ID, { version: twoCuts.version, vertices: OVER_THE_DOOR }, "u_qs"),
    /taken off twice/i,
    "two openings sharing area net the shared strip off the line twice",
  );
  assert.equal(r.written.length, 0);
});

test("editor-service.editDeduction: openings that merely touch are allowed", async () => {
  const twoCuts: PreconBoqRowRow = { ...SLAB_ROW, deductions: [WINDOW, DOOR], qty: 36 };
  const r = rowUnderEdit(twoCuts);
  r.context.geometries.measurementGeometryForRow = async () => SLAB_GEOMETRY;
  r.context.geometries.geometryById = async () => deductionGeometry(WINDOW_ID, WINDOW_RECT);
  r.context.geometries.geometriesByRow = async () => [
    SLAB_GEOMETRY,
    deductionGeometry(WINDOW_ID, WINDOW_RECT),
    deductionGeometry(DOOR_ID, DOOR_RECT),
  ];
  r.context.geometries.updateGeometryMeasurement = async () => undefined;

  // butted up against the door's left edge, sharing the edge but no area
  const BUTTED = [
    [2, 2],
    [4, 2],
    [4, 4],
    [2, 4],
  ];
  const row = await editDeductionIn(r.context, SESSION_ID, 
    twoCuts.id,
    WINDOW_ID,
    { version: twoCuts.version, vertices: BUTTED },
    "u_qs",
  );
  assert.equal(row.qty, 32, "(24 − 4 − 4) × 2 floors is 32 m2");
});

test("editor-service.editDeduction: a volume with no recorded depth is refused, not measured in m2", async () => {
  const volumeRow: PreconBoqRowRow = {
    ...SLAB_ROW,
    unit: "m3",
    qty_gross: 3.6,
    qty: 3.6,
    typical: 1,
    measurement_basis: "6 m × 4 m area on GA-01 = 3.6 m3",
  };
  const r = rowUnderEdit(volumeRow);
  r.context.geometries.measurementGeometryForRow = async () => ({ ...SLAB_GEOMETRY, definition: null });
  r.context.geometries.geometryById = async () => deductionGeometry(WINDOW_ID, WINDOW_RECT);

  await assert.rejects(
    editDeductionIn(r.context, SESSION_ID, volumeRow.id, WINDOW_ID, { version: volumeRow.version, vertices: WINDOW_RECT }, "u_qs"),
    /needs the depth/i,
  );
  assert.equal(r.written.length, 0);
});

test("editor-service.editDeduction: a shape belonging to another line is a 404", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  r.context.geometries.measurementGeometryForRow = async () => SLAB_GEOMETRY;
  r.context.geometries.geometryById = async () => ({
    ...deductionGeometry(WINDOW_ID, WINDOW_RECT),
    row_id: "pbr_someone_else",
  });

  await assert.rejects(
    editDeductionIn(r.context, SESSION_ID, SLAB_ROW.id, WINDOW_ID, { version: SLAB_ROW.version, vertices: WINDOW_RECT }, "u_qs"),
    /not found/i,
  );
  assert.equal(r.written.length, 0);
});
