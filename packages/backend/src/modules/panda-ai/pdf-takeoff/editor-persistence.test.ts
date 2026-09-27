// The persistence contract a saved measurement has to keep, against real
// Postgres: the definition that records HOW it was measured, the geometry id
// that stays the same shape across an edit, and the refusal to invent a factor
// nobody recorded.
//
// These are the three things the recovery audit found broken. Each assertion
// here failed before the fix and names what the bill would silently lose:
// a redrawn wall billed at its bare run, a deduction orphaned from the shape it
// was cut out of, a height guessed out of an English sentence.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { generateId } from "../../../lib/ids.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorService } from "./editor-service.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import type { MeasurementDefinitionV1 } from "./editor-types.ts";
import type { CreateMeasurementBody, MeasureTool, PreconGeometryRow } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-persist");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const noop = (): void => {};

function editor(): ReturnType<typeof editorService> {
  return editorService(db, noop);
}

function measurement(tool: MeasureTool, vertices: number[][], extra: Partial<CreateMeasurementBody> = {}) {
  return {
    sheetId: fixture.sheetId,
    tool,
    vertices,
    description: `QA ${tool}`,
    elementGroup: "Walls",
    ...extra,
  } satisfies CreateMeasurementBody;
}

/** The polyline the plan's fixtures use: 3 m across then 4 m up = 7 m. */
const SEVEN_METRE_RUN = [
  [m(0), m(0)],
  [m(3), m(0)],
  [m(3), m(4)],
];

/** The plan's 6 m × 4 m room = 24 m2. */
const TWENTY_FOUR_SQUARE = [
  [m(0), m(0)],
  [m(6), m(0)],
  [m(6), m(4)],
  [m(0), m(4)],
];

const FIVE_MARKERS = [
  [m(1), m(1)],
  [m(2), m(1)],
  [m(3), m(1)],
  [m(4), m(1)],
  [m(5), m(1)],
];

function storedDefinition(geometry: PreconGeometryRow): MeasurementDefinitionV1 {
  assert.ok(
    geometry.definition !== null && geometry.definition !== undefined,
    `geometry ${geometry.id} was stored with definition NULL: nothing records which tool measured it, ` +
      "so a later redraw has to guess the factor or refuse the edit",
  );
  const definition = geometry.definition as MeasurementDefinitionV1;
  assert.equal(definition.schemaVersion, 1, "a stored measurement outlives its code and must name its schema");
  assert.equal(definition.role, "measurement");
  return definition;
}

async function geometryRow(id: string): Promise<PreconGeometryRow> {
  const row = await db<PreconGeometryRow>("precon_geometries").where({ id }).first();
  assert.ok(row, `geometry ${id} is gone from the database`);
  return row;
}

describe("creation persists the measurement as it was made", () => {
  // Contract 3: "New manual, assembly and engine outputs populate structured
  // definitions only from known inputs." The definition is the whole point —
  // vertices alone cannot say that a 7 m run was billed as 18.9 m2 of wall.
  const cases: { tool: MeasureTool; vertices: number[][]; factor?: { heightM?: number; depthM?: number }; qty: number; unit: string }[] = [
    { tool: "length", vertices: [[m(0), m(0)], [m(3), m(0)]], qty: 3, unit: "m" },
    { tool: "polyline", vertices: SEVEN_METRE_RUN, qty: 7, unit: "m" },
    { tool: "area", vertices: TWENTY_FOUR_SQUARE, qty: 24, unit: "m2" },
    { tool: "count", vertices: FIVE_MARKERS, qty: 5, unit: "nr" },
    { tool: "wall_area", vertices: SEVEN_METRE_RUN, factor: { heightM: 2.7 }, qty: 18.9, unit: "m2" },
    { tool: "volume", vertices: TWENTY_FOUR_SQUARE, factor: { depthM: 0.15 }, qty: 3.6, unit: "m3" },
  ];

  for (const { tool, vertices, factor, qty, unit } of cases) {
    test(`${tool}: the quantity, the unit and the definition all survive the round-trip`, async () => {
      const created = await editor().createMeasurement(
        fixture.sessionId,
        measurement(tool, vertices, factor ? { factor } : {}),
        fixture.actor,
      );

      assert.equal(created.row.qty, qty, `${tool} must bill ${qty} ${unit}`);
      assert.equal(created.row.unit, unit);

      const stored = await geometryRow(created.geometry.id);
      const definition = storedDefinition(stored);
      assert.equal(definition.tool, tool, "the tool that drew the line is what a redraw must re-measure with");

      if (factor?.heightM !== undefined) {
        assert.equal(
          definition.factor?.heightM,
          factor.heightM,
          "the wall height has to be stored, or a redraw bills the bare run",
        );
      }
      if (factor?.depthM !== undefined) {
        assert.equal(definition.factor?.depthM, factor.depthM, "the slab depth has to be stored");
      }

      if (tool === "count") {
        assert.equal(definition.shape.role, "points", "counted items are points, never a path");
        assert.equal(definition.scale, undefined, "a count is not measured against a scale");
      } else {
        assert.equal(definition.shape.role, "path");
        assert.equal(
          definition.scale?.appliedMmPerPt,
          50,
          "the scale the figure was taken against is part of the record",
        );
        assert.equal(definition.scale?.sheetVersion, 1, "and the sheet version it was true for");
      }
    });
  }
});

describe("a point edit corrects the shape without losing its identity", () => {
  test("the geometry id, the tool and the factor all survive moving a vertex", async () => {
    const created = await editor().createMeasurement(
      fixture.sessionId,
      measurement("wall_area", SEVEN_METRE_RUN, { factor: { heightM: 2.7 } }),
      fixture.actor,
    );
    assert.equal(created.row.qty, 18.9);
    const originalGeometryId = created.geometry.id;

    // the last point pulled back from 4 m to 2 m: a 5 m run, still 2.7 m high
    const corrected = [
      [m(0), m(0)],
      [m(3), m(0)],
      [m(3), m(2)],
    ];
    const updated = await editor().updateGeometry(
      created.row.id,
      { version: created.row.version, kind: "linear", vertices: corrected, sheetId: fixture.sheetId },
      fixture.actor,
    );

    assert.equal(updated.qty, 13.5, "5 m run × 2.7 m height = 13.5 m2; the height must not be dropped");
    assert.equal(updated.unit, "m2", "the line is still billed in square metres");

    const live = await preconGeometryRepository(db).measurementGeometryForRow(created.row.id);
    assert.ok(live, "the corrected line still has a measurement");
    assert.equal(
      live.id,
      originalGeometryId,
      "editing a shape must update it by id, not delete the row's shapes and insert a new one: " +
        "row.deductions and the audit trail both name the old id",
    );
    assert.equal(
      (await db("precon_geometries").where({ row_id: created.row.id }).count("* as n").first())?.["n"],
      "1",
      "a corrected shape is one shape, not two",
    );
    assert.deepEqual(live.vertices, corrected, "the stored shape is the corrected one");

    const definition = storedDefinition(live);
    assert.equal(definition.tool, "wall_area", "the tool is unchanged by a vertex move");
    assert.equal(definition.factor?.heightM, 2.7, "and so is the height it is billed through");
    assert.equal(definition.shape.role, "path");
  });

  test("a quantity-changing edit leaves the line needing review", async () => {
    const created = await editor().createMeasurement(
      fixture.sessionId,
      measurement("polyline", SEVEN_METRE_RUN),
      fixture.actor,
    );
    assert.equal(created.row.status, "verified", "a hand-drawn line lands verified: the existing creation policy");

    const updated = await editor().updateGeometry(
      created.row.id,
      {
        version: created.row.version,
        kind: "linear",
        vertices: [
          [m(0), m(0)],
          [m(3), m(0)],
        ],
        sheetId: fixture.sheetId,
      },
      fixture.actor,
    );
    assert.equal(updated.qty, 3);
    assert.equal(updated.status, "needs_review", "a changed quantity is not still signed off");
    assert.equal(updated.verifiedBy, null, "and the old verifier's name does not travel with the new figure");
  });
});

describe("legacy geometry is never given parameters nobody recorded", () => {
  // Contract 3 and 22: "Display existing basis verbatim; do not parse prose,
  // guess height/depth, reconstruct arcs". A height read out of an English
  // sentence is a number on a priced line that nobody measured.
  async function legacyWall(): Promise<{ rowId: string; geometryId: string }> {
    const rowId = generateId("pbr");
    const geometryId = generateId("pgeo");
    await db("precon_boq_rows").insert({
      id: rowId,
      bill_id: fixture.billId,
      sort: 900,
      row_type: "item",
      description: "Legacy blockwork, no recorded factors",
      unit: "m2",
      qty_gross: 18.9,
      deductions: JSON.stringify([]),
      qty: 18.9,
      version: 1,
      // the shape of basis the old code wrote, and then read back as data
      measurement_basis: "7 m polyline on QA-01 × 2.7 m height = 18.9 m2",
      origin: "migrated",
      status: "verified",
    });
    await db("precon_geometries").insert({
      id: geometryId,
      row_id: rowId,
      sheet_id: fixture.sheetId,
      kind: "linear",
      vertices: JSON.stringify(SEVEN_METRE_RUN),
      source: "manual",
      quantity: 7,
      unit: "m",
      definition: null,
    });
    return { rowId, geometryId };
  }

  test("a redraw of an unclassified legacy line is refused, not measured off its prose", async () => {
    const { rowId, geometryId } = await legacyWall();
    const before = await geometryRow(geometryId);

    await assert.rejects(
      editor().updateGeometry(
        rowId,
        {
          version: 1,
          kind: "linear",
          vertices: [
            [m(0), m(0)],
            [m(5), m(0)],
          ],
          sheetId: fixture.sheetId,
        },
        fixture.actor,
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          /does not record which tool measured it/i,
          "the refusal has to name what the QS must confirm, not fail obscurely",
        );
        return true;
      },
      "the basis sentence says '× 2.7 m height'; reading 2.7 out of it is a guess dressed as a measurement",
    );

    const untouched = await geometryRow(geometryId);
    assert.deepEqual(untouched.vertices, before.vertices, "a refused edit changes no shape");
    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty"]), 18.9, "and no quantity");
    assert.equal(row?.["version"], 1, "and does not move the version on");
  });
});
