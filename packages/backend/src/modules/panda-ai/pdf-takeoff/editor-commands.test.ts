// Every measurement-edit command through the ONE envelope, against real Postgres.
//
// Deductions, calibration and the batch restructures were already implemented and
// already reachable — but only through their own REST routes, which mint no
// receipt, carry no fingerprint and cannot be undone. A QS who takes an opening
// out of a wall and wants it back has no undo; the editor's history simply does
// not contain the act.
//
// So each one is exercised here the way the editor will call it: apply through
// `POST editor-operations`, then undo, then redo, then prove an atomic refusal
// leaves nothing behind. These are claims about receipts and transactions, so
// they only mean anything against a real database.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-commands");
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

function reverser(): ReturnType<typeof editorReverseServiceWith> {
  return editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
}

async function undo(eventId: string): Promise<string> {
  const outcome = await reverser().reverseOperation(fixture.sessionId, eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
  assert.equal(outcome.reversed, true, `reversing ${eventId} was refused: ${outcome.reversed === false ? outcome.reason : ""}`);
  return outcome.reversed ? outcome.receipt.eventId : "";
}

async function figures(rowId: string): Promise<{ gross: number | null; qty: number | null; basis: string | null; deductions: { label: string; qty: number; geometryId?: string; unit?: string | null }[] }> {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  assert.ok(row, `row ${rowId} missing`);
  return {
    gross: row["qty_gross"] === null ? null : Number(row["qty_gross"]),
    qty: row["qty"] === null ? null : Number(row["qty"]),
    basis: row["measurement_basis"] as string | null,
    deductions: (row["deductions"] ?? []) as { label: string; qty: number; geometryId?: string; unit?: string | null }[],
  };
}

/** The plan's 6 m × 4 m room = 24 m2, offset so fixtures do not overlap. */
const room = (x: number): number[][] => [
  [m(x), m(0)],
  [m(x + 6), m(0)],
  [m(x + 6), m(4)],
  [m(x), m(4)],
];

/** A 2 m × 1 m cutout wholly inside `room(x)` = 2 m2. */
const cutout = (x: number): number[][] => [
  [m(x + 1), m(1)],
  [m(x + 3), m(1)],
  [m(x + 3), m(2)],
  [m(x + 1), m(2)],
];

async function slab(x: number, label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: room(x),
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
    rate: 100,
  });
}

describe("deductions go through the envelope, and come back", () => {
  test("add → undo → redo restores the opening, its shape and the basis", async () => {
    const created = await slab(0, "Deduction slab");
    const rowId = created.rows[0]!.id;
    assert.equal((await figures(rowId)).qty, 24);

    const added = await apply({ kind: "add-deduction", rowId, label: "Door opening", vertices: cutout(0) });
    const afterAdd = await figures(rowId);
    assert.equal(afterAdd.qty, 22, "24 m2 less a 2 m2 opening");
    assert.equal(afterAdd.gross, 24, "the gross the opening is taken out of is unchanged");
    assert.equal(afterAdd.deductions.length, 1);
    assert.equal(afterAdd.deductions[0]?.qty, 2);
    assert.match(String(afterAdd.basis), /− 2 m2 deducted \(Door opening\)/u, "the basis names the opening and what it took off");
    const cutoutId = afterAdd.deductions[0]?.geometryId ?? "";
    assert.ok(cutoutId, "the opening names the shape it was cut out of");
    assert.equal(
      (await db("precon_geometries").where({ id: cutoutId }).first())?.["parent_geometry_id"],
      created.geometries[0]!.id,
      "and that shape is linked to the measurement it is an opening in",
    );

    const undoEvent = await undo(added.eventId);
    const afterUndo = await figures(rowId);
    assert.equal(afterUndo.qty, 24, "undoing the opening puts the full slab back");
    assert.equal(afterUndo.deductions.length, 0, "and takes the opening off the line");
    assert.ok((await db("precon_geometries").where({ id: cutoutId }).first())?.["deleted_at"], "its shape is tombstoned");

    await undo(undoEvent);
    const afterRedo = await figures(rowId);
    assert.equal(afterRedo.qty, 22, "redo takes the opening back out");
    assert.equal(afterRedo.deductions[0]?.geometryId, cutoutId, "under the SAME shape id");
    assert.equal((await db("precon_geometries").where({ id: cutoutId }).first())?.["deleted_at"], null);
  });

  test("edit and remove restate the figure and the basis, and both reverse", async () => {
    const created = await slab(20, "Edited deduction slab");
    const rowId = created.rows[0]!.id;
    const added = await apply({ kind: "add-deduction", rowId, label: "Hatch", vertices: cutout(20) });
    const cutoutId = (await figures(rowId)).deductions[0]!.geometryId!;

    // widen the cutout to 4 m × 1 m = 4 m2
    const edited = await apply({
      kind: "edit-deduction",
      rowId,
      geometryId: cutoutId,
      vertices: [
        [m(21), m(1)],
        [m(25), m(1)],
        [m(25), m(2)],
        [m(21), m(2)],
      ],
    });
    assert.equal((await figures(rowId)).qty, 20, "24 − 4");
    assert.equal((await figures(rowId)).deductions[0]?.qty, 4, "the stored opening is restated too");

    await undo(edited.eventId);
    assert.equal((await figures(rowId)).qty, 22, "undoing the widening restores the 2 m2 opening");
    assert.equal((await figures(rowId)).deductions[0]?.qty, 2);

    const removed = await apply({ kind: "remove-deduction", rowId, geometryId: cutoutId });
    assert.equal((await figures(rowId)).qty, 24, "removing the opening restores the slab");
    assert.equal((await figures(rowId)).deductions.length, 0);

    await undo(removed.eventId);
    assert.equal((await figures(rowId)).qty, 22, "undoing the removal brings the opening back");
    assert.equal((await figures(rowId)).deductions[0]?.geometryId, cutoutId, "with its original shape id");
    void added;
  });

  test("an opening outside its parent, or overlapping another, is refused with nothing written", async () => {
    const created = await slab(40, "Guarded slab");
    const rowId = created.rows[0]!.id;
    await apply({ kind: "add-deduction", rowId, label: "First", vertices: cutout(40) });
    const before = await figures(rowId);

    await assert.rejects(
      apply({
        kind: "add-deduction",
        rowId,
        label: "Outside",
        vertices: [
          [m(100), m(100)],
          [m(102), m(100)],
          [m(102), m(101)],
          [m(100), m(101)],
        ],
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /inside|within|contain/i, "the refusal says the cutout is not in the shape");
        return true;
      },
    );

    await assert.rejects(
      apply({ kind: "add-deduction", rowId, label: "Overlapping", vertices: cutout(40) }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /overlap/i, "an opening cannot be taken out twice");
        return true;
      },
    );

    const after = await figures(rowId);
    assert.equal(after.qty, before.qty, "neither refusal moved the figure");
    assert.equal(after.deductions.length, 1, "and neither added an opening");
  });

  test("a wall opening is stated as width × height, not read off a plan footprint", async () => {
    const wall = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [
        [m(60), m(0)],
        [m(67), m(0)],
      ],
      description: `Opening wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    const rowId = wall.rows[0]!.id;
    assert.equal((await figures(rowId)).qty, 18.9, "7 m × 2.7 m");

    const added = await apply({
      kind: "add-deduction",
      rowId,
      label: "Doorway",
      mode: "wall-opening",
      dimensions: { widthM: 0.9, heightM: 2.1 },
    });
    assert.equal((await figures(rowId)).qty, 17.01, "18.9 − (0.9 × 2.1 = 1.89)");
    const cutoutId = (await figures(rowId)).deductions[0]!.geometryId!;
    const definition = (await db("precon_geometries").where({ id: cutoutId }).first())?.["definition"] as {
      mode?: string;
      dimensions?: { widthM?: number; heightM?: number };
    };
    assert.equal(definition?.mode, "wall-opening", "the mode is recorded as data");
    assert.equal(definition?.dimensions?.widthM, 0.9, "and so are the stated dimensions");
    assert.equal(definition?.dimensions?.heightM, 2.1);

    await undo(added.eventId);
    assert.equal((await figures(rowId)).qty, 18.9, "and the whole thing reverses");
  });
});

