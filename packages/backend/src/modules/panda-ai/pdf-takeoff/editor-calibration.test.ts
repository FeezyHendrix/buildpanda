// Re-scaling a drawing safely: what the preview promises, what the apply
// honours, and what neither may guess.
//
// Four defects this pins, all of which produce a bill nobody can reconcile
// rather than an error:
//
//   * the recompute read `[...geometries].reverse().find(...)` — the LAST shape
//     only — so a wall traced as two runs was re-scaled as one and the line fell
//     to a fraction of itself;
//   * it decided "is this in a viewport?" by looking at the first vertex instead
//     of the binding the measurement actually recorded, so a shape that had been
//     moved re-scaled against a region it was never measured in;
//   * the preview returned no versions and no fingerprint, so an apply could land
//     on a sheet that had gained a line since the QS looked at it;
//   * `PATCH /precon/sheets/:sheetId` could change the scale on the pool with no
//     lock, no preview and no recompute at all.

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
  fixture = await seedEditorFixture(db, "calibration");
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

describe("the preview pins what the apply is allowed to land on", () => {
  test("it reports every affected line with its version, and a fingerprint of the set", async () => {
    const a = await slab(fixture.sheetId, rect(0, 0, 4, 4), "Pinned A");
    const b = await slab(fixture.sheetId, rect(10, 0, 6, 4), "Pinned B");

    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: 100 });
    assert.equal(shown.sheetVersion, 1, "the sheet version the figures were read at");
    assert.match(shown.previewToken, /^[0-9a-f]{64}$/, "and a fingerprint of the exact set it looked at");

    const byRow = new Map(shown.affectedRows.map((row) => [row.rowId, row]));
    assert.equal(byRow.get(a.rows[0]!.id)?.currentQtyGross, 16);
    assert.equal(byRow.get(a.rows[0]!.id)?.newQtyGross, 64, "16 m² at double the scale is 64");
    assert.equal(byRow.get(a.rows[0]!.id)?.version, 1, "each line is pinned at the version shown");
    assert.equal(byRow.get(b.rows[0]!.id)?.newQtyGross, 96, "24 m² becomes 96");
    assert.equal(shown.unresolvedCount, 0);

    const receipt = await apply({
      kind: "apply-calibration",
      sheetId: fixture.sheetId,
      mmPerPt: 100,
      previewToken: shown.previewToken,
    });
    assert.equal(await grossOf(a.rows[0]!.id), 64);
    assert.equal(await grossOf(b.rows[0]!.id), 96);
    assert.equal(await sheetScale(fixture.sheetId), 100);
    assert.equal(receipt.rows.length >= 2, true, "the receipt names every line it restated");

    await undo(receipt.eventId);
    assert.equal(await grossOf(a.rows[0]!.id), 16, "undo restores both lines");
    assert.equal(await grossOf(b.rows[0]!.id), 24);
    assert.equal(await sheetScale(fixture.sheetId), 50, "and the sheet scale");
  });

  test("a line drawn after the preview invalidates it", async () => {
    const existing = await slab(fixture.sheetId, rect(0, 30, 4, 4), "Drift base");
    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: 100 });

    // somebody else measures on the same drawing between preview and apply
    await slab(fixture.sheetId, rect(20, 30, 4, 4), "Drift new");

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId: fixture.sheetId, mmPerPt: 100, previewToken: shown.previewToken }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError, "a preview that no longer describes the drawing is a 409");
        assert.match(error.message, /changed since|refresh/i);
        return true;
      },
    );
    assert.equal(await grossOf(existing.rows[0]!.id), 16, "and nothing was re-scaled");
    assert.equal(await sheetScale(fixture.sheetId), 50);
  });

  test("an edit to an affected line after the preview invalidates it too", async () => {
    const row = await slab(fixture.sheetId, rect(0, 50, 4, 4), "Version drift");
    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: 100 });
    await apply({ kind: "update-geometry", geometryId: row.geometries[0]!.id, vertices: rect(0, 50, 2, 4) });

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId: fixture.sheetId, mmPerPt: 100, previewToken: shown.previewToken }),
      ConflictError,
    );
    assert.equal(await sheetScale(fixture.sheetId), 50);
  });
});

describe("a line measured by several shapes, on more than one drawing", () => {
  test("every contribution is re-scaled, and the ones on other sheets are left alone", async () => {
    const created = await slab(fixture.sheetId, rect(0, 70, 4, 4), "Multi");
    const rowId = created.rows[0]!.id;
    // a second contribution on THIS sheet, and a third on ANOTHER
    for (const [sheetId, x, y] of [[fixture.sheetId, 10, 70], [otherSheetId, 0, 0]] as const) {
      await db("precon_geometries").insert({
        id: `pgeo_c_${randomUUID().slice(0, 8)}`,
        row_id: rowId,
        sheet_id: sheetId,
        kind: "area",
        vertices: JSON.stringify(rect(x, y, 2, 2)),
        source: "manual",
        quantity: 4,
        unit: "m2",
        definition: JSON.stringify({
          schemaVersion: 1,
          role: "measurement",
          tool: "area",
          shape: { role: "path", start: [m(x), m(y)], segments: [], closed: true },
          scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: 50 },
        }),
      });
    }
    await apply({ kind: "update-geometry", geometryId: created.geometries[0]!.id, vertices: rect(0, 70, 4, 4) });
    assert.equal(await grossOf(rowId), 24, "16 + 4 + 4 across three shapes");

    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: 100 });
    const line = shown.affectedRows.find((r) => r.rowId === rowId);
    assert.ok(line, "the multi-shape line is in the preview");
    // the two on this sheet quadruple (16→64, 4→16); the one on the other sheet stays 4
    assert.equal(line.newQtyGross, 84, "64 + 16 + 4: only the shapes on THIS drawing move");
    assert.equal(line.contributions, 3, "and the preview says how many shapes it added up");

    const receipt = await apply({
      kind: "apply-calibration",
      sheetId: fixture.sheetId,
      mmPerPt: 100,
      previewToken: shown.previewToken,
    });
    assert.equal(await grossOf(rowId), 84, "the apply agrees with the preview exactly");

    await undo(receipt.eventId);
    assert.equal(await grossOf(rowId), 24, "and undo puts all three back");
  });
});

describe("the stored binding decides, never the first vertex", () => {
  test("a shape bound to a viewport is not re-scaled by a sheet calibration", async () => {
    const viewportId = `vp_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets")
      .where({ id: fixture.sheetId })
      .update({
        viewports: JSON.stringify([
          { id: viewportId, label: "Detail", rect: [m(40), m(0), m(60), m(20)], scaleMmPerPt: 25 },
        ]),
      });
    const bound = await slab(fixture.sheetId, rect(41, 1, 2, 2), "Bound");
    const boundRow = bound.rows[0]!.id;
    assert.equal(
      (await db("precon_geometries").where({ id: bound.geometries[0]!.id }).first())?.["definition"]?.["scale"]?.["source"],
      "viewport",
      "it was measured in the viewport, so that is what it records",
    );
    const atViewportScale = await grossOf(boundRow);

    // Now MOVE it outside the viewport. Its binding must not change.
    await apply({ kind: "transform-geometry", rowId: boundRow, geometryId: bound.geometries[0]!.id, translate: [m(-40), m(60)] });
    assert.equal(
      (await db("precon_geometries").where({ id: bound.geometries[0]!.id }).first())?.["definition"]?.["scale"]?.["source"],
      "viewport",
      "moving a shape does not silently switch the scale it is measured at",
    );
    assert.equal(await grossOf(boundRow), atViewportScale, "so its figure does not change either");

    const shown = await preview().calibration(fixture.sessionId, fixture.sheetId, { newScaleMmPerPt: 100 });
    assert.equal(
      shown.affectedRows.some((r) => r.rowId === boundRow),
      false,
      "and a sheet re-scale leaves it alone, because the sheet scale never applied to it",
    );
    assert.ok(
      shown.rebindSuggestions.some((s) => s.rowId === boundRow),
      "but the preview REPORTS that it now sits over a different region, for the QS to decide",
    );
  });
});
