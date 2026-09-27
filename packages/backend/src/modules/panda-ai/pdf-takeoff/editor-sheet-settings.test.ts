// What a drawing tells the client about itself, and the one non-quantity
// setting it carries.
//
// Two separate holes this pins:
//
//   * every sheet-level write is version-checked, but the sheet DTO never
//     carried the version. A client could only learn it by SENDING a wrong one
//     and reading the number out of the 409 prose — so a correct first attempt
//     was impossible, and the prose became an accidental API.
//   * the alignment of one revision over another is a real record — which
//     drawings, which three reference points, what opacity — and it had nowhere
//     to live. Kept in component state it dies on refresh; written loosely it
//     becomes a way to restate quantities from a view setting.
//
// So: the version and the calibration are exposed, and the overlay is persisted
// through the same versioned envelope as everything else while being unable to
// touch a single figure.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { toSheet } from "./dto.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import type { PreconSheetRow } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "sheetdto");
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

const sheetRow = async (id: string): Promise<PreconSheetRow> =>
  (await db<PreconSheetRow>("precon_sheets").where({ id }).first())!;

const snapshotSheet = async (id: string) => {
  const service = preconService(preconRepository(db), noop);
  const snapshot = await service.getSnapshot(fixture.sessionId);
  return snapshot.sheets.find((sheet) => sheet.id === id);
};

async function revisionOf(code: string, page: number, sessionId: string): Promise<string> {
  const id = `pcsh_${code}_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id,
    session_id: sessionId,
    file_name: `${code}.pdf`,
    storage_path: `qa/${id}.pdf`,
    page_number: page,
    code: code.toUpperCase(),
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 50,
    dim_unit: "mm",
    version: 1,
  });
  return id;
}

describe("a drawing states its own version and how it was calibrated", () => {
  test("the DTO carries both, so a client never has to read a version out of a 409", async () => {
    const before = await snapshotSheet(fixture.sheetId);
    assert.ok(before, "the fixture sheet is in the snapshot");
    assert.equal(before.version, 1, "the version every sheet-level write is checked against");
    assert.equal(before.calibration, null, "and nothing recorded about how it was scaled yet");

    // A REAL re-calibration: the QS measured 200 pt and typed 20 m, so the
    // drawing is 100 mm/pt, not the 50 it was on. Stating the scale already in
    // force (10 m over the same 200 pt) is a no-op by contract and would
    // correctly leave the version alone — see editor-calibration-refusals.
    await apply({
      kind: "apply-calibration",
      sheetId: fixture.sheetId,
      reference: { fromPt: [0, 0], toPt: [m(10), 0], enteredDistance: 20, unit: "m" },
    });

    const after = await snapshotSheet(fixture.sheetId);
    assert.ok(after);
    assert.equal(after.version, 2, "the re-calibration moved the version, and the DTO says so");
    assert.equal(after.calibration?.mmPerPt, 100, "the scale the reference actually implies");
    assert.equal(after.calibration?.enteredDistance, 20, "with the distance the QS actually typed");
    assert.equal(after.calibration?.unit, "m");
    assert.equal(after.calibration?.actor, fixture.actor, "attributed");
    assert.ok(after.calibration?.time, "and timestamped");

    // The mapper is what the route serialises, so it is asserted directly too:
    // a response allowlist that drops these silently is the same bug again.
    const mapped = toSheet(await sheetRow(fixture.sheetId));
    assert.equal(mapped.version, 2);
    assert.equal(mapped.calibration?.mmPerPt, after.calibration?.mmPerPt);
  });
});

describe("persisting how one revision is laid over another", () => {
  test("it survives a reload, is versioned, and moves no quantity", async () => {
    const source = await revisionOf("ov_src", 40, fixture.sessionId);
    const target = await revisionOf("ov_tgt", 41, fixture.sessionId);
    const measured = await apply({
      kind: "create-geometry",
      sheetId: target,
      tool: "area",
      vertices: [[0, 0], [m(6), 0], [m(6), m(4)], [0, m(4)]],
      description: `Overlay slab ${randomUUID().slice(0, 6)}`,
      elementGroup: "Overlay",
    });
    const rowId = measured.rows[0]!.id;
    const billed = await db("precon_boq_rows").where({ id: rowId }).first();

    const receipt = await apply({
      kind: "set-overlay",
      sheetId: target,
      overlay: {
        sourceSheetId: source,
        opacity: 0.45,
        anchors: [
          { source: [0, 0], target: [m(1), m(1)] },
          { source: [m(10), 0], target: [m(11), m(1)] },
          { source: [0, m(10)], target: [m(1), m(11)] },
        ],
      },
    });
    assert.ok(receipt.eventId, "it is a real operation with a receipt");

    const stored = await snapshotSheet(target);
    assert.equal(stored?.overlaySettings?.sourceSheetId, source, "the alignment survives a reload");
    assert.equal(stored?.overlaySettings?.targetSheetId, target);
    assert.equal(stored?.overlaySettings?.opacity, 0.45);
    assert.equal(stored?.overlaySettings?.anchors.length, 3, "all three reference points are kept");
    assert.ok(stored?.overlaySettings?.matrix, "with the affine they imply");
    assert.equal(stored?.overlaySettings?.actor, fixture.actor, "attributed");
    assert.equal(stored?.version, 2, "and the drawing was versioned by it");

    const after = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(after?.["qty_gross"]), Number(billed?.["qty_gross"]), "no figure moved");
    assert.equal(after?.["version"], billed?.["version"], "no line was versioned");
    assert.equal(after?.["status"], billed?.["status"], "and no review state changed");
  });

  test("three points that fall on one line define no alignment and are refused", async () => {
    const source = await revisionOf("ov_col_s", 42, fixture.sessionId);
    const target = await revisionOf("ov_col_t", 43, fixture.sessionId);
    await assert.rejects(
      apply({
        kind: "set-overlay",
        sheetId: target,
        overlay: {
          sourceSheetId: source,
          opacity: 0.5,
          anchors: [
            { source: [0, 0], target: [0, 0] },
            { source: [m(1), m(1)], target: [m(1), m(1)] },
            { source: [m(2), m(2)], target: [m(2), m(2)] },
          ],
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /line|collinear/i, "it must say why they cannot align anything");
        return true;
      },
    );
    assert.equal((await snapshotSheet(target))?.overlaySettings, null, "and nothing was stored");
  });

  test("an opacity outside 0..1 and a foreign source drawing are both refused", async () => {
    const source = await revisionOf("ov_bad_s", 44, fixture.sessionId);
    const target = await revisionOf("ov_bad_t", 45, fixture.sessionId);
    const anchors = [
      { source: [0, 0], target: [0, 0] },
      { source: [m(10), 0], target: [m(10), 0] },
      { source: [0, m(10)], target: [0, m(10)] },
    ];
    await assert.rejects(
      apply({ kind: "set-overlay", sheetId: target, overlay: { sourceSheetId: source, opacity: 4, anchors } }),
      BadRequestError,
      "an opacity of 4 is not a transparency",
    );

    // A drawing from another take-off is not in this one's lineage; overlaying it
    // would compare this project against a job it has nothing to do with.
    const other = await seedEditorFixture(db, "sheetdto_other");
    try {
      const foreign = await revisionOf("ov_foreign", 46, other.sessionId);
      await assert.rejects(
        apply({ kind: "set-overlay", sheetId: target, overlay: { sourceSheetId: foreign, opacity: 0.5, anchors } }),
        (error: unknown) => {
          assert.ok(error instanceof BadRequestError || error instanceof ConflictError);
          return true;
        },
        "a drawing outside this take-off cannot be laid over it",
      );
    } finally {
      await dropEditorFixture(db, other);
    }
    assert.equal((await snapshotSheet(target))?.overlaySettings, null, "and nothing was stored either time");
  });

  test("clearing the alignment is itself a versioned act", async () => {
    const source = await revisionOf("ov_clr_s", 47, fixture.sessionId);
    const target = await revisionOf("ov_clr_t", 48, fixture.sessionId);
    const anchors = [
      { source: [0, 0], target: [0, 0] },
      { source: [m(10), 0], target: [m(10), 0] },
      { source: [0, m(10)], target: [0, m(10)] },
    ];
    await apply({ kind: "set-overlay", sheetId: target, overlay: { sourceSheetId: source, opacity: 0.5, anchors } });
    assert.ok((await snapshotSheet(target))?.overlaySettings, "aligned");

    await apply({ kind: "set-overlay", sheetId: target, overlay: null });
    assert.equal((await snapshotSheet(target))?.overlaySettings, null, "and reset back to unaligned");
    assert.equal((await snapshotSheet(target))?.version, 3, "both acts moved the version");
  });
});
