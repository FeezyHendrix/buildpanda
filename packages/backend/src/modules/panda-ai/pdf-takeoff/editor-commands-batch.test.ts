// Calibration and the batch restructures through the operation envelope.
//
// Split from editor-commands.test.ts at the house 400-line ceiling; the deduction
// half stays there. Same fixture, same envelope, same apply/undo/refuse shape.

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
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
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

describe("calibration goes through the envelope", () => {
  test("apply → undo restores every affected line's figure and the sheet scale", async () => {
    const sheetId = `pcsh_cal_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: sheetId,
      session_id: fixture.sessionId,
      file_name: "cal.pdf",
      storage_path: `qa/${sheetId}.pdf`,
      page_number: 9,
      code: "CAL-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      dim_unit: "mm",
      version: 1,
    });
    const a = await apply({
      kind: "create-geometry",
      sheetId,
      tool: "area",
      vertices: room(0),
      description: `Cal slab A ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const b = await apply({
      kind: "create-geometry",
      sheetId,
      tool: "polyline",
      vertices: [
        [m(0), m(0)],
        [m(3), m(0)],
      ],
      description: `Cal run B ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
    });
    assert.equal((await figures(a.rows[0]!.id)).qty, 24);
    assert.equal((await figures(b.rows[0]!.id)).qty, 3);

    // doubling mm-per-pt doubles a length and quadruples an area
    const applied = await apply({ kind: "apply-calibration", sheetId, mmPerPt: 100 });
    assert.equal((await figures(a.rows[0]!.id)).qty, 96, "area ×4");
    assert.equal((await figures(b.rows[0]!.id)).qty, 6, "length ×2");
    assert.equal(Number((await db("precon_sheets").where({ id: sheetId }).first())?.["scale_mm_per_pt"]), 100);
    assert.ok(
      (await db("precon_sheets").where({ id: sheetId }).first())?.["calibration"],
      "the reference calibration is persisted on the sheet",
    );
    assert.ok(applied.touchedSheetIds.includes(sheetId), "the receipt names the sheet it re-scaled");
    assert.equal(applied.rows.length, 2, "and every line it restated");

    await undo(applied.eventId);
    assert.equal((await figures(a.rows[0]!.id)).qty, 24, "undo puts the area back");
    assert.equal((await figures(b.rows[0]!.id)).qty, 3, "and the length");
    assert.equal(
      Number((await db("precon_sheets").where({ id: sheetId }).first())?.["scale_mm_per_pt"]),
      50,
      "and the sheet scale itself",
    );
  });

  test("a sheet with an unresolved line cannot be re-scaled at all", async () => {
    const sheetId = `pcsh_unres_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: sheetId,
      session_id: fixture.sessionId,
      file_name: "unres.pdf",
      storage_path: `qa/${sheetId}.pdf`,
      page_number: 10,
      code: "UNRES-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      dim_unit: "mm",
      version: 1,
    });
    const good = await apply({
      kind: "create-geometry",
      sheetId,
      tool: "area",
      vertices: room(0),
      description: `Resolvable ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    // a legacy line on the same sheet whose shape records nothing
    const legacyRow = `pbr_legacy_${randomUUID().slice(0, 8)}`;
    await db("precon_boq_rows").insert({
      id: legacyRow,
      bill_id: fixture.billId,
      sort: 950,
      row_type: "item",
      description: "Legacy, unclassified",
      unit: "m2",
      qty_gross: 12,
      deductions: JSON.stringify([]),
      qty: 12,
      version: 1,
      measurement_basis: "12 m2 measured on UNRES-01",
      origin: "migrated",
      status: "verified",
    });
    await db("precon_geometries").insert({
      id: `pgeo_legacy_${randomUUID().slice(0, 8)}`,
      row_id: legacyRow,
      sheet_id: sheetId,
      kind: "area",
      vertices: JSON.stringify(room(0)),
      source: "ai",
      quantity: 12,
      unit: "m2",
      definition: null,
    });

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId, mmPerPt: 100 }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError, "an unresolved line blocks the whole re-scale");
        assert.match(error.message, /unresolved|confirm/i);
        return true;
      },
      "re-scaling a sheet while one line cannot be re-measured would leave that line at a stale figure",
    );

    assert.equal((await figures(good.rows[0]!.id)).qty, 24, "the resolvable line is untouched");
    assert.equal((await figures(legacyRow)).qty, 12, "and so is the legacy one");
    assert.equal(
      Number((await db("precon_sheets").where({ id: sheetId }).first())?.["scale_mm_per_pt"]),
      50,
      "and the sheet keeps its scale",
    );
  });
});

describe("the batch restructures go through the envelope", () => {
  test("reassign moves a shape between lines and reverses both", async () => {
    const source = await slab(80, "Reassign source");
    const target = await slab(100, "Reassign target");
    const geometryId = source.geometries[0]!.id;

    const moved = await apply({ kind: "reassign-geometry", geometryId, targetRowId: target.rows[0]!.id });
    assert.equal(
      (await db("precon_geometries").where({ id: geometryId }).first())?.["row_id"],
      target.rows[0]!.id,
      "the shape now belongs to the target line",
    );
    assert.equal((await figures(target.rows[0]!.id)).gross, 48, "the target is re-added from both shapes");
    assert.ok(moved.rows.some((row) => row.id === source.rows[0]!.id), "the receipt names the source line too");

    await undo(moved.eventId);
    assert.equal(
      (await db("precon_geometries").where({ id: geometryId }).first())?.["row_id"],
      source.rows[0]!.id,
      "undo puts the shape back on the line it came from",
    );
    assert.equal((await figures(target.rows[0]!.id)).gross, 24, "and both lines are re-added");
    assert.equal((await figures(source.rows[0]!.id)).gross, 24);
  });

  test("duplicate needs measure as well as edit, and reverses to nothing", async () => {
    const created = await slab(120, "Duplicate source");
    const geometryId = created.geometries[0]!.id;

    await assert.rejects(
      apply({ kind: "duplicate-geometry", rowId: created.rows[0]!.id, geometryId, offset: [m(2), m(0)] }, { edit: true, measure: false, verify: false }),
      /measure/i,
      "copying a shape brings a new measurement into being",
    );

    const copied = await apply({ kind: "duplicate-geometry", rowId: created.rows[0]!.id, geometryId, offset: [m(2), m(0)] });
    const newRowId = copied.rows.find((row) => row.id !== created.rows[0]!.id)?.id ?? "";
    assert.ok(newRowId, "the copy is its own line");
    assert.equal((await figures(newRowId)).gross, 24, "a translated copy measures the same");
    assert.equal((await figures(created.rows[0]!.id)).gross, 24, "and the original is untouched");

    await undo(copied.eventId);
    assert.equal(
      await db("precon_boq_rows").where({ id: newRowId }).whereNull("deleted_at").first(),
      undefined,
      "undo withdraws the copy",
    );
  });

  test("a stale expected version refuses the whole batch and writes nothing", async () => {
    const source = await slab(140, "Stale source");
    const target = await slab(160, "Stale target");
    const geometryId = source.geometries[0]!.id;

    await assert.rejects(
      editorOperationService(db, noop).apply(
        fixture.sessionId,
        {
          operationId: newOperationId(),
          expectedRows: [{ id: target.rows[0]!.id, version: 99 }],
          command: { kind: "reassign-geometry", geometryId, targetRowId: target.rows[0]!.id },
        },
        fixture.actor,
        GRANTS,
      ),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        return true;
      },
    );

    assert.equal(
      (await db("precon_geometries").where({ id: geometryId }).first())?.["row_id"],
      source.rows[0]!.id,
      "the shape did not move",
    );
    assert.equal((await figures(target.rows[0]!.id)).gross, 24, "and neither line was restated");
  });
});
