// The openings the engine drafts, which no command could reach.
//
// `boq-draft.ts` writes every drafted opening as
// `{ geometryId: null, unitConfirmed: false }` — a figure with no shape, in a
// unit nobody checked. `edit-deduction` and `remove-deduction` find their target
// by that geometry id, so on an AI-drafted line the openings were frozen: a QS
// who found a 2 m² void that should have been 1.2 m² could not correct it and
// could not take it off. The only ways round it were to delete the whole line
// and re-measure by hand, or to leave the bill wrong.
//
// Addressing one by POSITION is what makes it reachable, and position is not
// identity — so everything below is about the refusals that make it safe:
// the row must not have moved, the entry must still say what the caller was
// shown, an opening that HAS a shape must not be reachable this way, and the
// unit nobody checked must be stated before the figure is trusted.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";
import type { Deduction } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "stated-ded");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand, grants: EditorGrants = GRANTS): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    grants,
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

const rowOf = async (rowId: string): Promise<Record<string, unknown>> =>
  (await db("precon_boq_rows").where({ id: rowId }).first()) as Record<string, unknown>;

const deductionsOf = async (rowId: string): Promise<Deduction[]> => (await rowOf(rowId))["deductions"] as Deduction[];
const netOf = async (rowId: string): Promise<number> => Number((await rowOf(rowId))["qty"]);
const versionOf = async (rowId: string): Promise<number> => Number((await rowOf(rowId))["version"]);
const shapeCount = async (rowId: string): Promise<number> =>
  Number((await db("precon_geometries").where({ row_id: rowId }).count<{ count: string }[]>("id as count"))[0]!.count);

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

/**
 * A 24 m² slab carrying the openings exactly as the engine drafts them: no
 * shape, no id, and a unit nobody confirmed.
 */
async function draftedLine(at: number, drafted: Deduction[]): Promise<string> {
  const created = await apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: rect(0, at, 6, 4),
    description: `Drafted slab ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
    rate: 10,
  });
  const rowId = created.rows[0]!.id;
  const gross = 24;
  const net = gross - drafted.reduce((sum, d) => sum + d.qty, 0);
  await db("precon_boq_rows")
    .where({ id: rowId })
    .update({ deductions: JSON.stringify(drafted), qty: net, origin: "ai", status: "ai_generated" });
  return rowId;
}

const asDrafted = (label: string, qty: number): Deduction => ({
  label,
  qty,
  geometryId: null,
  unit: "m2",
  unitConfirmed: false,
});

describe("a drafted opening can be corrected as typed numbers", () => {
  test("the figure, the unit and the confirmation all land, and the undo puts all three back", async () => {
    const rowId = await draftedLine(0, [asDrafted("Stair void", 2), asDrafted("Lift core", 3)]);
    assert.equal(await netOf(rowId), 19, "24 − 2 − 3 as drafted");

    const receipt = await apply({
      kind: "edit-stated-deduction",
      rowId,
      rowVersion: await versionOf(rowId),
      index: 0,
      expect: { label: "Stair void", qty: 2, unit: "m2" },
      qty: 1.2,
      unit: "m2",
      unitConfirmed: true,
    });

    const corrected = await deductionsOf(rowId);
    assert.equal(corrected[0]!.qty, 1.2, "the figure the QS measured off the drawing");
    assert.equal(corrected[0]!.unitConfirmed, true, "and the unit is no longer an assumption");
    assert.equal(corrected[0]!.geometryId, null, "a record that never had a shape does not acquire one");
    assert.equal(corrected[1]!.qty, 3, "the opening beside it is untouched");
    assert.equal(await netOf(rowId), 19.8, "24 − 1.2 − 3");
    assert.match(
      String((await rowOf(rowId))["measurement_basis"]),
      /4\.2 m2 deducted/,
      "and the sentence a dispute is read from agrees with the figure beside it",
    );

    await undo(receipt.eventId);
    const back = await deductionsOf(rowId);
    assert.equal(back[0]!.qty, 2, "undo restores the figure");
    assert.equal(back[0]!.unitConfirmed, false, "AND the fact that nobody had checked the unit");
    assert.equal(await netOf(rowId), 19);

    const trail = await db("precon_audit_events")
      .where({ session_id: fixture.sessionId, row_id: rowId })
      .orderBy("created_at", "asc");
    assert.ok(
      trail.some((entry) => entry["action"] === "stated_deduction_edited"),
      "the correction is on the record, attributed",
    );
    assert.equal(
      trail.find((entry) => entry["action"] === "stated_deduction_edited")?.["actor"],
      fixture.actor,
    );
  });

  test("a drafted opening can be taken off the line entirely, and put back", async () => {
    const rowId = await draftedLine(20, [asDrafted("Not a void at all", 5)]);
    const shapesBefore = await shapeCount(rowId);
    assert.equal(await netOf(rowId), 19);

    const receipt = await apply({
      kind: "remove-stated-deduction",
      rowId,
      rowVersion: await versionOf(rowId),
      index: 0,
      expect: { label: "Not a void at all", qty: 5, unit: "m2" },
    });
    assert.equal((await deductionsOf(rowId)).length, 0);
    assert.equal(await netOf(rowId), 24, "the line bills its whole gross again");
    assert.equal(await shapeCount(rowId), shapesBefore, "no drawing was withdrawn: there was never one to withdraw");

    await undo(receipt.eventId);
    assert.deepEqual(await deductionsOf(rowId), [asDrafted("Not a void at all", 5)], "restored exactly as drafted");
    assert.equal(await netOf(rowId), 19);
  });
});

describe("an edit by position cannot land on the wrong opening", () => {
  test("a list that has moved is refused, and nothing is written", async () => {
    const rowId = await draftedLine(40, [asDrafted("First", 2), asDrafted("Second", 3)]);
    const heldVersion = await versionOf(rowId);
    await apply({
      kind: "remove-stated-deduction",
      rowId,
      rowVersion: heldVersion,
      index: 0,
      expect: { label: "First", qty: 2, unit: "m2" },
    });

    await assert.rejects(
      apply({
        kind: "edit-stated-deduction",
        rowId,
        rowVersion: heldVersion,
        index: 1,
        expect: { label: "Second", qty: 3, unit: "m2" },
        qty: 1,
        unit: "m2",
        unitConfirmed: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.match(error.message, /version|refresh/i);
        return true;
      },
      "the row moved under the caller, so the position they hold means something else now",
    );
    assert.deepEqual(await deductionsOf(rowId), [asDrafted("Second", 3)], "nothing was written");
  });

  test("the right position holding the wrong opening is refused by name", async () => {
    const rowId = await draftedLine(60, [asDrafted("Stair", 2)]);
    await assert.rejects(
      apply({
        kind: "edit-stated-deduction",
        rowId,
        rowVersion: await versionOf(rowId),
        index: 0,
        expect: { label: "Lift", qty: 9, unit: "m2" },
        qty: 1,
        unit: "m2",
        unitConfirmed: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.match(error.message, /"Stair"/, "it says what is actually in that slot");
        assert.match(error.message, /"Lift"/, "and what the caller expected");
        return true;
      },
    );
    assert.equal((await deductionsOf(rowId))[0]!.qty, 2);
  });

  test("a position that names no opening is refused", async () => {
    const rowId = await draftedLine(80, [asDrafted("Only one", 2)]);
    await assert.rejects(
      apply({
        kind: "remove-stated-deduction",
        rowId,
        rowVersion: await versionOf(rowId),
        index: 4,
        expect: { label: "Only one", qty: 2, unit: "m2" },
      }),
      NotFoundError,
    );
    assert.equal((await deductionsOf(rowId)).length, 1);
  });
});

describe("a drawn opening is not reachable by position", () => {
  test("it is refused and pointed at its own shape, so the two can never disagree", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 100, 6, 4),
      description: `Drawn void host ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Drawn riser",
      mode: "area",
      vertices: rect(1, 101, 1, 1),
      sheetId: fixture.sheetId,
    });
    const drawn = (await deductionsOf(rowId))[0]!;
    assert.ok(drawn.geometryId, "this one has a shape of its own");

    await assert.rejects(
      apply({
        kind: "edit-stated-deduction",
        rowId,
        rowVersion: await versionOf(rowId),
        index: 0,
        expect: { label: drawn.label, qty: drawn.qty, unit: drawn.unit },
        qty: 0.5,
        unit: "m2",
        unitConfirmed: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /drawn on the sheet/i);
        assert.match(error.message, /edit-deduction/, "and names the command that does reach it");
        return true;
      },
    );
    assert.equal((await deductionsOf(rowId))[0]!.qty, drawn.qty, "the figure and its drawing still agree");
  });
});

describe("the unit nobody checked has to be stated", () => {
  test("an edit that does not confirm it is refused at the edge", async () => {
    const rowId = await draftedLine(120, [asDrafted("Assumed unit", 2)]);
    await assert.rejects(
      apply({
        kind: "edit-stated-deduction",
        rowId,
        rowVersion: await versionOf(rowId),
        index: 0,
        expect: { label: "Assumed unit", qty: 2, unit: "m2" },
        qty: 1,
        unit: "m2",
        unitConfirmed: false,
      } as unknown as EditorCommand),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        return true;
      },
    );
    assert.equal((await deductionsOf(rowId))[0]!.unitConfirmed, false, "still an assumption, and still says so");
  });
});

describe("a correction may not leave the line billing nothing", () => {
  test("an opening bigger than the line it comes off is refused", async () => {
    const rowId = await draftedLine(140, [asDrafted("Modest void", 2)]);
    await assert.rejects(
      apply({
        kind: "edit-stated-deduction",
        rowId,
        rowVersion: await versionOf(rowId),
        index: 0,
        expect: { label: "Modest void", qty: 2, unit: "m2" },
        qty: 90,
        unit: "m2",
        unitConfirmed: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /leaving nothing to bill|exceed/i);
        return true;
      },
    );
    assert.equal(await netOf(rowId), 22);
  });
});
