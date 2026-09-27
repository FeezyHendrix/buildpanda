// Changing the scale regions on a drawing, and what that does to the
// measurements taken inside them.
//
// A viewport is not decoration: a shape drawn inside one is measured at THAT
// region's scale and records it. So editing the region's scale is a
// re-calibration of everything bound to it, and withdrawing the region orphans
// every binding that names it.
//
// Two defects this pins, both of which produce a bill nobody can reconcile
// rather than an error:
//
//   * `apply-viewports` replaced the set and stopped. A region re-scaled from
//     1:20 to 1:10 left every figure measured in it untouched and stale, while
//     the NEXT unrelated edit to one of those lines re-added it at the new
//     scale — so the quantity jumped on an edit that had nothing to do with it,
//     with nothing in the audit trail naming a scale change;
//   * there was no way to see any of that before committing it. The apply asked
//     for confirmation on removals, but nothing said which lines, or what their
//     figures would become.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { calibrationPreviewService } from "./editor-calibration-preview.ts";
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
import type { SheetViewportInput } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const newOperationId = (): string => `op_${randomUUID()}`;

/** A 1:20 detail window in the corner of the drawing, away from every fixture shape. */
const DETAIL_RECT: [number, number, number, number] = [m(100), m(100), m(140), m(140)];

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "viewports");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(fixture.sessionId, { operationId: newOperationId(), command }, fixture.actor, GRANTS);

const preview = (): ReturnType<typeof calibrationPreviewService> => calibrationPreviewService(db);

async function undo(eventId: string): Promise<void> {
  const undoer = editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
  const outcome = await undoer.reverseOperation(fixture.sessionId, eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
}

const grossOf = async (rowId: string): Promise<number | null> => {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return row?.["qty_gross"] === undefined || row?.["qty_gross"] === null ? null : Number(row["qty_gross"]);
};

const statusOf = async (rowId: string): Promise<string> =>
  String((await db("precon_boq_rows").where({ id: rowId }).first())?.["status"]);

const sheetVersion = async (): Promise<number> =>
  Number((await db("precon_sheets").where({ id: fixture.sheetId }).first())?.["version"] ?? 1);

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

const detail = (scaleMmPerPt: number, id = "vp_detail"): SheetViewportInput[] => [
  { id, label: "Detail", rect: DETAIL_RECT, scaleMmPerPt },
];

/** A 2 m × 2 m slab drawn INSIDE the detail window, so it binds to that region. */
async function slabInDetail(label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: rect(101, 101, 2, 2),
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
  });
}

describe("re-scaling a region restates what was measured in it", () => {
  test("the preview names every line and what it becomes, and the apply agrees", async () => {
    await apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: detail(25) });
    const drawn = await slabInDetail("Detail slab");
    const rowId = drawn.rows[0]!.id;
    // 2 m × 2 m drawn at the SHEET's 50 mm/pt, measured at the region's 25, is a quarter
    assert.equal(await grossOf(rowId), 1, "measured in the region, not at the sheet scale");

    const shown = await preview().viewports(fixture.sessionId, fixture.sheetId, {
      version: await sheetVersion(),
      viewports: detail(50),
    });
    assert.match(shown.previewToken, /^[0-9a-f]{64}$/, "a fingerprint of the exact set it read");
    const line = shown.rescaled.find((entry) => entry.rowId === rowId);
    assert.ok(line, "the line measured in the re-scaled region is named");
    assert.equal(line.currentQtyGross, 1);
    assert.equal(line.newQtyGross, 4, "doubling the region's scale quadruples an area");
    assert.equal(shown.removed.length, 0, "nothing is being withdrawn");
    assert.equal(shown.blocked, false);

    const receipt = await apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: detail(50) });
    assert.equal(await grossOf(rowId), 4, "the apply writes exactly what the preview showed");
    assert.ok(
      receipt.rows.some((row) => row.id === rowId),
      "and the receipt names the line it restated, in the same operation as the region",
    );
    assert.equal(await statusOf(rowId), "needs_review", "a figure that moved goes back for review");

    await undo(receipt.eventId);
    assert.equal(await grossOf(rowId), 1, "undo restores the figure");
  });

  test("a region changed after the preview invalidates it", async () => {
    await apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: detail(25) });
    await slabInDetail("Drift slab");
    const shown = await preview().viewports(fixture.sessionId, fixture.sheetId, {
      version: await sheetVersion(),
      viewports: detail(50),
    });

    await slabInDetail("Drawn after the preview");

    await assert.rejects(
      apply({
        kind: "apply-viewports",
        sheetId: fixture.sheetId,
        viewports: detail(50),
        previewToken: shown.previewToken,
      }),
      ConflictError,
      "a preview that no longer describes the drawing cannot authorise a write",
    );
  });
});

describe("withdrawing a region measurements were taken in", () => {
  test("the preview lists them and the apply refuses until it is confirmed", async () => {
    await apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: detail(25) });
    const drawn = await slabInDetail("Orphan slab");
    const rowId = drawn.rows[0]!.id;

    const shown = await preview().viewports(fixture.sessionId, fixture.sheetId, {
      version: await sheetVersion(),
      viewports: [],
    });
    const removed = shown.removed.find((entry) => entry.viewportId === "vp_detail");
    assert.ok(removed, "the region being withdrawn is named");
    assert.ok(
      removed.measurements.some((entry) => entry.rowId === rowId),
      "with the measurements that were taken inside it",
    );
    assert.equal(shown.blocked, true, "so the apply is blocked until it is confirmed");

    await assert.rejects(
      apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: [] }),
      BadRequestError,
      "dropping a region silently leaves figures bound to one that no longer exists",
    );
    assert.equal(await grossOf(rowId), 1, "and nothing moved");

    const receipt = await apply({
      kind: "apply-viewports",
      sheetId: fixture.sheetId,
      viewports: [],
      confirmed: true,
    });
    assert.equal(
      await grossOf(rowId),
      1,
      "a withdrawn region does not restate what was measured in it: the figure is still what was drawn",
    );
    await undo(receipt.eventId);
  });
});

describe("what a dimension unit is, and what it is not", () => {
  // `dim_unit` names the unit the ENGINE reads dimension annotations on the
  // drawing in ("3600" as mm or cm). It is an input to detection and a label on
  // the sheet DTO; no editor path multiplies a quantity by it — points become
  // metres through mm-per-point alone. So correcting it must stay possible on a
  // measured drawing, and it must move nothing. This test is the proof, not the
  // claim: if a future change makes it dimensional, it fails here.
  test("correcting it on a measured drawing is allowed and restates nothing", async () => {
    const { preconService } = await import("./service.ts");
    const { preconRepository } = await import("./repository.ts");
    const service = preconService(preconRepository(db), noop);
    await apply({ kind: "apply-viewports", sheetId: fixture.sheetId, viewports: detail(25) });
    const drawn = await slabInDetail("Dim unit");
    const rowId = drawn.rows[0]!.id;
    const before = await db("precon_boq_rows").where({ id: rowId }).first();
    const sheetBefore = await db("precon_sheets").where({ id: fixture.sheetId }).first();

    const updated = await service.updateSheet(fixture.sheetId, { dimUnit: "cm" }, fixture.actor);
    assert.equal(updated.dimUnit, "cm", "the correction lands");

    const after = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(after?.["qty_gross"]), Number(before?.["qty_gross"]), "no figure moved");
    assert.equal(Number(after?.["qty"]), Number(before?.["qty"]));
    assert.equal(after?.["version"], before?.["version"], "no line was versioned");
    assert.equal(after?.["status"], before?.["status"], "and no sign-off was cleared");
    assert.equal(
      Number((await db("precon_sheets").where({ id: fixture.sheetId }).first())?.["scale_mm_per_pt"]),
      Number(sheetBefore?.["scale_mm_per_pt"]),
      "the scale that DOES turn points into metres is untouched",
    );
  });

  test("re-applying the scale a drawing already has keeps every sign-off", async () => {
    const drawn = await slabInDetail("No-op");
    const rowId = drawn.rows[0]!.id;
    await apply({ kind: "set-row-typical", rowId, typical: 1 });
    await db("precon_boq_rows").where({ id: rowId }).update({ status: "verified", verified_by: fixture.actor });
    const before = await db("precon_boq_rows").where({ id: rowId }).first();
    const current = Number((await db("precon_sheets").where({ id: fixture.sheetId }).first())?.["scale_mm_per_pt"]);

    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: current });
    await apply({
      kind: "apply-calibration",
      sheetId: fixture.sheetId,
      mmPerPt: current,
      previewToken: shown.previewToken,
    });

    const after = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(after?.["qty_gross"]), Number(before?.["qty_gross"]), "no figure moved");
    assert.equal(after?.["version"], before?.["version"], "so the line was not versioned");
    assert.equal(after?.["status"], "verified", "and it kept its status");
    assert.equal(after?.["verified_by"], fixture.actor, "and the verifier's name");
  });
});
