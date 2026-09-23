import assert from "node:assert/strict";
import { test } from "node:test";
import { editorServiceWith } from "./editor-service.ts";
import { isQuantityChanging, reviewResetPatch, type MeasuredState } from "./review-policy.ts";
import { buildRowUpdatePatch } from "./row-patch.ts";
import type { RowChangeEvent } from "./service.ts";
import {
  AT,
  SESSION_ID,
  TEST_BILL,
  TEST_SHEET,
  WALL_GEOMETRY,
  WALL_HEIGHT_M,
  WALL_ROW,
  WALL_RUN,
  emptyContext,
  lockedWith,
  unused,
} from "./editor-regression-fixtures.ts";

// ---------- the editor writes through the session lock, not around it ----------
//
// editor-service is the only path the editor's saves take, and it must do all
// of its writing through the context the unit of work hands it. These stand
// that context up in memory: no database, no lock, just proof that the seam is
// wired to it and that the maths survives the trip through it.

test("editor-service.updateGeometry: redraw wall 12.4m × 2.7m height = 33.48m²", async () => {
  const events: RowChangeEvent[] = [];
  const locked: string[] = [];
  const context = emptyContext(events);
  const written: Record<string, unknown>[] = [];
  const editedInPlace: { id: string; quantity: number | undefined; definition: unknown }[] = [];

  context.rows.rowById = async () => WALL_ROW;
  context.sheets.sheetById = async () => TEST_SHEET;
  // A redraw edits the shape BY ID. It used to delete the row's shapes and insert
  // a replacement, minting a new id and orphaning everything that named the old
  // one — row.deductions[].geometryId and the audit trail both do.
  // The double APPLIES the write, as the real repository does. The redraw writes
  // the shape and then re-adds the line from every shape still on it, so a double
  // that only recorded the write would feed the recompute the pre-edit vertices
  // and quietly assert the wrong figure.
  let liveGeometry = { ...WALL_GEOMETRY };
  context.geometries.geometriesByRow = async () => [liveGeometry];
  context.geometries.measurementGeometryForRow = async () => liveGeometry;
  context.geometries.updateGeometryMeasurement = async (id, patch) => {
    editedInPlace.push({ id, quantity: patch.quantity, definition: patch.definition });
    liveGeometry = {
      ...liveGeometry,
      vertices: patch.vertices ?? liveGeometry.vertices,
      quantity: patch.quantity ?? liveGeometry.quantity,
      unit: patch.unit ?? liveGeometry.unit,
      definition: patch.definition ?? liveGeometry.definition,
    };
  };
  context.rows.updateRowVersioned = async (id, version, patch) => {
    assert.equal(id, WALL_ROW.id);
    assert.equal(version, WALL_ROW.version, "the client's version is the one that is checked");
    written.push({ ...patch });
    return { ...WALL_ROW, ...patch, version: WALL_ROW.version + 1 };
  };

  const service = editorServiceWith(lockedWith(context, locked), async () => SESSION_ID);
  const row = await service.updateGeometry(
    WALL_ROW.id,
    { version: WALL_ROW.version, kind: "linear", vertices: WALL_RUN },
    "u_qs",
  );

  assert.deepEqual(locked, [SESSION_ID], "the redraw runs inside the lock on the row's own session");
  assert.equal(written.length, 1, "the row was written through the locked context, not the pool");
  assert.equal(written[0]!["qty_gross"], 33.48, "12.4 m of wall at 2.7 m high is 33.48 m2, not its bare 12.4 m run");
  assert.equal(written[0]!["qty"], 33.48, "no deductions and typical 1, so net matches gross");
  assert.equal(written[0]!["unit"], "m2", "the factor that made it an area survives the redraw");
  assert.equal(row.qtyGross, 33.48);
  assert.equal(editedInPlace.length, 1, "the geometry was edited in the same context as the row");
  assert.equal(editedInPlace[0]!.id, WALL_GEOMETRY.id, "and under its original id, never a fresh one");
  assert.equal(editedInPlace[0]!.quantity, 12.4, "the shape carries the drawn run; the ROW carries the 33.48 m2");
  assert.equal(
    (editedInPlace[0]!.definition as { factor?: { heightM?: number } }).factor?.heightM,
    WALL_HEIGHT_M,
    "the rewritten definition still records the height the line is billed through",
  );
  assert.deepEqual(
    events.map((e) => e.type),
    ["geometry.updated"],
    "the event is queued on the context, so the lock decides whether anyone hears it",
  );
});

test("editor-service.createMeasurement: creates a row with a stable geometry ID", async () => {
  const events: RowChangeEvent[] = [];
  const locked: string[] = [];
  const context = emptyContext(events);
  const inserted: { id: string; rowId: string }[] = [];

  context.sheets.sheetById = async () => TEST_SHEET;
  context.bills.billsBySession = async () => [TEST_BILL];
  context.rows.nextRowSort = async () => 4;
  context.rows.insertBoqRow = async (row) => ({ ...row, created_at: AT, updated_at: AT });
  context.geometries.insertGeometries = async (rows) => {
    for (const r of rows) inserted.push({ id: r.id, rowId: r.row_id });
  };

  const service = editorServiceWith(lockedWith(context, locked), unused("sessionIdForRow"));
  const result = await service.createMeasurement(
    SESSION_ID,
    { sheetId: TEST_SHEET.id, tool: "wall_area", vertices: WALL_RUN, description: "Blockwork to external walls", elementGroup: "External walls", factor: { heightM: WALL_HEIGHT_M } },
    "u_qs",
  );

  assert.deepEqual(locked, [SESSION_ID], "a new line is created inside the session lock");
  assert.equal(result.row.qty, 33.48, "12.4 m of wall at 2.7 m high is 33.48 m2");
  assert.equal(result.row.unit, "m2");
  assert.ok(result.geometry.id, "the drawn shape comes back with an id the client can address it by");
  assert.equal(inserted.length, 1, "the shape is written through the locked context");
  assert.equal(inserted[0]!.id, result.geometry.id, "the id returned is the id stored — the evidence is findable");
  assert.equal(result.geometry.rowId, result.row.id, "the shape is attached to the line it measures");
  assert.equal(inserted[0]!.rowId, result.row.id);
  assert.deepEqual(
    events.map((e) => e.type),
    ["row.created"],
    "the creation is announced once, after the unit of work says so",
  );
});

// ---------- the review policy: which edits invalidate a sign-off ----------

// The policy compares VALUES now, not which fields the request mentioned. The
// helper builds the two states a save moves between.
const stateOf = (over: Partial<MeasuredState> = {}): MeasuredState => ({
  qty: 18.9,
  gross: 18.9,
  unit: "m2",
  typical: 1,
  heightM: 2.7,
  depthM: null,
  deductions: [],
  ...over,
});

test("review-policy: a moved figure needs review", () => {
  const before = stateOf();
  assert.equal(isQuantityChanging(before, stateOf({ qty: 20 })), true, "a new figure is a new figure, whoever measured it");
  assert.equal(isQuantityChanging(before, stateOf({ unit: "m3" })), true, "the same number billed in another unit is another quantity");
  assert.equal(isQuantityChanging(before, stateOf({ typical: 4 })), true, "four identical floors is four times the quantity");
  assert.equal(isQuantityChanging(before, stateOf({ heightM: 3.1 })), true, "a taller wall is a larger area");
  assert.equal(isQuantityChanging(before, stateOf({ depthM: 0.2 })), true, "a deeper slab is a larger volume");
  assert.equal(
    isQuantityChanging(before, stateOf({ deductions: [{ label: "Door", qty: 2, geometryId: "pgeo_1", unit: "m2", unitConfirmed: true }] })),
    true,
    "an opening taken out of it changes the net figure",
  );
});

test("review-policy: re-sending the SAME figure is not a change", () => {
  // The regression this replaces: the old rule asked only whether `qty` was
  // present in the payload, so the editor — which sends the whole line on every
  // save — stripped a valid sign-off each time it saved an untouched figure.
  assert.equal(isQuantityChanging(stateOf(), stateOf()), false, "an identical save invalidates nothing");
  assert.equal(
    isQuantityChanging(stateOf({ qty: 18.9 }), stateOf({ qty: 18.9004 })),
    false,
    "re-deriving the same measurement lands within the bill's own 2dp precision",
  );
  assert.equal(isQuantityChanging(stateOf({ qty: 18.9 }), stateOf({ qty: 18.91 })), true, "but a real 2dp move counts");
});

test("review-policy: the reset clears the verifier, not just the status", () => {
  assert.deepEqual(reviewResetPatch(), { status: "needs_review", verified_by: null, verified_at: null });
});

test("review-policy: a manually authored verified row still needs review after a qty edit", () => {
  // WALL_ROW is origin "manual" with no AI confidence attached: the old
  // origin-based rule left it verified, which let a hand-entered line change
  // its quantity and keep a sign-off for the figure it no longer carries.
  const { patch, noOp } = buildRowUpdatePatch(WALL_ROW, { qty: 20 }, "u_qs");
  assert.equal(noOp, false, "the figure moved, so this is a real save");
  assert.equal(patch.status, "needs_review");
  assert.equal(patch.verified_by, null);
  assert.equal(patch.verified_at, null);
  assert.equal(patch.qty, 20);

  const rateOnly = buildRowUpdatePatch(WALL_ROW, { rate: 14500 }, "u_qs");
  assert.equal(rateOnly.patch.status, undefined, "a rate edit leaves the verification exactly as it found it");
  assert.equal(rateOnly.patch.verified_by, undefined);
  assert.equal(rateOnly.noOp, false, "but it is still a real write: the amount moves");
});

test("review-policy: re-saving a row's own stored values is a no-op", () => {
  const resent = buildRowUpdatePatch(
    WALL_ROW,
    { qty: Number(WALL_ROW.qty), unit: WALL_ROW.unit ?? undefined, description: WALL_ROW.description },
    "u_qs",
  );
  assert.equal(resent.noOp, true, "nothing moved, so nothing is written and the version does not advance");
  assert.equal(resent.patch.status, undefined, "and the sign-off is left exactly as it was found");
  assert.equal(resent.patch.verified_by, undefined);
});

test("editor-service.saveAndVerify: the save and the sign-off land in one locked unit", async () => {
  const events: RowChangeEvent[] = [];
  const locked: string[] = [];
  const context = emptyContext(events);
  const writes: { version: number; patch: Record<string, unknown> }[] = [];

  // the fake carries state forward the way the table would: the verify runs
  // against the row the save left behind, not against the row as first read
  let current = WALL_ROW;
  context.rows.rowById = async () => current;
  context.rows.updateRowVersioned = async (_id, version, patch) => {
    writes.push({ version, patch: { ...patch } });
    if (version !== current.version) return null;
    current = { ...current, ...patch, version: version + 1 };
    return current;
  };

  const service = editorServiceWith(lockedWith(context, locked), async () => SESSION_ID);
  const row = await service.saveAndVerify(WALL_ROW.id, { version: WALL_ROW.version, changes: { qty: 20 } }, "u_qs");

  assert.deepEqual(locked, [SESSION_ID], "both writes run under one lock on the row's own session");
  assert.equal(writes.length, 2, "the edit and the verification are two writes in one transaction");
  assert.equal(writes[0]!.version, WALL_ROW.version, "the edit checks the version the client held");
  assert.equal(writes[0]!.patch["status"], "needs_review", "the edit alone leaves the line unreviewed");
  assert.equal(writes[1]!.version, WALL_ROW.version + 1, "the sign-off names the version the save produced, not the client's");
  assert.equal(writes[1]!.patch["status"], "verified");
  assert.equal(writes[1]!.patch["verified_by"], "u_qs");
  assert.equal(row.status, "verified");
  assert.equal(row.qty, 20);
  assert.deepEqual(
    events.map((e) => e.type),
    ["row.updated", "row.verified"],
    "neither event is published until the unit of work commits both writes",
  );
});

test("editor-service.saveAndVerify: a stale version verifies nothing", async () => {
  const events: RowChangeEvent[] = [];
  const context = emptyContext(events);
  const writes: number[] = [];

  context.rows.rowById = async () => WALL_ROW;
  context.rows.updateRowVersioned = async (_id, version) => {
    writes.push(version);
    return null;
  };

  const service = editorServiceWith(lockedWith(context, []), async () => SESSION_ID);
  await assert.rejects(
    service.saveAndVerify(WALL_ROW.id, { version: WALL_ROW.version - 1, changes: { qty: 20 } }, "u_qs"),
    /updated by someone else/i,
  );
  assert.equal(writes.length, 1, "the save is refused, so the sign-off is never attempted");
  assert.deepEqual(events, [], "nothing is announced for an edit that did not happen");
});
