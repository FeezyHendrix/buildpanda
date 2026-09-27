// The foundation contracts the editor stands on, against real Postgres.
//
// Each block here is a gap my own recovery-persistence.md listed as still open.
// They are the ones that would make a correct-looking UI produce a wrong bill:
// a count refused on an unscaled sheet, a geometry column that means "base" on
// creation and "gross" after an edit, a row with two shapes that loses one when
// either is corrected, an assembly line whose factor exists only inside an
// English sentence, and a stated quantity with no typed record at all.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import type { MeasurementDefinitionV1 } from "./editor-types.ts";
import type { PreconGeometryRow } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;
/** A second sheet with NO scale at all, for the count-is-scale-free contract. */
let unscaledSheetId: string;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-foundation");
  unscaledSheetId = `pcsh_noscale_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: unscaledSheetId,
    session_id: fixture.sessionId,
    file_name: "unscaled.pdf",
    storage_path: `qa-fixture/${unscaledSheetId}.pdf`,
    page_number: 2,
    code: "QA-02",
    title: "Uncalibrated plan",
    kind: "floor-plan",
    status: "pending",
    scale_mm_per_pt: null,
    dim_unit: null,
    version: 1,
  });
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const newOperationId = (): string => `op_${randomUUID()}`;

function apply(command: EditorCommand): Promise<OperationReceipt> {
  return editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: newOperationId(), command },
    fixture.actor,
    GRANTS,
  );
}

async function geometryRow(id: string): Promise<PreconGeometryRow> {
  const row = await db<PreconGeometryRow>("precon_geometries").where({ id }).first();
  assert.ok(row, `geometry ${id} is missing`);
  return row;
}

async function rowFigures(id: string): Promise<{ gross: number | null; qty: number | null; unit: string | null }> {
  const row = await db("precon_boq_rows").where({ id }).first();
  assert.ok(row, `row ${id} is missing`);
  return {
    gross: row["qty_gross"] === null ? null : Number(row["qty_gross"]),
    qty: row["qty"] === null ? null : Number(row["qty"]),
    unit: row["unit"] as string | null,
  };
}

const RUN_7M = [
  [m(0), m(0)],
  [m(3), m(0)],
  [m(3), m(4)],
];

const ROOM_24M2 = [
  [m(0), m(0)],
  [m(6), m(0)],
  [m(6), m(4)],
  [m(0), m(4)],
];

describe("counting items needs no scale", () => {
  // Contract 24: "Count creation/recompute bypasses scaleAt entirely."
  // scaleAt throws "Set the sheet scale first" on an uncalibrated sheet, so a
  // count — five doors are five doors at any scale — was refused outright.
  test("a count on a sheet with no scale at all is measured", async () => {
    const receipt = await apply({
      kind: "create-geometry",
      sheetId: unscaledSheetId,
      tool: "count",
      vertices: [
        [10, 10],
        [20, 10],
        [30, 10],
        [40, 10],
        [50, 10],
      ],
      description: "Doors on an uncalibrated sheet",
      elementGroup: "Doors",
    });

    const figures = await rowFigures(receipt.rows[0]!.id);
    assert.equal(figures.qty, 5, "five marks are five items");
    assert.equal(figures.unit, "nr");

    const geometry = await geometryRow(receipt.geometries[0]!.id);
    const definition = geometry.definition as MeasurementDefinitionV1;
    assert.equal(definition.tool, "count");
    assert.equal(definition.scale, undefined, "and no scale is recorded, because none was used");

    const row = await db("precon_boq_rows").where({ id: receipt.rows[0]?.id }).first();
    assert.doesNotMatch(
      String(row?.["measurement_basis"]),
      /1:|mm per unit|viewport/,
      "the basis states no scale clause for a count",
    );
  });

  test("a dimensional measurement on the same unscaled sheet is still refused", async () => {
    await assert.rejects(
      apply({
        kind: "create-geometry",
        sheetId: unscaledSheetId,
        tool: "area",
        vertices: ROOM_24M2,
        description: "Slab on an uncalibrated sheet",
        elementGroup: "Slabs",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError, "an area without a scale is a 400, not a silent zero");
        assert.match(error.message, /scale/i);
        return true;
      },
    );
  });
});

describe("the geometry column means the drawn figure, the row means the billed one", () => {
  // The inconsistency my own evidence flagged: creation stored the BASE figure
  // (7 m of run) while a redraw and a factor change stored the GROSS (18.9 m2).
  // A reader could not tell which a given row's shape carried.
  test("creation, redraw and factor change all store the base figure on the shape", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: RUN_7M,
      description: `Base-figure wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    const geometryId = created.geometries[0]!.id;
    const rowId = created.rows[0]!.id;

    const onCreate = await geometryRow(geometryId);
    assert.equal(Number(onCreate.quantity), 7, "the shape carries its 7 m run");
    assert.equal(onCreate.unit, "m", "in the unit the run was measured in");
    assert.deepEqual(await rowFigures(rowId), { gross: 18.9, qty: 18.9, unit: "m2" }, "the row carries the billed area");

    await apply({ kind: "update-geometry", geometryId, vertices: [[m(0), m(0)], [m(3), m(0)], [m(3), m(2)]] });
    const onRedraw = await geometryRow(geometryId);
    assert.equal(Number(onRedraw.quantity), 5, "after a redraw the shape still carries the RUN, not the area");
    assert.equal(onRedraw.unit, "m", "and still in metres");
    assert.deepEqual(await rowFigures(rowId), { gross: 13.5, qty: 13.5, unit: "m2" });

    await apply({ kind: "set-row-factor", rowId, heightM: 3 });
    const onFactor = await geometryRow(geometryId);
    assert.equal(Number(onFactor.quantity), 5, "a factor change does not touch the drawn run");
    assert.equal(onFactor.unit, "m");
    assert.deepEqual(await rowFigures(rowId), { gross: 15, qty: 15, unit: "m2" }, "5 m × 3 m = 15 m2");
  });
});

describe("a line measured by more than one shape", () => {
  /** An engine-drafted line whose quantity is two separate runs of the same wall. */
  async function twoShapeWall(): Promise<{ rowId: string; first: string; second: string }> {
    const rowId = generateId("pbr");
    const first = generateId("pgeo");
    const second = generateId("pgeo");
    const definition = (vertices: number[][]): MeasurementDefinitionV1 => ({
      schemaVersion: 1,
      role: "measurement",
      tool: "wall_area",
      shape: { role: "path", start: [vertices[0]![0]!, vertices[0]![1]!], segments: vertices.slice(1).map((v) => ({ kind: "line", end: [v[0]!, v[1]!] })), closed: false },
      factor: { heightM: 2.7 },
      scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: 50 },
    });
    // 7 m + 3 m of run, both at 2.7 m high => (7 + 3) × 2.7 = 27 m2
    await db("precon_boq_rows").insert({
      id: rowId,
      bill_id: fixture.billId,
      sort: 800,
      row_type: "item",
      description: "Blockwork in two runs",
      unit: "m2",
      qty_gross: 27,
      deductions: JSON.stringify([]),
      qty: 27,
      version: 1,
      measurement_basis: "10 m polyline on QA-01 × 2.7 m height = 27 m2",
      origin: "ai",
      status: "ai_generated",
    });
    const shapes = [
      { id: first, vertices: RUN_7M, base: 7 },
      { id: second, vertices: [[m(0), m(8)], [m(3), m(8)]], base: 3 },
    ];
    for (const shape of shapes) {
      await db("precon_geometries").insert({
        id: shape.id,
        row_id: rowId,
        sheet_id: fixture.sheetId,
        kind: "linear",
        vertices: JSON.stringify(shape.vertices),
        source: "ai",
        quantity: shape.base,
        unit: "m",
        definition: JSON.stringify(definition(shape.vertices)),
      });
    }
    return { rowId, first, second };
  }

  test("editing the second shape by id leaves the first alone and re-adds both", async () => {
    const { rowId, first, second } = await twoShapeWall();

    // stretch the 3 m run to 5 m: (7 + 5) × 2.7 = 32.4 m2
    const receipt = await apply({
      kind: "update-geometry",
      geometryId: second,
      vertices: [[m(0), m(8)], [m(5), m(8)]],
    });

    const untouched = await geometryRow(first);
    assert.deepEqual(untouched.vertices, RUN_7M, "the shape nobody selected is exactly as it was");
    assert.equal(untouched.deleted_at, null, "and is certainly not withdrawn");
    assert.equal(Number((await geometryRow(second)).quantity), 5, "the selected shape is the one that moved");

    assert.deepEqual(
      await rowFigures(rowId),
      { gross: 32.4, qty: 32.4, unit: "m2" },
      "the line is re-added from EVERY active shape on it: (7 + 5) m × 2.7 m",
    );
    assert.equal(
      receipt.geometries.length,
      2,
      "and the receipt names both shapes, because both are contributions to the figure it changed",
    );
  });

  test("a deduction on the line survives editing one of its shapes", async () => {
    const { rowId, second } = await twoShapeWall();
    const cutoutId = generateId("pgeo");
    await db("precon_geometries").insert({
      id: cutoutId,
      row_id: rowId,
      sheet_id: fixture.sheetId,
      kind: "deduction",
      vertices: JSON.stringify([[m(1), m(1)], [m(3), m(1)], [m(3), m(2)], [m(1), m(2)]]),
      source: "manual",
      quantity: 2,
      unit: "m2",
    });
    const deductions = [{ label: "Door opening", qty: 2, geometryId: cutoutId, unit: "m2", unitConfirmed: true }];
    await db("precon_boq_rows").where({ id: rowId }).update({ deductions: JSON.stringify(deductions), qty: 25 });

    await apply({ kind: "update-geometry", geometryId: second, vertices: [[m(0), m(8)], [m(5), m(8)]] });

    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty_gross"]), 32.4, "gross re-added from both runs");
    assert.equal(Number(row?.["qty"]), 30.4, "net still has the 2 m2 opening taken out: 32.4 − 2");
    assert.deepEqual(
      (row?.["deductions"] as typeof deductions).map((d) => d.geometryId),
      [cutoutId],
      "and the opening still names the shape it was cut out of",
    );
    assert.equal((await geometryRow(cutoutId)).deleted_at, null, "the cutout itself is untouched");
  });
});

describe("stated quantities record typed inputs, not prose", () => {
  // Contract 17: measurement_settings carries quantityMode and statedQuantity.
  // A figure typed instead of drawn has no shape, so without a typed record the
  // only trace of "12 m of wall at 2.7 m high" is an English sentence — exactly
  // the thing nothing is allowed to parse.
  test("a stated measurement stores its tool, figure, unit and factor as data", async () => {
    const { preconService } = await import("./service.ts");
    const { preconRepository } = await import("./repository.ts");
    const service = preconService(preconRepository(db), noop);

    const row = await service.createStatedMeasurement(
      fixture.sessionId,
      { tool: "wall_area", qty: 12, unit: "m2", factor: { heightM: 2.7 }, description: "Stated blockwork", elementGroup: "Walls" },
      fixture.actor,
    );

    assert.equal(row.qty, 32.4, "12 m of run at 2.7 m high is 32.4 m2");
    const stored = await db("precon_boq_rows").where({ id: row.id }).first();
    const settings = stored?.["measurement_settings"] as {
      quantityMode?: string;
      statedQuantity?: { tool?: string; qty?: number; unit?: string; factor?: { heightM?: number }; actor?: string; at?: string };
    } | null;

    assert.ok(settings, "a stated line records its inputs");
    assert.equal(settings.quantityMode, "stated");
    assert.equal(settings.statedQuantity?.tool, "wall_area", "the tool is data, not a word in a sentence");
    assert.equal(settings.statedQuantity?.qty, 12, "and so is the figure the QS stated");
    assert.equal(settings.statedQuantity?.factor?.heightM, 2.7, "and the height that lifted it");
    assert.equal(settings.statedQuantity?.actor, fixture.actor, "attributed");
    assert.ok(settings.statedQuantity?.at, "and timestamped");

    assert.equal(
      Number((await db("precon_geometries").where({ row_id: row.id }).count("* as n").first())?.["n"]),
      0,
      "a stated figure has no shape, and none is invented for it",
    );
  });
});
