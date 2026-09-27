// What a bill line tells the client about itself, read back off the real
// snapshot route rather than off a mapper in isolation.
//
// Two separate holes this pins.
//
//   * The names a QS gives the instances a typical line stands for were written
//     and never served. `set-measurement-settings` persisted "Bay 1 … Bay 12"
//     and the snapshot returned only `typical: 12`, so after a reload the
//     inspector had nothing to show and seeded placeholders — "As measured",
//     "Repeat 2". The ×12 survived; WHICH twelve did not, which is the whole
//     point of naming them. Worse, the names are what `split-repeat-exception`
//     takes its argument from, so a reload left the QS guessing the label of the
//     bay they wanted to bill separately.
//   * An opening records its mode and the dimensions that were typed on its own
//     geometry definition. `toRowsWithMeasurement` rejoins them, but nothing
//     asserted that they survive the route — a response allowlist that dropped
//     them would put the panel back to re-deriving 0.9 × 2.1 from 1.89 m².
//
// The settings are a jsonb column older code also wrote, so they are projected
// field by field on the way out: a client is handed the record, never whatever
// happens to be in the column.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import type { PreconBoqRowDto, PreconGeometry } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "rowdto");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );

/** The line as the take-off route actually serves it. */
async function served(rowId: string): Promise<PreconBoqRowDto> {
  const snapshot = await preconService(preconRepository(db), noop).getSnapshot(fixture.sessionId);
  const row = snapshot.rows.find((candidate) => candidate.id === rowId);
  assert.ok(row, `line ${rowId} is in the snapshot`);
  return row;
}

/** The drawings of one line, as the take-off route actually serves them. */
async function servedShapes(rowId: string): Promise<PreconGeometry[]> {
  const snapshot = await preconService(preconRepository(db), noop).getSnapshot(fixture.sessionId);
  return snapshot.geometries.filter((geometry) => geometry.rowId === rowId);
}

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

/** One 4 m × 3 m bay, measured once. 12 m² gross. */
const bay = (label: string, at: number): Promise<OperationReceipt> =>
  apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: rect(at, 0, 4, 3),
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
  });

describe("the names a typical line stands for survive a reload", () => {
  test("the snapshot carries every label, in the order they were given", async () => {
    const rowId = (await bay("Named bays", 0)).rows[0]!.id;
    assert.equal(
      (await served(rowId)).measurementSettings,
      null,
      "a line that has never recorded any settings says so, rather than serving an empty record",
    );

    const labels = ["Bay 1", "Bay 2", "Bay 3", "Bay 4"];
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: labels });

    const row = await served(rowId);
    assert.equal(row.typical, 4, "four names is four bays; N counts the measured one");
    assert.deepEqual(
      row.measurementSettings?.repeatLabels,
      labels,
      "and the client reads the names back instead of seeding placeholders",
    );
    assert.equal(row.measurementSettings?.quantityMode, "measured", "the figure is still the one that was drawn");
    assert.equal(row.qty, 48, "12 m² × 4");
  });

  test("the label taken out of the set is gone from the names the client is served", async () => {
    const rowId = (await bay("Split bays", 10)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["A", "B", "C"] });
    await apply({ kind: "split-repeat-exception", rowId, label: "B", confirmed: true });

    const row = await served(rowId);
    assert.deepEqual(row.measurementSettings?.repeatLabels, ["A", "C"], "B is billed on its own line now");
    assert.equal(row.typical, 2);
  });
});

describe("the settings are a projection, never the raw column", () => {
  test("a record written by older code reaches the client only as the fields it declares", async () => {
    const rowId = (await bay("Legacy settings", 20)).rows[0]!.id;
    await db("precon_boq_rows")
      .where({ id: rowId })
      .update({
        measurement_settings: JSON.stringify({
          schemaVersion: 1,
          quantityMode: "measured",
          repeatLabels: ["Kept", "Also kept"],
          internalNote: "never serve this",
          statedQuantity: { tool: "area", qty: "not a number", unit: "m2", actor: "x", at: "y" },
        }),
      });

    const settings = (await served(rowId)).measurementSettings;
    assert.deepEqual(settings?.repeatLabels, ["Kept", "Also kept"], "the names it does declare come through");
    assert.equal(
      Object.hasOwn(settings ?? {}, "internalNote"),
      false,
      "a key the record does not declare is not passed on to a client",
    );
    assert.equal(
      settings?.statedQuantity,
      undefined,
      "and a stated figure whose quantity is not a number is dropped, not served as one",
    );
  });

  test("a settings column that is not an object at all serves null rather than throwing", async () => {
    const rowId = (await bay("Broken settings", 30)).rows[0]!.id;
    await db("precon_boq_rows").where({ id: rowId }).update({ measurement_settings: JSON.stringify(["nonsense"]) });
    assert.equal((await served(rowId)).measurementSettings, null);
  });

  test("a stated figure is served with the tool and unit it was stated in", async () => {
    // A figure given in words has no shape, so `measurement_settings` is the
    // ONLY record of what was stated (contract 17). Serving it is what stops a
    // client parsing the basis sentence back.
    const stated = await preconService(preconRepository(db), noop).createStatedMeasurement(
      fixture.sessionId,
      { tool: "area", qty: 7.5, description: `Stated line ${randomUUID().slice(0, 6)}`, elementGroup: "Slabs" },
      fixture.actor,
    );

    const settings = (await served(stated.id)).measurementSettings;
    assert.equal(settings?.quantityMode, "stated", "the client can tell a stated line from a measured one");
    assert.equal(settings?.statedQuantity?.qty, 7.5);
    assert.equal(settings?.statedQuantity?.unit, "m2");
    assert.equal(settings?.statedQuantity?.actor, fixture.actor, "attributed to whoever stated it");
    assert.ok(settings?.statedQuantity?.at, "and timestamped");
  });
});

describe("an opening reaches the client as it was entered", () => {
  test("mode and typed dimensions come through the snapshot route, not just the mapper", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [
        [m(0), m(60)],
        [m(10), m(60)],
      ],
      description: `Snapshot wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 3 },
    });
    const rowId = created.rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Door D1",
      mode: "wall-opening",
      dimensions: { widthM: 0.9, heightM: 2.1 },
    });

    const opening = (await served(rowId)).deductions[0]!;
    assert.equal(opening.label, "Door D1");
    assert.equal(opening.qty, 1.89, "0.9 × 2.1");
    assert.equal(opening.mode, "wall-opening", "served, so the panel never re-derives it from the unit");
    assert.deepEqual(opening.dimensions, { widthM: 0.9, heightM: 2.1 }, "as the numbers that were typed");
  });
});

// A line is not one shape. The row-level `measurementDefinition` is ONE
// definition chosen by last-write-wins across the line's drawings, so on a line
// measured by two of them it describes one and silently mis-describes the
// other. The viewer therefore refused to open shape editing on any multi-shape
// line and fell back to dragging tessellation vertices — which is how a saved
// arc gets flattened into chords.
describe("every drawing states its own measurement, not the line's last one", () => {
  test("a curved bay and a straight one on the same line each keep their own shape", async () => {
    const straight = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 120, 4, 4),
      description: `Straight bay ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const curved = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      shape: {
        role: "path",
        start: [m(20), m(120)],
        segments: [
          { kind: "arc", mid: [m(24), m(118)], end: [m(28), m(120)] },
          { kind: "line", end: [m(28), m(124)] },
          { kind: "line", end: [m(20), m(124)] },
        ],
        closed: true,
      },
      description: `Curved bay ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });

    const keepId = straight.rows[0]!.id;
    const movingId = (await servedShapes(curved.rows[0]!.id))[0]!.id;
    await apply({ kind: "reassign-geometry", geometryId: movingId, targetRowId: keepId });

    const shapes = await servedShapes(keepId);
    assert.equal(shapes.length, 2, "the line is measured by two drawings");
    const moved = shapes.find((shape) => shape.id === movingId);
    const other = shapes.find((shape) => shape.id !== movingId);
    assert.ok(moved && other);

    const segmentsOf = (geometry: PreconGeometry): { kind: string }[] => {
      const shape = geometry.definition?.role === "measurement" ? geometry.definition.shape : null;
      return shape && shape.role === "path" ? shape.segments : [];
    };
    assert.ok(
      segmentsOf(moved).some((segment) => segment.kind === "arc"),
      "the curved bay still states its arc, so the editor can offer a bend handle",
    );
    assert.equal(
      segmentsOf(other).some((segment) => segment.kind === "arc"),
      false,
      "and the straight one is not described by its neighbour's definition",
    );
    assert.equal(moved.definition?.role, "measurement");
    assert.equal(moved.parentGeometryId, null, "a measuring drawing is nobody's opening");
  });

  test("an opening names the drawing it was cut out of", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 140, 4, 4),
      description: `Cut host ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const parentId = (await servedShapes(rowId))[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Riser",
      mode: "area",
      vertices: rect(1, 141, 1, 1),
      sheetId: fixture.sheetId,
    });

    const cut = (await servedShapes(rowId)).find((shape) => shape.kind === "deduction");
    assert.ok(cut, "the opening is served as a drawing of its own");
    assert.equal(cut.parentGeometryId, parentId, "pointing at the outline it is a hole in");
    assert.equal(cut.definition?.role, "deduction", "and saying it is an opening, not a measurement");
  });

  test("on a line measured by two drawings, an opening is cut out of the one that holds it", async () => {
    const near = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 180, 4, 4),
      description: `Near bay ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const far = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(40, 180, 4, 4),
      description: `Far bay ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const keepId = near.rows[0]!.id;
    const nearShapeId = (await servedShapes(keepId))[0]!.id;
    const farShapeId = (await servedShapes(far.rows[0]!.id))[0]!.id;
    await apply({ kind: "reassign-geometry", geometryId: farShapeId, targetRowId: keepId });

    // The void is plainly inside the NEAR bay. The far bay is the line's newest
    // drawing, so picking that one refuses this outright — which is what it did.
    await apply({
      kind: "add-deduction",
      rowId: keepId,
      label: "Void in the near bay",
      mode: "area",
      vertices: rect(1, 181, 1, 1),
      sheetId: fixture.sheetId,
    });

    const cut = (await servedShapes(keepId)).find((shape) => shape.kind === "deduction");
    assert.ok(cut, "the opening was accepted, because it is inside a drawing on this line");
    assert.equal(cut.parentGeometryId, nearShapeId, "and it is a hole in the bay that actually holds it");
    assert.notEqual(cut.parentGeometryId, farShapeId, "not in whichever drawing happened to be added last");
  });

  test("a drawing that records nothing serves null, and a malformed record never reaches the client", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 160, 4, 4),
      description: `Legacy shape ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const shapeId = (await servedShapes(rowId))[0]!.id;

    await db("precon_geometries").where({ id: shapeId }).update({ definition: null });
    assert.equal((await servedShapes(rowId))[0]!.definition, null, "a legacy drawing states that it recorded none");

    await db("precon_geometries")
      .where({ id: shapeId })
      .update({ definition: JSON.stringify({ schemaVersion: 9, role: "nonsense", secret: "never serve this" }) });
    const served = (await servedShapes(rowId))[0]!;
    assert.equal(served.definition, null, "and an unreadable one is dropped, not passed through");
    assert.equal(
      JSON.stringify(served).includes("never serve this"),
      false,
      "nothing the record does not declare reaches a client",
    );
  });
});
