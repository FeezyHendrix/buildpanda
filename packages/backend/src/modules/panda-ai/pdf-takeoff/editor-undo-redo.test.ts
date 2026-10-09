// Real saved-geometry undo and redo, against real Postgres.
//
// The recovery audit found reversal stubbed: it could only put back a deleted
// row and refused every geometry edit. The chain below is the acceptance the plan
// actually asks for — A, B, undo B, undo A, redo A, redo B — with the records
// re-read from the database between every step, so nothing is being proved by an
// in-memory value that a refresh would contradict.
//
// It also pins the three refusals that make the chain safe: a colleague's edit in
// between blocks it even when their value matches, a retried undo restores once,
// and no reversal ever puts a verification stamp back.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { ConflictError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorHistoryService } from "./editor-operation-history.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-undo");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const newOperationId = (): string => `op_${randomUUID()}`;

function operations(): ReturnType<typeof editorOperationService> {
  return editorOperationService(db, noop);
}

function reverser(): ReturnType<typeof editorReverseServiceWith> {
  return editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
}

function apply(command: EditorCommand, actor = fixture.actor): Promise<OperationReceipt> {
  return operations().apply(fixture.sessionId, { operationId: newOperationId(), command }, actor, GRANTS);
}

/** A fresh read, standing in for the reload the QS would do. */
async function reload(rowId: string): Promise<{ qty: number | null; unit: string | null; status: string | null; version: number; verifiedBy: string | null }> {
  const row = await db("precon_boq_rows").where({ id: rowId }).whereNull("deleted_at").first();
  assert.ok(row, `bill line ${rowId} is not in the active bill`);
  return {
    qty: row["qty"] === null ? null : Number(row["qty"]),
    unit: row["unit"] as string | null,
    status: row["status"] as string | null,
    version: Number(row["version"]),
    verifiedBy: row["verified_by"] as string | null,
  };
}

async function liveGeometry(id: string): Promise<{ vertices: number[][]; definition: unknown; deleted: boolean }> {
  const row = await db("precon_geometries").where({ id }).first();
  assert.ok(row, `geometry ${id} has vanished entirely; a tombstone is not a deletion`);
  return {
    vertices: row["vertices"] as number[][],
    definition: row["definition"],
    deleted: row["deleted_at"] !== null,
  };
}

async function wall(): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "wall_area",
    vertices: [[m(0), m(0)], [m(3), m(0)], [m(3), m(4)]],
    description: `QA undo wall ${randomUUID().slice(0, 6)}`,
    elementGroup: "Walls",
    factor: { heightM: 2.7 },
  });
}

const movePoint = (geometryId: string, upTo: number): EditorCommand => ({
  kind: "update-geometry",
  geometryId,
  vertices: [[m(0), m(0)], [m(3), m(0)], [m(3), m(upTo)]],
});

describe("A, B, undo B, undo A, redo A, redo B", () => {
  test("every step lands in the database and survives a re-read", async () => {
    const created = await wall();
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;
    assert.equal((await reload(rowId)).qty, 18.9, "7 m × 2.7 m high");

    // A: pull the run back to 5 m  →  13.5 m2
    const a = await apply(movePoint(geometryId, 2));
    assert.equal((await reload(rowId)).qty, 13.5, "A committed");

    // B: pull it back again to 4 m →  10.8 m2
    const b = await apply(movePoint(geometryId, 1));
    assert.equal((await reload(rowId)).qty, 10.8, "B committed");

    const undo = reverser();

    const undoB = await undo.reverseOperation(fixture.sessionId, b.eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
    assert.equal(undoB.reversed, true, "undoing B is not refused");
    assert.equal(undoB.reversed && undoB.direction, "undo");
    assert.equal((await reload(rowId)).qty, 13.5, "undo B is back at A's figure");

    const undoA = await undo.reverseOperation(fixture.sessionId, a.eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
    assert.equal(undoA.reversed, true, "undoing A after undoing B is allowed: both are this actor's own chain");
    assert.equal((await reload(rowId)).qty, 18.9, "undo A is back at the original measurement");

    const geometryAfterUndo = await liveGeometry(geometryId);
    assert.equal(geometryAfterUndo.deleted, false, "the shape is still on the sheet");
    assert.deepEqual(
      geometryAfterUndo.vertices,
      [[m(0), m(0)], [m(3), m(0)], [m(3), m(4)]],
      "and its points are back where they were drawn",
    );
    assert.equal(
      (geometryAfterUndo.definition as { tool?: string; factor?: { heightM?: number } }).tool,
      "wall_area",
      "with the tool intact",
    );
    assert.equal(
      (geometryAfterUndo.definition as { factor?: { heightM?: number } }).factor?.heightM,
      2.7,
      "and the height intact: this is the factor the stub used to lose",
    );

    const undoAEvent = undoA.reversed ? undoA.receipt.eventId : "";
    const undoBEvent = undoB.reversed ? undoB.receipt.eventId : "";

    const redoA = await undo.reverseOperation(fixture.sessionId, undoAEvent, { operationId: newOperationId() }, fixture.actor, GRANTS);
    assert.equal(redoA.reversed, true, "redo is reversing the compensation");
    assert.equal(redoA.reversed && redoA.direction, "redo", "and is reported as a redo, not an undo");
    assert.equal((await reload(rowId)).qty, 13.5, "redo A is back at A's figure");

    const redoB = await undo.reverseOperation(fixture.sessionId, undoBEvent, { operationId: newOperationId() }, fixture.actor, GRANTS);
    assert.equal(redoB.reversed, true, "redo B follows redo A");
    assert.equal((await reload(rowId)).qty, 10.8, "and the bill is back where B left it");

    assert.deepEqual(
      (await liveGeometry(geometryId)).vertices,
      [[m(0), m(0)], [m(3), m(0)], [m(3), m(1)]],
      "the shape matches the figure",
    );

    const final = await reload(rowId);
    assert.equal(final.unit, "m2", "the unit never drifted through six operations");
    assert.ok(final.version >= 7, "every step moved the version forward, never back");

    // Nothing was erased: six acts plus the creation are all still on the record.
    const trail = await db("precon_audit_events")
      .where({ session_id: fixture.sessionId, row_id: rowId })
      .whereNotNull("operation_id");
    assert.ok(trail.length >= 7, `the audit trail keeps all seven acts, found ${trail.length}`);
  });
});

describe("a reversal never re-signs a figure", () => {
  test("undo restores the quantity but leaves the line needing review", async () => {
    const created = await wall();
    const rowId = created.rows[0]!.id;
    assert.equal((await reload(rowId)).status, "verified", "a hand-drawn line starts verified");
    assert.equal((await reload(rowId)).verifiedBy, fixture.actor);

    const edit = await apply(movePoint(created.geometries[0]!.id, 2));
    assert.equal((await reload(rowId)).status, "needs_review", "the edit un-signed it");

    await reverser().reverseOperation(fixture.sessionId, edit.eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);

    const restored = await reload(rowId);
    assert.equal(restored.qty, 18.9, "the measurement is back");
    assert.equal(restored.status, "needs_review", "but the line is NOT signed off again");
    assert.equal(restored.verifiedBy, null, "and nobody's name was put back on it");
  });
});

describe("a colleague's edit blocks the undo", () => {
  test("an intervening edit conflicts even when it sets the identical value", async () => {
    const created = await wall();
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;

    const mine = await apply(movePoint(geometryId, 2));
    assert.equal((await reload(rowId)).qty, 13.5);

    // The colleague re-saves the SAME shape, so every value matches. The records
    // are identical; the history is not, and that is what makes undo unsafe.
    await apply(movePoint(geometryId, 2), fixture.otherActor);
    assert.equal((await reload(rowId)).qty, 13.5, "their save changed no figure");

    await assert.rejects(
      reverser().reverseOperation(fixture.sessionId, mine.eventId, { operationId: newOperationId() }, fixture.actor, GRANTS),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError, "a foreign edit in between is a 409");
        assert.match(error.message, /edited since/i);
        return true;
      },
      "undoing would discard a colleague's act that nobody reviewed",
    );

    assert.equal((await reload(rowId)).qty, 13.5, "the refused undo changed nothing");
  });
});

describe("withdrawing a shape, and putting it back", () => {
  test("deleting the last shape tombstones its line; undo restores both ids", async () => {
    const created = await wall();
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;

    const deleted = await apply({ kind: "delete-geometry", geometryId });
    assert.deepEqual(deleted.deletedGeometryIds, [geometryId]);
    assert.deepEqual(deleted.deletedRowIds, [rowId], "the line had no other measurement left");

    assert.equal(
      await db("precon_boq_rows").where({ id: rowId }).whereNull("deleted_at").first(),
      undefined,
      "the line is out of the active bill",
    );
    assert.equal((await liveGeometry(geometryId)).deleted, true, "the shape is tombstoned, not erased");
    assert.ok(await db("precon_boq_rows").where({ id: rowId }).first(), "and the line is tombstoned, not erased");

    const undone = await reverser().reverseOperation(
      fixture.sessionId,
      deleted.eventId,
      { operationId: newOperationId() },
      fixture.actor,
      GRANTS,
    );
    assert.equal(undone.reversed, true);

    const restored = await reload(rowId);
    assert.equal(restored.qty, 18.9, "the withdrawn quantity is back");
    assert.equal((await liveGeometry(geometryId)).deleted, false, "and so is the shape");
    assert.equal(
      undone.reversed && undone.receipt.rows[0]?.id,
      rowId,
      "restored under its ORIGINAL id, so estimate links and the audit trail still resolve",
    );
  });

  test("a retried undo restores once, not twice", async () => {
    const created = await wall();
    const edit = await apply(movePoint(created.geometries[0]!.id, 2));
    const operationId = newOperationId();
    const undo = reverser();

    const first = await undo.reverseOperation(fixture.sessionId, edit.eventId, { operationId }, fixture.actor, GRANTS);
    const retry = await undo.reverseOperation(fixture.sessionId, edit.eventId, { operationId }, fixture.actor, GRANTS);

    assert.equal(first.reversed && retry.reversed, true);
    assert.equal(
      retry.reversed && first.reversed && retry.receipt.eventId,
      first.reversed ? first.receipt.eventId : "",
      "the retry is answered by the first undo's own receipt",
    );
    assert.equal(
      Number((await db("precon_audit_events").where({ operation_id: operationId }).count("* as n").first())?.["n"]),
      1,
      "one undo, one compensating entry",
    );
    assert.equal((await reload(created.rows[0]!.id)).qty, 18.9, "and the figure was restored exactly once");
  });

  test("the same edit cannot be undone twice", async () => {
    const created = await wall();
    const edit = await apply(movePoint(created.geometries[0]!.id, 2));
    const undo = reverser();
    await undo.reverseOperation(fixture.sessionId, edit.eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);

    const again = await undo.reverseOperation(
      fixture.sessionId,
      edit.eventId,
      { operationId: newOperationId() },
      fixture.actor,
      GRANTS,
    );
    assert.equal(again.reversed, false, "a second undo of the same edit is refused");
    assert.equal(again.reversed === false && again.reason, "That edit has already been undone");
  });
});

describe("history reflects what can actually be undone", () => {
  test("an undone edit is listed as ineligible with its reason, and its compensation as a redo", async () => {
    const created = await wall();
    const edit = await apply(movePoint(created.geometries[0]!.id, 2));
    const undone = await reverser().reverseOperation(
      fixture.sessionId,
      edit.eventId,
      { operationId: newOperationId() },
      fixture.actor,
      GRANTS,
    );

    const listed = await editorHistoryService(preconAuditRepository(db)).history(
      fixture.sessionId,
      fixture.actor,
      fixture.sheetId,
    );

    const original = listed.operations.find((operation) => operation.eventId === edit.eventId);
    assert.ok(original, "the edit is still on the record");
    assert.equal(original.eligible, false, "it cannot be undone again");
    assert.equal(original.reason, "That edit has already been undone");
    assert.equal(original.reversedByEventId, undone.reversed ? undone.receipt.eventId : null);

    const compensation = listed.operations.find(
      (operation) => operation.eventId === (undone.reversed ? undone.receipt.eventId : ""),
    );
    assert.ok(compensation, "the undo is on the record too — no branch erases audit");
    assert.equal(compensation.direction, "redo", "reversing it would redo the edit");
    assert.equal(compensation.reversesEventId, edit.eventId, "and it names what it compensated for");
  });
});
