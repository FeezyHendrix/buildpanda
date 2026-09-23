// Task 10's restructures: split, interior trim, polygon split, transform,
// cross-sheet duplicate and reassignment — through the envelope, against real
// Postgres, each one undone and redone.
//
// The shipped versions refused the interesting half of each: an interior cut was
// refused rather than producing two pieces, a polygon could not be split at all,
// a transform did not exist, and a cross-sheet paste accepted `targetSheetId`
// and silently ignored it — pasting a 1:100 shape onto a 1:50 drawing at the
// same point coordinates, which halves the real thing it measures.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { preconAuditRepository } from "./audit-repository.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;
/** A second drawing at 1:100 — half the fixture sheet's scale. */
let coarseSheetId: string;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "batch-restructure");
  coarseSheetId = `pcsh_coarse_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: coarseSheetId,
    session_id: fixture.sessionId,
    file_name: "coarse.pdf",
    storage_path: `qa/${coarseSheetId}.pdf`,
    page_number: 4,
    code: "COARSE-01",
    kind: "floor-plan",
    status: "measured",
    // 100 mm per point: 10 pt = 1 m, against the fixture sheet's 20 pt = 1 m
    scale_mm_per_pt: 100,
    scale_confidence: 1,
    dim_unit: "mm",
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

function apply(command: EditorCommand, grants: EditorGrants = GRANTS): Promise<OperationReceipt> {
  return editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: newOperationId(), command },
    fixture.actor,
    grants,
  );
}

async function undo(eventId: string): Promise<string> {
  const undoer = editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
  const outcome = await undoer.reverseOperation(fixture.sessionId, eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
  return outcome.reversed ? outcome.receipt.eventId : "";
}

async function gross(rowId: string): Promise<number | null> {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return row?.["qty_gross"] === null || row?.["qty_gross"] === undefined ? null : Number(row["qty_gross"]);
}

async function shapes(rowId: string): Promise<{ id: string; vertices: number[][]; quantity: number | null }[]> {
  const rows = await db("precon_geometries")
    .where({ row_id: rowId })
    .whereNull("deleted_at")
    .whereNot({ kind: "deduction" })
    .orderBy("created_at", "asc")
    .select("id", "vertices", "quantity");
  return rows.map((r) => ({ id: r["id"], vertices: r["vertices"], quantity: r["quantity"] === null ? null : Number(r["quantity"]) }));
}

const runLength = (vertices: number[][]): number => {
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    total += Math.hypot(vertices[i]![0]! - vertices[i - 1]![0]!, vertices[i]![1]! - vertices[i - 1]![1]!);
  }
  return Math.round((total / 20) * 100) / 100;
};

async function polyline(vertices: number[][], label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "polyline",
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Walls",
  });
}

describe("splitting a run", () => {
  test("7 m split at the corner becomes 3 m + 4 m on the same line", async () => {
    const created = await polyline([[m(0), m(0)], [m(3), m(0)], [m(3), m(4)]], "Split run");
    const rowId = created.rows[0]!.id;
    assert.equal(await gross(rowId), 7);

    const split = await apply({ kind: "split-polyline", rowId, geometryId: created.geometries[0]!.id, vertexIndex: 1 });
    const pieces = await shapes(rowId);
    assert.equal(pieces.length, 2, "one run became two");
    assert.deepEqual(pieces.map((p) => runLength(p.vertices)).sort(), [3, 4], "3 m and 4 m");
    assert.equal(await gross(rowId), 7, "and together they are still the 7 m that was signed off");
    assert.equal(split.geometries.length >= 2, true, "the receipt names both pieces");

    const undone = await undo(split.eventId);
    assert.equal((await shapes(rowId)).length, 1, "undo puts the single run back");
    assert.equal(await gross(rowId), 7);
    await undo(undone);
    assert.equal((await shapes(rowId)).length, 2, "redo splits it again");
  });
});

describe("cutting a segment out of the middle", () => {
  test("removing the middle of a 2+3+3 run leaves two disconnected pieces, not a bridge", async () => {
    const created = await polyline([[m(0), m(10)], [m(2), m(10)], [m(5), m(10)], [m(8), m(10)]], "Trim run");
    const rowId = created.rows[0]!.id;
    assert.equal(await gross(rowId), 8, "2 + 3 + 3");

    const trimmed = await apply({
      kind: "remove-segment",
      rowId,
      geometryId: created.geometries[0]!.id,
      segmentIndex: 1,
    });
    const pieces = await shapes(rowId);
    assert.equal(pieces.length, 2, "the interior cut leaves two separate runs on the same line");
    assert.deepEqual(pieces.map((p) => runLength(p.vertices)).sort(), [2, 3], "2 m and 3 m survive");
    assert.equal(await gross(rowId), 5, "and the middle 3 m is gone: 8 − 3");
    for (const piece of pieces) {
      assert.equal(piece.vertices.length, 2, "neither piece gained a bridging vertex");
    }
    assert.ok(trimmed.geometries.length >= 2, "the receipt names both remaining runs");

    await undo(trimmed.eventId);
    assert.equal((await shapes(rowId)).length, 1, "undo restores the single run");
    assert.equal(await gross(rowId), 8);
  });

  test("cutting the end segment still leaves one run", async () => {
    const created = await polyline([[m(0), m(20)], [m(2), m(20)], [m(5), m(20)]], "End trim");
    const rowId = created.rows[0]!.id;
    await apply({ kind: "remove-segment", rowId, geometryId: created.geometries[0]!.id, segmentIndex: 1 });
    assert.equal((await shapes(rowId)).length, 1, "an end cut disconnects nothing");
    assert.equal(await gross(rowId), 2);
  });
});

describe("splitting a polygon with a drawn cut line", () => {
  test("a 4×4 slab cut down the middle becomes two 8 m² pieces on the same line", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [[m(0), m(30)], [m(4), m(30)], [m(4), m(34)], [m(0), m(34)]],
      description: `Polygon split ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    assert.equal(await gross(rowId), 16);

    const cut = await apply({
      kind: "split-polygon",
      rowId,
      geometryId: created.geometries[0]!.id,
      cut: [[m(2), m(28)], [m(2), m(36)]],
    });
    const pieces = await shapes(rowId);
    assert.equal(pieces.length, 2, "one slab became two");
    assert.deepEqual(pieces.map((p) => p.quantity).sort(), [8, 8], "8 m² each");
    assert.equal(await gross(rowId), 16, "and together they are still the 16 m² that was measured");

    await undo(cut.eventId);
    assert.equal((await shapes(rowId)).length, 1, "undo restores the whole slab");
    assert.equal(await gross(rowId), 16);
  });
});

describe("moving and rotating a shape", () => {
  test("a transform changes where it is, never what it measures", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [[m(0), m(40)], [m(4), m(40)], [m(4), m(44)], [m(0), m(44)]],
      description: `Transform slab ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;
    const before = (await shapes(rowId))[0]!.vertices;

    const moved = await apply({
      kind: "transform-geometry",
      rowId,
      geometryId,
      translate: [m(10), m(0)],
      rotateDeg: 90,
      about: [m(2), m(42)],
    });
    assert.equal(await gross(rowId), 16, "a rotation and a slide measure the same 16 m²");
    const after = (await shapes(rowId))[0]!.vertices;
    assert.notDeepEqual(after, before, "but the shape really did move");
    assert.equal((await shapes(rowId)).length, 1, "and it is still one shape with its own id");
    assert.equal((await shapes(rowId))[0]!.id, geometryId);

    await undo(moved.eventId);
    assert.deepEqual((await shapes(rowId))[0]!.vertices, before, "undo puts it back exactly");
    assert.equal(await gross(rowId), 16);
  });
});

describe("copying a shape onto another drawing", () => {
  test("a 1:100 paste onto a 1:50 sheet keeps the real size, not the point coordinates", async () => {
    // 4 m square drawn on the COARSE sheet: 100 mm/pt means 10 pt to the metre.
    const created = await apply({
      kind: "create-geometry",
      sheetId: coarseSheetId,
      tool: "area",
      vertices: [[0, 0], [40, 0], [40, 40], [0, 40]],
      description: `Cross-sheet source ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    assert.equal(await gross(rowId), 16, "4 m × 4 m at 1:100");

    const pasted = await apply({
      kind: "duplicate-geometry",
      rowId,
      geometryId: created.geometries[0]!.id,
      offset: [0, 0],
      targetSheetId: fixture.sheetId,
      crossSheet: "preserve-real-size",
    });
    const copyRow = pasted.rows.find((r) => r.id !== rowId)?.id ?? "";
    assert.ok(copyRow, "the paste is its own line");
    assert.equal(await gross(copyRow), 16, "the copy measures the same real 16 m² on the finer drawing");
    const copyShape = (await shapes(copyRow))[0]!;
    assert.equal(
      Math.round(Math.max(...copyShape.vertices.map((v) => v[0]!)) - Math.min(...copyShape.vertices.map((v) => v[0]!))),
      80,
      "which means 80 points wide at 50 mm/pt, not the 40 it had at 100",
    );
    assert.equal(
      (await db("precon_geometries").where({ id: copyShape.id }).first())?.["sheet_id"],
      fixture.sheetId,
      "and it lives on the target drawing",
    );
    assert.equal(
      (await db("precon_boq_rows").where({ id: copyRow }).first())?.["status"],
      "needs_review",
      "a pasted quantity is nobody's sign-off",
    );

    await undo(pasted.eventId);
    assert.equal(
      await db("precon_boq_rows").where({ id: copyRow }).whereNull("deleted_at").first(),
      undefined,
      "undo withdraws the paste",
    );
  });

  test("retrace keeps the point coordinates and says the size changed", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: coarseSheetId,
      tool: "area",
      vertices: [[0, 100], [40, 100], [40, 140], [0, 140]],
      description: `Retrace source ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const pasted = await apply({
      kind: "duplicate-geometry",
      rowId: created.rows[0]!.id,
      geometryId: created.geometries[0]!.id,
      offset: [0, 0],
      targetSheetId: fixture.sheetId,
      crossSheet: "retrace",
    });
    const copyRow = pasted.rows.find((r) => r.id !== created.rows[0]!.id)?.id ?? "";
    // 40 pt at 50 mm/pt is 2 m, so the same outline is a 2 m square = 4 m².
    assert.equal(await gross(copyRow), 4, "a retrace keeps the drawing and re-measures it at the new scale");
  });

  test("a cross-sheet paste with no explicit choice is refused, never silently guessed", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: coarseSheetId,
      tool: "area",
      vertices: [[0, 200], [40, 200], [40, 240], [0, 240]],
      description: `No choice ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    await assert.rejects(
      apply({
        kind: "duplicate-geometry",
        rowId: created.rows[0]!.id,
        geometryId: created.geometries[0]!.id,
        offset: [0, 0],
        targetSheetId: fixture.sheetId,
      }),
      /preserve-real-size|retrace/i,
      "the two answers bill differently, so the server must be told which",
    );
  });

  test("duplication needs the measure grant", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [[m(0), m(50)], [m(4), m(50)], [m(4), m(54)], [m(0), m(54)]],
      description: `Grant check ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    await assert.rejects(
      apply(
        { kind: "duplicate-geometry", rowId: created.rows[0]!.id, geometryId: created.geometries[0]!.id, offset: [m(6), 0] },
        { edit: true, measure: false, verify: false },
      ),
      /measure/i,
    );
  });
});

describe("reassigning the last shape off a line", () => {
  test("the emptied line is withdrawn, and undo brings it back with its shape", async () => {
    const source = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [[m(0), m(60)], [m(4), m(60)], [m(4), m(64)], [m(0), m(64)]],
      description: `Empty source ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const target = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [[m(10), m(60)], [m(14), m(60)], [m(14), m(64)], [m(10), m(64)]],
      description: `Empty target ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const sourceRow = source.rows[0]!.id;
    const targetRow = target.rows[0]!.id;

    const moved = await apply({
      kind: "reassign-geometry",
      geometryId: source.geometries[0]!.id,
      targetRowId: targetRow,
    });
    assert.equal(await gross(targetRow), 32, "the target carries both slabs");
    assert.equal(
      await db("precon_boq_rows").where({ id: sourceRow }).whereNull("deleted_at").first(),
      undefined,
      "the line with nothing left on it is withdrawn, not left billing zero",
    );
    assert.ok(moved.deletedRowIds.includes(sourceRow), "and the receipt says so");

    await undo(moved.eventId);
    assert.ok(await db("precon_boq_rows").where({ id: sourceRow }).whereNull("deleted_at").first(), "undo brings it back");
    assert.equal(await gross(sourceRow), 16, "with its slab");
    assert.equal(await gross(targetRow), 16, "and the target is re-added without it");
  });
});
