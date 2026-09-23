import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MM_PER_UNIT,
  NEW_WALL_HEIGHT_M,
  POLYLINE_PATH,
  SESSION_ID,
  SLAB_GEOMETRY,
  SLAB_ROW,
  WALL_GEOMETRY,
  WALL_HEIGHT_M,
  WALL_ROW,
  rowUnderEdit,
  serviceFor,
} from "./editor-edit-fixtures.ts";
import { measureVertices, netQuantity, normaliseTypical } from "./measurements.ts";
import type { PreconBoqRowRow } from "./types.ts";

// Restating a measured line WITHOUT redrawing it: the storey height off a
// section, the slab depth off a detail, the number of typical floors.
//
// The claim is that a parameter edit re-measures the line's OWN stored shape.
// A QS who has to redraw a 40-vertex wall run to correct 2.7 m to 3.0 m makes
// two changes to a signed-off quantity and reports one — and the second,
// silent one is a different drawing on a contractual record.

test("editTypical: fractional N rejected", () => {
  assert.throws(() => normaliseTypical(1.5), /whole number/i, "half a floor is a mistake, not a factor");
  assert.throws(() => normaliseTypical(0), /whole number/i, "a line that repeats zero times is not measured");
  assert.equal(normaliseTypical(2), 2);
});

test("editTypical: N=2 on 24m² area with 2m² deduction yields 44m²", () => {
  assert.equal(netQuantity(24, [{ qty: 2 }], 2), 44, "(24 − 2) × 2 floors is 44 m2");
});

test("editHeight: changing wall height from 2.7 to 3.0 on 7m path", () => {
  const before = measureVertices("wall_area", POLYLINE_PATH, MM_PER_UNIT, { heightM: WALL_HEIGHT_M });
  const after = measureVertices("wall_area", POLYLINE_PATH, MM_PER_UNIT, { heightM: NEW_WALL_HEIGHT_M });
  assert.equal(before.gross, 18.9, "7 m × 2.7 m high is 18.9 m2");
  assert.equal(after.gross, 21, "7 m × 3.0 m high is 21 m2");
  assert.equal(after.base, before.base, "the drawn run is untouched by a height correction");
});

test("removeDeduction: net becomes 48 when 2m² deduction removed from 24m²×2", () => {
  assert.equal(netQuantity(24, [{ qty: 2 }], 2), 44);
  assert.equal(netQuantity(24, [], 2), 48, "the opening comes back onto the line it was cut out of");
});

test("editor-service.editHeight: 7 m run at 3 m high is 21 m2, re-measured from the stored shape", async () => {
  const r = rowUnderEdit(WALL_ROW);
  const definitions: unknown[] = [];
  // A height belongs to the LINE, so the writer rebinds every shape on it and
  // then re-adds the line from all of them. The double therefore has to APPLY
  // the write it records, exactly as the repository does.
  let liveGeometry = { ...WALL_GEOMETRY };
  r.context.geometries.measurementGeometryForRow = async () => liveGeometry;
  r.context.geometries.geometriesByRow = async () => [liveGeometry];
  r.context.geometries.updateGeometryMeasurement = async (_id, patch) => {
    definitions.push(patch.definition);
    liveGeometry = {
      ...liveGeometry,
      quantity: patch.quantity ?? liveGeometry.quantity,
      unit: patch.unit ?? liveGeometry.unit,
      definition: patch.definition ?? liveGeometry.definition,
    };
  };

  const row = await serviceFor(r).editHeight(
    WALL_ROW.id,
    { version: WALL_ROW.version, heightM: NEW_WALL_HEIGHT_M },
    "u_qs",
  );

  assert.deepEqual(r.locked, [SESSION_ID], "the correction runs inside the lock on the row's own session");
  assert.equal(r.written.length, 1);
  assert.equal(r.written[0]!["qty_gross"], 21, "7 m of wall at 3 m high is 21 m2");
  assert.equal(r.written[0]!["qty"], 21);
  assert.equal(r.written[0]!["unit"], "m2");
  assert.match(String(r.written[0]!["measurement_basis"]), /× 3 m height/, "the basis names the height that made it");
  assert.equal(r.written[0]!["status"], "needs_review", "a new figure is a figure nobody has signed off");
  assert.equal(r.written[0]!["verified_by"], null);
  assert.equal(row.qtyGross, 21);
  assert.equal(definitions.length, 1, "the stored definition carries the new factor for the next redraw");
  assert.deepEqual(
    r.events.map((e) => e.type),
    ["geometry.updated"],
  );
});

test("editor-service.editHeight: a zero or non-finite height is refused before any write", async () => {
  for (const heightM of [0, -2.7, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = rowUnderEdit(WALL_ROW);
    await assert.rejects(
      serviceFor(r).editHeight(WALL_ROW.id, { version: WALL_ROW.version, heightM }, "u_qs"),
      /positive number of metres/i,
      `a wall ${heightM} m high is not a measurement`,
    );
    assert.equal(r.written.length, 0, "nothing is written for a height that measures nothing");
  }
});

test("editor-service.editHeight: a line that is not a wall area is refused, not re-billed", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  r.context.geometries.measurementGeometryForRow = async () => SLAB_GEOMETRY;
  await assert.rejects(
    serviceFor(r).editHeight(SLAB_ROW.id, { version: SLAB_ROW.version, heightM: NEW_WALL_HEIGHT_M }, "u_qs"),
    /wall area line is billed through a height/i,
  );
  assert.equal(r.written.length, 0);
});

test("editor-service.editDepth: a wall area is refused, because a wall has no depth to bill through", async () => {
  const r = rowUnderEdit(WALL_ROW);
  r.context.geometries.measurementGeometryForRow = async () => WALL_GEOMETRY;
  await assert.rejects(
    serviceFor(r).editDepth(WALL_ROW.id, { version: WALL_ROW.version, depthM: 0.15 }, "u_qs"),
    /volume line is billed through a depth/i,
  );
  assert.equal(r.written.length, 0);
});

test("editor-service.editTypical: N=2 restates the net and the typical clause of the basis", async () => {
  const single: PreconBoqRowRow = {
    ...SLAB_ROW,
    typical: 1,
    qty: 22,
    measurement_basis: "6 m × 4 m area on GA-01 = 22 m2",
  };
  const r = rowUnderEdit(single);

  const row = await serviceFor(r).editTypical(single.id, { version: single.version, typical: 2 }, "u_qs");

  assert.deepEqual(r.locked, [SESSION_ID]);
  assert.equal(r.written[0]!["typical"], 2);
  assert.equal(r.written[0]!["qty"], 44, "(24 − 2) × 2 floors is 44 m2");
  assert.match(String(r.written[0]!["measurement_basis"]), /× 2 typical floors = 44 m2$/);
  assert.equal(r.written[0]!["status"], "needs_review");
  assert.equal(row.typical, 2);
  assert.deepEqual(
    r.events.map((e) => e.type),
    ["row.updated"],
  );
});

test("editor-service.editTypical: a fractional multiplier is refused before any write", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  await assert.rejects(
    serviceFor(r).editTypical(SLAB_ROW.id, { version: SLAB_ROW.version, typical: 1.5 }, "u_qs"),
    /whole number/i,
  );
  assert.equal(r.written.length, 0, "no bill line is left repeating on one and a half floors");
});

test("editor-service.editTypical: a stale version writes nothing and announces nothing", async () => {
  const r = rowUnderEdit(SLAB_ROW);
  await assert.rejects(
    serviceFor(r).editTypical(SLAB_ROW.id, { version: SLAB_ROW.version - 1, typical: 3 }, "u_qs"),
    /refresh and retry/i,
  );
  assert.equal(r.written.length, 1, "the version-checked update was attempted and refused");
  assert.deepEqual(r.events, [], "nothing is announced for an edit that did not happen");
});
