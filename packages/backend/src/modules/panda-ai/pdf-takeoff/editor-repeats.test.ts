// "12 typical" is not a multiplier — it is twelve real things.
//
// A row measured once and marked typical-12 stands for twelve bays, twelve
// columns, twelve flats. The number 12 was the whole record of that: no names,
// so nothing on the line could say WHICH twelve, and when the QS found that bay
// 7 has a different opening there was nowhere to put it. The only moves were to
// edit the shape (restating all twelve) or drop typical to 1 and redraw eleven
// times.
//
// This pins the two things that fixes: labels that name each instance (N counts
// the measured one — twelve labels is twelve bays, not thirteen), and taking one
// named instance out into its own line, with the parent falling to eleven, as a
// stated, reversible act.
//
// It also pins the deduction record the inspector reads back: an opening entered
// as 0.9 × 2.1 has to come back as those dimensions in that mode, or the panel
// has to re-derive them from an area and gets 1.89 m² with no way to edit it.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";
import { toRowsWithMeasurement } from "./dto.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "repeats");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );

async function undo(eventId: string): Promise<void> {
  const undoer = editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
  const outcome = await undoer.reverseOperation(
    fixture.sessionId,
    eventId,
    { operationId: `op_${randomUUID()}` },
    fixture.actor,
    GRANTS,
  );
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
}

interface StoredRow {
  qty_gross: string | number | null;
  qty: string | number | null;
  typical: number | null;
  description: string;
  unit: string | null;
  deductions: unknown;
  measurement_settings: { repeatLabels?: string[]; quantityMode?: string } | null;
  deleted_at: Date | null;
  measurement_basis: string | null;
}

const read = async (rowId: string): Promise<StoredRow> =>
  (await db("precon_boq_rows").where({ id: rowId }).first()) as StoredRow;

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

/** One 4 m × 3 m bay, measured once. 12 m² gross. */
async function bay(label: string, at: number): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: rect(at, 0, 4, 3),
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
  });
}

describe("naming the instances a typical row stands for", () => {
  test("N counts the measured instance, so twelve labels is a typical of twelve", async () => {
    const created = await bay("Labelled bay", 0);
    const rowId = created.rows[0]!.id;
    const labels = Array.from({ length: 12 }, (_, i) => `Bay ${i + 1}`);

    const receipt = await apply({ kind: "set-measurement-settings", rowId, repeatLabels: labels });
    const row = await read(rowId);
    assert.deepEqual(row.measurement_settings?.repeatLabels, labels, "the names are persisted, not held on a component");
    assert.equal(row.typical, 12, "twelve named bays is typical 12 — the measured one is Bay 1, not a thirteenth");
    assert.equal(Number(row.qty_gross), 12, "the shape is unchanged: gross is still one bay");
    assert.equal(Number(row.qty), 144, "and the line bills twelve of it");
    assert.match(row.measurement_basis ?? "", /12/, "the basis says so in words");

    await undo(receipt.eventId);
    const back = await read(rowId);
    assert.equal(back.typical, 1, "undo returns the line to a single instance");
    assert.equal(Number(back.qty), 12);
    assert.equal(back.measurement_settings?.repeatLabels ?? null, null, "and drops the names it added");
  });

  test("labels must be distinct and non-empty — an unnamed instance cannot be split out later", async () => {
    const rowId = (await bay("Bad labels", 10)).rows[0]!.id;
    for (const bad of [["A", "A"], ["A", "  "], []]) {
      await assert.rejects(
        apply({ kind: "set-measurement-settings", rowId, repeatLabels: bad }),
        BadRequestError,
        `${JSON.stringify(bad)} must be refused`,
      );
    }
    assert.equal((await read(rowId)).typical, 1, "and none of them changed the line");
  });

  test("setting typical directly keeps the names in step rather than leaving stale ones", async () => {
    const rowId = (await bay("Trimmed", 20)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["A", "B", "C", "D"] });
    await apply({ kind: "set-row-typical", rowId, typical: 2 });
    const row = await read(rowId);
    assert.equal(row.typical, 2);
    assert.deepEqual(
      row.measurement_settings?.repeatLabels,
      ["A", "B"],
      "dropping to two keeps the first two names; it must not leave four names against a count of two",
    );
    assert.equal(Number(row.qty), 24);
  });
});

describe("taking one instance out of the set", () => {
  test("the exception becomes its own line and the parent falls by one", async () => {
    const created = await bay("Splittable", 30);
    const rowId = created.rows[0]!.id;
    const labels = Array.from({ length: 12 }, (_, i) => `Bay ${i + 1}`);
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: labels });

    const receipt = await apply({ kind: "split-repeat-exception", rowId, label: "Bay 7", confirmed: true });
    const parent = await read(rowId);
    assert.equal(parent.typical, 11, "eleven bays still follow the typical");
    assert.deepEqual(
      parent.measurement_settings?.repeatLabels,
      labels.filter((l) => l !== "Bay 7"),
      "and Bay 7 is no longer one of them",
    );
    assert.equal(Number(parent.qty), 132, "11 × 12 m²");

    const exceptionId = receipt.rows.map((r) => r.id).find((id) => id !== rowId);
    assert.ok(exceptionId, "the receipt names the line it created");
    const exception = await read(exceptionId);
    assert.equal(exception.typical, 1, "the exception stands for exactly itself");
    assert.equal(Number(exception.qty_gross), 12, "carrying a copy of the measurement it was one of");
    assert.equal(Number(exception.qty), 12);
    assert.match(exception.description, /Bay 7/, "and it says which instance it is");
    assert.equal(exception.unit, parent.unit);

    const shapes = await db("precon_geometries").where({ row_id: exceptionId }).whereNull("deleted_at");
    assert.equal(shapes.length, 1, "with its own shape — editing it must not restate the other eleven");
    assert.notEqual(shapes[0]!["id"], created.geometries[0]!.id, "a new shape, not the parent's");
    assert.equal(Number(shapes[0]!["quantity"]), 12);

    // Editing the exception leaves the typical row exactly where it was — which
    // is the whole point of splitting it out.
    await apply({ kind: "update-geometry", geometryId: shapes[0]!["id"] as string, vertices: rect(30, 0, 4, 1) });
    assert.equal(Number((await read(exceptionId)).qty_gross), 4, "the exception now measures 4 m²");
    assert.equal(Number((await read(rowId)).qty), 132, "and the eleven typical bays are untouched");

    // And once it HAS been worked on, undoing the split would throw that work
    // away, so it is refused rather than done quietly.
    await assert.rejects(
      (async () => undo(receipt.eventId))(),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.match(error.message, /edited since|discard/i);
        return true;
      },
    );
    assert.equal(Number((await read(exceptionId)).qty_gross), 4, "the exception keeps the work done on it");
  });

  test("undoing a split nobody has built on puts the instance back in the set", async () => {
    const rowId = (await bay("Undoable", 100)).rows[0]!.id;
    const labels = ["Bay A", "Bay B", "Bay C"];
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: labels });

    const receipt = await apply({ kind: "split-repeat-exception", rowId, label: "Bay B", confirmed: true });
    const exceptionId = receipt.rows.map((r) => r.id).find((id) => id !== rowId)!;
    assert.equal((await read(rowId)).typical, 2);

    await undo(receipt.eventId);
    const restored = await read(rowId);
    assert.equal(restored.typical, 3, "undo puts Bay B back in the set");
    assert.deepEqual(restored.measurement_settings?.repeatLabels, labels);
    assert.equal(Number(restored.qty), 36);
    assert.equal((await read(exceptionId)).deleted_at !== null, true, "and withdraws the line it split out");
  });

  test("it refuses without an explicit confirmation, and refuses a name that is not in the set", async () => {
    const rowId = (await bay("Guarded", 40)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["P1", "P2", "P3"] });

    await assert.rejects(
      apply({ kind: "split-repeat-exception", rowId, label: "P2", confirmed: false }),
      BadRequestError,
      "splitting a set restates a priced line, so it is never implicit",
    );
    await assert.rejects(
      apply({ kind: "split-repeat-exception", rowId, label: "P9", confirmed: true }),
      BadRequestError,
      "a name nobody recorded cannot be split out",
    );
    assert.equal((await read(rowId)).typical, 3, "neither attempt moved the line");
  });

  test("a line with no named instances cannot be split at all", async () => {
    const rowId = (await bay("Unnamed", 50)).rows[0]!.id;
    await apply({ kind: "set-row-typical", rowId, typical: 6 });
    await assert.rejects(
      apply({ kind: "split-repeat-exception", rowId, label: "Bay 3", confirmed: true }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /name|label/i, "it has to say the instances must be named first");
        return true;
      },
    );
    assert.equal((await read(rowId)).typical, 6);
  });

  test("the last instance cannot be split out — that would leave a set of none", async () => {
    const rowId = (await bay("Single", 60)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["Only one"] });
    await assert.rejects(
      apply({ kind: "split-repeat-exception", rowId, label: "Only one", confirmed: true }),
      BadRequestError,
    );
    assert.equal((await read(rowId)).typical, 1);
  });

  test("a stale version pins the split like any other write", async () => {
    const rowId = (await bay("Staleable", 70)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["X1", "X2", "X3"] });
    const stale = (await read(rowId)) && 1;
    await assert.rejects(
      editorOperationService(db, noop).apply(
        fixture.sessionId,
        {
          operationId: `op_${randomUUID()}`,
          expectedRows: [{ id: rowId, version: stale }],
          command: { kind: "split-repeat-exception", rowId, label: "X2", confirmed: true },
        },
        fixture.actor,
        GRANTS,
      ),
      ConflictError,
    );
    assert.equal((await read(rowId)).typical, 3);
  });
});

describe("what an opening reads back as", () => {
  test("a stated opening comes back as the dimensions and mode it was entered in", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [
        [m(0), m(40)],
        [m(10), m(40)],
      ],
      description: `Wall with openings ${randomUUID().slice(0, 6)}`,
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

    const rows = await db("precon_boq_rows").where({ id: rowId });
    const geometries = await db("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at");
    const dto = toRowsWithMeasurement(rows as never, geometries as never)[0]!;
    const deduction = dto.deductions[0]!;

    assert.equal(deduction.label, "Door D1");
    assert.equal(deduction.qty, 1.89, "0.9 × 2.1");
    assert.equal(deduction.mode, "wall-opening", "the panel must not have to infer this from the unit");
    assert.deepEqual(
      deduction.dimensions,
      { widthM: 0.9, heightM: 2.1 },
      "and it reads back the numbers that were typed, so they can be corrected as numbers",
    );
  });

  test("a drawn opening reports its mode and no dimensions, rather than inventing some", async () => {
    const created = await bay("Drawn opening host", 80);
    const rowId = created.rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Void V1",
      mode: "area",
      vertices: rect(81, 0, 1, 1),
      sheetId: fixture.sheetId,
    });

    const rows = await db("precon_boq_rows").where({ id: rowId });
    const geometries = await db("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at");
    const deduction = toRowsWithMeasurement(rows as never, geometries as never)[0]!.deductions[0]!;

    assert.equal(deduction.mode, "area");
    assert.equal(deduction.dimensions ?? null, null, "it was drawn; there are no typed dimensions to show");
    assert.equal(deduction.qty, 1);
  });

  test("a legacy deduction that recorded neither still reads back, with both absent", async () => {
    const rowId = (await bay("Legacy deduction host", 90)).rows[0]!.id;
    await db("precon_boq_rows")
      .where({ id: rowId })
      .update({
        deductions: JSON.stringify([{ label: "Old void", qty: 2, geometryId: null, unit: "m2", unitConfirmed: false }]),
      });

    const rows = await db("precon_boq_rows").where({ id: rowId });
    const geometries = await db("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at");
    const deduction = toRowsWithMeasurement(rows as never, geometries as never)[0]!.deductions[0]!;

    assert.equal(deduction.label, "Old void");
    assert.equal(deduction.mode ?? null, null, "absent, never guessed from the unit");
    assert.equal(deduction.dimensions ?? null, null);
    assert.equal(deduction.unitConfirmed, false, "and it still says nobody confirmed the unit");
  });
});
