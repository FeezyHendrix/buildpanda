// What a re-scale refuses to guess, and what it refuses to pretend happened.
//
// Split from `editor-calibration.test.ts` at the house 400-line ceiling. That
// file pins what the preview promises and what the apply honours; this one pins
// the refusals — including the two the independent verifier found: an apply
// carrying no scale at all was accepted and bumped the sheet version, and a
// re-apply of the scale already in force did the same.

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
import { calibrationPreviewService } from "./editor-calibration-preview.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;
/** A second drawing, so a line measured across both proves cross-sheet safety. */
let otherSheetId: string;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "calib-refusals");
  otherSheetId = `pcsh_other_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: otherSheetId,
    session_id: fixture.sessionId,
    file_name: "other.pdf",
    storage_path: `qa/${otherSheetId}.pdf`,
    page_number: 5,
    code: "OTHER-01",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 50,
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

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(fixture.sessionId, { operationId: newOperationId(), command }, fixture.actor, GRANTS);

const preview = (): ReturnType<typeof calibrationPreviewService> => calibrationPreviewService(db);

async function undo(eventId: string): Promise<string> {
  const undoer = editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
  const outcome = await undoer.reverseOperation(fixture.sessionId, eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
  return outcome.reversed ? outcome.receipt.eventId : "";
}

const grossOf = async (rowId: string): Promise<number | null> => {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return row?.["qty_gross"] === null || row?.["qty_gross"] === undefined ? null : Number(row["qty_gross"]);
};

const sheetScale = async (id: string): Promise<number | null> => {
  const sheet = await db("precon_sheets").where({ id }).first();
  return sheet?.["scale_mm_per_pt"] === null ? null : Number(sheet?.["scale_mm_per_pt"]);
};

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

async function slab(sheetId: string, vertices: number[][], label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId,
    tool: "area",
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
  });
}

describe("what the server refuses to guess", () => {
  test("an unresolved legacy line blocks the apply and every other write on the sheet", async () => {
    const legacySheet = `pcsh_legacy_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: legacySheet,
      session_id: fixture.sessionId,
      file_name: "legacy.pdf",
      storage_path: `qa/${legacySheet}.pdf`,
      page_number: 6,
      code: "LEG-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      dim_unit: "mm",
      version: 1,
    });
    const good = await slab(legacySheet, rect(0, 0, 4, 4), "Resolvable");
    const legacyRow = `pbr_leg_${randomUUID().slice(0, 8)}`;
    await db("precon_boq_rows").insert({
      id: legacyRow,
      bill_id: fixture.billId,
      sort: 970,
      row_type: "item",
      description: "Legacy unclassified",
      unit: "m2",
      qty_gross: 12,
      deductions: JSON.stringify([]),
      qty: 12,
      version: 1,
      measurement_basis: "12 m2 on LEG-01",
      origin: "migrated",
      status: "verified",
    });
    const legacyGeometry = `pgeo_leg_${randomUUID().slice(0, 8)}`;
    await db("precon_geometries").insert({
      id: legacyGeometry,
      row_id: legacyRow,
      sheet_id: legacySheet,
      kind: "area",
      vertices: JSON.stringify(rect(0, 10, 3, 4)),
      source: "ai",
      quantity: 12,
      unit: "m2",
      definition: null,
    });

    const shown = await preview().calibration(fixture.sessionId, legacySheet, { newScaleMmPerPt: 100 });
    assert.equal(shown.unresolvedCount, 1, "the preview names the line it cannot re-measure");
    assert.equal(shown.blocked, true, "and says the apply is blocked");
    assert.ok(shown.unresolvedRowIds.includes(legacyRow));
    assert.ok(
      shown.legacySuggestions.some((s) => s.geometryId === legacyGeometry && s.unconfirmed === true),
      "with an explicitly UNCONFIRMED suggestion of the old selection rule, never an applied guess",
    );

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId: legacySheet, mmPerPt: 100, previewToken: shown.previewToken }),
      BadRequestError,
    );
    assert.equal(await sheetScale(legacySheet), 50, "the drawing keeps its scale");
    assert.equal(await grossOf(good.rows[0]!.id), 16, "and the resolvable line keeps its figure");

    // Confirming the ONE legacy shape unblocks it, per shape, never row-wide.
    const confirmed = await apply({
      kind: "confirm-measurement-basis",
      rowId: legacyRow,
      geometryId: legacyGeometry,
      tool: "area",
      unit: "m2",
    });
    assert.ok(confirmed.eventId, "the confirmation is itself a reversible operation");
    const after = await preview().calibration(fixture.sessionId, legacySheet, { newScaleMmPerPt: 100 });
    assert.equal(after.unresolvedCount, 0, "now nothing is unresolved");
    assert.equal(after.blocked, false);
    const applied = await apply({
      kind: "apply-calibration",
      sheetId: legacySheet,
      mmPerPt: 100,
      previewToken: after.previewToken,
    });
    assert.equal(await grossOf(legacyRow), 48, "12 m² at double the scale is 48");
    await undo(applied.eventId);
    assert.equal(await grossOf(legacyRow), 12);
  });

  test("a new shape crossing two scale regions needs an explicit whole-shape choice", async () => {
    const crossSheet = `pcsh_cross_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: crossSheet,
      session_id: fixture.sessionId,
      file_name: "cross.pdf",
      storage_path: `qa/${crossSheet}.pdf`,
      page_number: 7,
      code: "CROSS-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      dim_unit: "mm",
      version: 1,
      viewports: JSON.stringify([
        { id: "vp_left", label: "Left", rect: [0, 0, m(5), m(10)], scaleMmPerPt: 25 },
        { id: "vp_right", label: "Right", rect: [m(15), 0, m(25), m(10)], scaleMmPerPt: 100 },
      ]),
    });

    await assert.rejects(
      apply({
        kind: "create-geometry",
        sheetId: crossSheet,
        tool: "area",
        vertices: [[m(1), m(1)], [m(20), m(1)], [m(20), m(3)], [m(1), m(3)]],
        description: `Crossing ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /more than one scale|crosses/i, "it must say the shape spans two regions");
        return true;
      },
      "measuring across two scales silently picks one of them and bills the wrong figure",
    );

    // With the choice stated, it is measured at exactly that scale.
    const chosen = await apply({
      kind: "create-geometry",
      sheetId: crossSheet,
      tool: "area",
      vertices: [[m(1), m(1)], [m(20), m(1)], [m(20), m(3)], [m(1), m(3)]],
      description: `Crossing chosen ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
      scaleChoice: { source: "viewport", viewportId: "vp_left" },
    });
    const definition = (await db("precon_geometries").where({ id: chosen.geometries[0]!.id }).first())?.["definition"] as {
      scale?: { source?: string; viewportId?: string; appliedMmPerPt?: number };
    };
    assert.equal(definition?.scale?.viewportId, "vp_left", "the chosen binding is what it records");
    assert.equal(definition?.scale?.appliedMmPerPt, 25);
  });
});

describe("the legacy sheet PATCH cannot change a scale behind the editor's back", () => {
  test("a dimensional change through the old route is refused and points at the preview", async () => {
    const { preconService } = await import("./service.ts");
    const { preconRepository } = await import("./repository.ts");
    const service = preconService(preconRepository(db), noop);
    const row = await slab(fixture.sheetId, rect(0, 90, 4, 4), "Bypass");

    await assert.rejects(
      service.updateSheet(fixture.sheetId, { scaleMmPerPt: 200 }, fixture.actor),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /calibration|preview/i, "it has to name the path that does this safely");
        return true;
      },
    );
    assert.equal(await sheetScale(fixture.sheetId), 50, "the scale did not move");
    assert.equal(await grossOf(row.rows[0]!.id), 16, "and no line was left at a stale figure");

    // A non-dimensional change on the same route still works.
    const renamed = await service.updateSheet(fixture.sheetId, { title: "Renamed plan" }, fixture.actor);
    assert.equal(renamed.title, "Renamed plan", "renaming a drawing is not a re-measurement");
  });
});

// A re-calibration that re-states nothing is not a re-calibration.
//
// Two live findings from the independent verifier, both of which wrote a
// contractual record for an event that never happened:
//
//   * `apply-calibration { sheetId }` — no scale, no reference — was accepted.
//     `mmPerPtFor` fell back to the scale already in force, and the writer then
//     stamped a `calibration` record, a "Re-calibrated to …" basis and
//     `version + 1` for a change of nothing.
//   * re-applying the scale already in force did the same.
//
// The harm is not cosmetic. Every other client holding the old version now gets
// a spurious 409, the audit trail gains a re-calibration nobody performed, and
// `reviewResetPatch` drops the sign-off on every line measured on that drawing —
// a QS's verification withdrawn by a no-op.
describe("a re-calibration that changes nothing", () => {
  test("an apply carrying no scale at all is refused, and the drawing is untouched", async () => {
    const sheetId = fixture.sheetId;
    const before = await db("precon_sheets").where({ id: sheetId }).first();

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId } as unknown as EditorCommand),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /scale|distance/i, "it has to say what was missing");
        return true;
      },
    );

    const after = await db("precon_sheets").where({ id: sheetId }).first();
    assert.equal(after?.["version"], before?.["version"], "the drawing was not versioned");
    assert.equal(Number(after?.["scale_mm_per_pt"]), Number(before?.["scale_mm_per_pt"]));
    assert.equal(after?.["calibration"] ?? null, before?.["calibration"] ?? null, "and nothing was recorded");
  });

  test("re-stating the scale already in force is a no-op: no version, no lost sign-off", async () => {
    const sheetId = `pcsh_noop_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: sheetId,
      session_id: fixture.sessionId,
      file_name: "noop.pdf",
      storage_path: `qa/${sheetId}.pdf`,
      page_number: 11,
      code: "NOOP-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      scale_confidence: 1,
      dim_unit: "mm",
      version: 1,
    });
    const created = await slab(sheetId, rect(0, 300, 6, 4), "Signed off slab");
    const rowId = created.rows[0]!.id;
    await db("precon_boq_rows")
      .where({ id: rowId })
      .update({ status: "verified", verified_by: fixture.actor, verified_at: new Date() });

    const sheetBefore = await db("precon_sheets").where({ id: sheetId }).first();
    const rowBefore = await db("precon_boq_rows").where({ id: rowId }).first();
    const auditBefore = Number(
      (await db("precon_audit_events").where({ session_id: fixture.sessionId, action: "sheet_recalibrated" }).count<{ count: string }[]>("id as count"))[0]!.count,
    );

    const receipt = await apply({ kind: "apply-calibration", sheetId, mmPerPt: 50 });

    const sheetAfter = await db("precon_sheets").where({ id: sheetId }).first();
    const rowAfter = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(sheetAfter?.["version"], sheetBefore?.["version"], "the drawing was not versioned by a no-op");
    assert.equal(Number(sheetAfter?.["scale_mm_per_pt"]), 50);
    assert.equal(rowAfter?.["version"], rowBefore?.["version"], "no line was restated");
    assert.equal(rowAfter?.["status"], "verified", "and the sign-off stands");
    assert.equal(rowAfter?.["verified_by"], fixture.actor);
    assert.equal(Number(rowAfter?.["qty_gross"]), 24);
    assert.equal(
      Number(
        (await db("precon_audit_events").where({ session_id: fixture.sessionId, action: "sheet_recalibrated" }).count<{ count: string }[]>("id as count"))[0]!.count,
      ),
      auditBefore,
      "and the audit gained no re-calibration that never happened",
    );
    assert.ok(receipt.eventId, "the caller still gets a receipt, so a retry is idempotent rather than an error");

    // Idempotent: saying it a third time still changes nothing.
    await apply({ kind: "apply-calibration", sheetId, mmPerPt: 50 });
    const sheetAgain = await db("precon_sheets").where({ id: sheetId }).first();
    assert.equal(sheetAgain?.["version"], sheetBefore?.["version"]);
    assert.equal((await db("precon_boq_rows").where({ id: rowId }).first())?.["status"], "verified");
  });

  test("a real change on the same drawing still re-scales everything on it", async () => {
    const sheetId = `pcsh_real_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: sheetId,
      session_id: fixture.sessionId,
      file_name: "real.pdf",
      storage_path: `qa/${sheetId}.pdf`,
      page_number: 12,
      code: "REAL-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      scale_confidence: 1,
      dim_unit: "mm",
      version: 1,
    });
    const rowId = (await slab(sheetId, rect(0, 400, 6, 4), "Re-scaled slab")).rows[0]!.id;
    assert.equal(await grossOf(rowId), 24);

    await apply({ kind: "apply-calibration", sheetId, mmPerPt: 100 });
    assert.equal(await grossOf(rowId), 96, "double the scale is four times the area");
    assert.equal(Number((await db("precon_sheets").where({ id: sheetId }).first())?.["version"]), 2, "a real change versions the drawing");
  });
});
