// The undo is the one path that writes values nobody re-entered.
//
// Every forward command parses its input at the boundary. The reversal does
// not: it takes the state an audit row recorded and writes it back. Those
// fields are `unknown` in `OperationStateV1` — honestly so, because the column
// is jsonb written by this code and by older code, and it can be hand-edited in
// the database — and the writer used to cast each one into place with
// `as never`. So the least-validated path in the module was the one restoring a
// drawing's scale, its viewports, its revision overlay and a redline's shape.
//
// Nothing here demonstrates an exploit; the independent verifier was explicit
// that it had not. The claim is narrower and is what these pin: a recorded
// value that cannot be read is REFUSED, and the refusal is an ordinary 4xx that
// writes nothing — not a 500, and not a silent write of a half-shaped record.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";
import {
  readMarkupGeometry,
  readOverlaySettings,
  readSheetCalibration,
  readViewports,
  UnreadableAuditState,
} from "./editor-audit-parse.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "audit-restore");
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

const reverse = (eventId: string): ReturnType<ReturnType<typeof editorReverseServiceWith>["reverseOperation"]> =>
  editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db)).reverseOperation(
    fixture.sessionId,
    eventId,
    { operationId: `op_${randomUUID()}` },
    fixture.actor,
    GRANTS,
  );

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

async function calibratedSheet(page: number, tag: string): Promise<string> {
  const sheetId = `pcsh_${tag}_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: sheetId,
    session_id: fixture.sessionId,
    file_name: `${tag}.pdf`,
    storage_path: `qa/${sheetId}.pdf`,
    page_number: page,
    code: `${tag.toUpperCase()}-01`,
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 50,
    scale_confidence: 1,
    dim_unit: "mm",
    version: 1,
  });
  return sheetId;
}

/** Rewrites one field of the state an audit row recorded, as a hand edit would. */
async function corruptRecordedSheet(eventId: string, sheetId: string, patch: Record<string, unknown>): Promise<void> {
  const row = await db("precon_audit_events").where({ id: eventId }).first();
  const beforeState = row!["before"] as { schemaVersion: number; state: { sheets: Record<string, unknown> } };
  beforeState.state.sheets[sheetId] = { ...(beforeState.state.sheets[sheetId] as object), ...patch };
  await db("precon_audit_events").where({ id: eventId }).update({ before: JSON.stringify(beforeState) });
}

describe("a recorded state that cannot be read is refused, not written", () => {
  test("a hand-mangled sheet scale refuses the undo and changes nothing", async () => {
    const sheetId = await calibratedSheet(70, "corrupt");
    const rowId = (
      await apply({
        kind: "create-geometry",
        sheetId,
        tool: "area",
        vertices: rect(0, 0, 6, 4),
        description: `Corrupt host ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
      })
    ).rows[0]!.id;

    const receipt = await apply({ kind: "apply-calibration", sheetId, mmPerPt: 100 });
    assert.equal(Number((await db("precon_boq_rows").where({ id: rowId }).first())?.["qty_gross"]), 96);

    // `mmPerPt` is the one field the whole record is useless without.
    await corruptRecordedSheet(receipt.eventId, sheetId, { calibration: { mmPerPt: "one to fifty", actor: 7 } });

    const sheetBefore = await db("precon_sheets").where({ id: sheetId }).first();
    await assert.rejects(reverse(receipt.eventId), (error: unknown) => {
      assert.ok(error instanceof BadRequestError, `a corrupt record is a refusal, not a server fault: ${String(error)}`);
      assert.equal(error.statusCode, 400, "so the caller gets a 400, never a 500");
      assert.match(error.message, /cannot be undone|can no longer be read/i);
      return true;
    });

    const sheetAfter = await db("precon_sheets").where({ id: sheetId }).first();
    assert.equal(sheetAfter?.["version"], sheetBefore?.["version"], "the drawing was not touched by the refusal");
    assert.equal(Number(sheetAfter?.["scale_mm_per_pt"]), 100, "it still says what it was re-calibrated to");
    assert.equal(
      Number((await db("precon_boq_rows").where({ id: rowId }).first())?.["qty_gross"]),
      96,
      "and no line was half-restored",
    );
  });

  test("a mangled viewport list refuses the same way", async () => {
    const sheetId = await calibratedSheet(71, "vpcorrupt");
    const receipt = await apply({
      kind: "apply-viewports",
      sheetId,
      viewports: [{ label: "Detail", rect: [0, 0, m(10), m(10)], scaleMmPerPt: 25 }],
    });
    await corruptRecordedSheet(receipt.eventId, sheetId, { viewports: [{ id: "vp_x", label: "Detail", rect: [1, 2], scaleMmPerPt: 25 }] });

    const before = await db("precon_sheets").where({ id: sheetId }).first();
    await assert.rejects(reverse(receipt.eventId), BadRequestError);
    const afterRow = await db("precon_sheets").where({ id: sheetId }).first();
    assert.equal(afterRow?.["version"], before?.["version"], "no version moved");
    assert.deepEqual(afterRow?.["viewports"], before?.["viewports"], "and the drawing's regions are untouched");
  });

  test("an undo whose record IS readable still works, so the guard is not blanket", async () => {
    const sheetId = await calibratedSheet(72, "intact");
    const rowId = (
      await apply({
        kind: "create-geometry",
        sheetId,
        tool: "area",
        vertices: rect(0, 0, 6, 4),
        description: `Intact host ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
      })
    ).rows[0]!.id;
    const receipt = await apply({ kind: "apply-calibration", sheetId, mmPerPt: 100 });
    assert.equal(Number((await db("precon_boq_rows").where({ id: rowId }).first())?.["qty_gross"]), 96);

    const outcome = await reverse(receipt.eventId);
    assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
    assert.equal(Number((await db("precon_boq_rows").where({ id: rowId }).first())?.["qty_gross"]), 24, "back to 24 m²");
    assert.equal(Number((await db("precon_sheets").where({ id: sheetId }).first())?.["scale_mm_per_pt"]), 50);
  });
});

describe("the parsers themselves refuse what they cannot read", () => {
  test("absence is not corruption: null and undefined read back as null", () => {
    assert.equal(readSheetCalibration(null), null, "a drawing that recorded no scale is restored to having none");
    assert.equal(readViewports(undefined), null);
    assert.equal(readOverlaySettings(null), null);
  });

  test("a half-shaped record is refused, naming which one it was", () => {
    assert.throws(() => readSheetCalibration({ mmPerPt: 0, actor: "u", time: "t" }), UnreadableAuditState);
    assert.throws(() => readSheetCalibration({ mmPerPt: 50, actor: "u" }), /sheet scale/);
    assert.throws(() => readViewports([{ id: "v", label: "L", rect: [1, 2, 3], scaleMmPerPt: 1 }]), /viewports/);
    assert.throws(() => readOverlaySettings({ schemaVersion: 2 }), /revision overlay/);
    assert.throws(() => readMarkupGeometry({ kind: "pin", at: { x: 1 } }), /redline/);
    assert.throws(() => readMarkupGeometry({ kind: "not a shape" }), /redline/);
  });

  test("a well-formed record round-trips to exactly what it recorded", () => {
    const calibration = readSheetCalibration({ mmPerPt: 50, actor: "u_1", time: "2026-01-01T00:00:00.000Z", enteredDistance: 10, unit: "m" });
    assert.equal(calibration?.mmPerPt, 50);
    assert.equal(calibration?.enteredDistance, 10);
    assert.deepEqual(readViewports([{ id: "vp_a", label: "Detail", rect: [0, 0, 10, 10], scaleMmPerPt: 25 }]), [
      { id: "vp_a", label: "Detail", rect: [0, 0, 10, 10], scaleMmPerPt: 25 },
    ]);
    assert.deepEqual(readMarkupGeometry({ kind: "pin", at: { x: 3, y: 4 }, space: "points" }), {
      kind: "pin",
      at: { x: 3, y: 4 },
      space: "points",
    });
  });
});
