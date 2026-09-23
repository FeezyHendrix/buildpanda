// Copying and merging lines that live on more than one drawing.
//
// A line measured across two sheets is ordinary: a wall that turns a corner
// onto the next sheet, a slab detailed twice. Both of the operations that move
// such a line wholesale had holes:
//
//   * `duplicate-row` onto an explicitly chosen target has to take EVERY shape
//     there, each converted from the scale IT was measured at — not from the
//     first one's. With no target each shape stays on its own drawing. A shape
//     silently left behind is a copy that bills less than the thing it copied.
//   * a merge has to add up every shape on every line it absorbs, carry their
//     openings across, and refuse when the two lines are not the same kind of
//     measurement. Joining two runs that do not touch must not invent the gap
//     between them as billable length.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
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
/** A second drawing at HALF the fixture's mm-per-point: 1 m is twice the points. */
let fineSheet: string;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "multisheet");
  fineSheet = `pcsh_fine_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: fineSheet,
    session_id: fixture.sessionId,
    file_name: "fine.pdf",
    storage_path: `qa/${fineSheet}.pdf`,
    page_number: 80,
    code: "FINE-01",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 25,
    dim_unit: "mm",
    version: 1,
  });
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

const rowOf = async (id: string) => db("precon_boq_rows").where({ id }).first();
const grossOf = async (id: string): Promise<number> => Number((await rowOf(id))?.["qty_gross"]);
const shapesOf = async (rowId: string) =>
  db("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at").orderBy("created_at");

const rect = (x: number, y: number, w: number, h: number, mmPerPt = 50): number[][] => {
  const pt = (v: number) => v * (1000 / mmPerPt);
  return [
    [pt(x), pt(y)],
    [pt(x + w), pt(y)],
    [pt(x + w), pt(y + h)],
    [pt(x), pt(y + h)],
  ];
};

const create = (sheetId: string, tool: string, extra: Record<string, unknown>) =>
  apply({
    kind: "create-geometry",
    sheetId,
    tool,
    description: `${tool} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Multi",
    ...extra,
  } as EditorCommand);

/** One line measured by a 6x4 m slab on the fixture sheet and a 2x2 m slab on the fine one. */
async function acrossTwoSheets(label: string): Promise<{ rowId: string; ids: string[] }> {
  const made = await create(fixture.sheetId, "area", { vertices: rect(0, 0, 6, 4) });
  const rowId = made.rows[0]!.id;
  const second = `pgeo_ms_${randomUUID().slice(0, 8)}`;
  await db("precon_geometries").insert({
    id: second,
    row_id: rowId,
    sheet_id: fineSheet,
    kind: "area",
    vertices: JSON.stringify(rect(0, 0, 2, 2, 25)),
    source: "manual",
    quantity: 4,
    unit: "m2",
    definition: JSON.stringify({
      schemaVersion: 1,
      role: "measurement",
      tool: "area",
      shape: {
        role: "path",
        start: rect(0, 0, 2, 2, 25)[0],
        segments: rect(0, 0, 2, 2, 25).slice(1).map((v) => ({ kind: "line", end: v })),
        closed: true,
      },
      scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: 25 },
    }),
  });
  await apply({ kind: "update-geometry", geometryId: made.geometries[0]!.id, vertices: rect(0, 0, 6, 4) });
  assert.equal(await grossOf(rowId), 28, `${label}: 24 + 4 across two drawings`);
  return { rowId, ids: [made.geometries[0]!.id, second] };
}

describe("copying a line that lives on two drawings", () => {
  test("an explicit target takes EVERY shape, each converted from its own scale", async () => {
    const { rowId } = await acrossTwoSheets("source");
    const receipt = await apply({
      kind: "duplicate-row",
      rowId,
      targetSheetId: fineSheet,
      crossSheet: "preserve-real-size",
    });
    const copyId = receipt.rows.map((r) => r.id).find((id) => id !== rowId);
    assert.ok(copyId, "the receipt names the line it created");

    const copies = await shapesOf(copyId);
    assert.equal(copies.length, 2, "BOTH shapes came across — nothing was silently left behind");
    assert.ok(
      copies.every((c) => c["sheet_id"] === fineSheet),
      "and both landed on the drawing that was actually chosen",
    );
    assert.equal(
      await grossOf(copyId),
      28,
      "each shape kept its real size: the 24 m² slab is redrawn bigger on the finer sheet, not re-billed at 96",
    );

    await undo(receipt.eventId);
    assert.equal((await shapesOf(copyId)).length, 0, "and one undo withdraws the whole copy");
  });

  test("with no target, every shape stays on the drawing it was measured on", async () => {
    const { rowId } = await acrossTwoSheets("in place");
    const receipt = await apply({ kind: "duplicate-row", rowId, offset: [m(20), 0] });
    const copyId = receipt.rows.map((r) => r.id).find((id) => id !== rowId)!;
    const copies = await shapesOf(copyId);
    assert.equal(copies.length, 2);
    assert.deepEqual(
      copies.map((c) => c["sheet_id"]).sort(),
      [fixture.sheetId, fineSheet].sort(),
      "one per original drawing",
    );
    assert.equal(await grossOf(copyId), 28, "and the figure is unchanged");
  });

  test("a target that is not in this take-off is refused, not ignored", async () => {
    const { rowId } = await acrossTwoSheets("foreign");
    await assert.rejects(
      apply({ kind: "duplicate-row", rowId, targetSheetId: "pcsh_not_mine", crossSheet: "preserve-real-size" }),
      (error: unknown) => {
        assert.ok(error !== null);
        return true;
      },
    );
    assert.equal((await db("precon_boq_rows").where({ description: (await rowOf(rowId))?.["description"] })).length, 1);
  });
});

describe("openings that touch without overlapping", () => {
  test("a cut taken exactly along a void's edge is kept, not read as an overlap", async () => {
    const slab = await create(fixture.sheetId, "area", { vertices: rect(0, 500, 6, 4) });
    const rowId = slab.rows[0]!.id;
    await apply({ kind: "add-deduction", rowId, label: "Void A", vertices: rect(1, 501, 2, 2), sheetId: fixture.sheetId });
    // Shares the whole right edge of Void A and no area with it. A bounding-box
    // test calls that an overlap; a real polygon intersection does not.
    await apply({ kind: "add-deduction", rowId, label: "Void B", vertices: rect(3, 501, 2, 2), sheetId: fixture.sheetId });
    assert.equal(Number((await rowOf(rowId))?.["qty"]), 16, "24 less two 4 m² voids that merely touch");

    await assert.rejects(
      apply({ kind: "add-deduction", rowId, label: "Overlapping", vertices: rect(2, 501, 2, 2), sheetId: fixture.sheetId }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /overlap/i, "a real shared area is still refused");
        return true;
      },
    );
    assert.equal(Number((await rowOf(rowId))?.["qty"]), 16, "and nothing was deducted twice");
  });
});
