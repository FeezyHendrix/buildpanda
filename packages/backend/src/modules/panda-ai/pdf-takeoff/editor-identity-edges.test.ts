// The identity blockers the frontend hit wiring the envelope: an assembly
// creation with no receipt, a compensation that forgot its sheet, and a
// direction that never flipped back after a redo.
//
// Split from editor-batch-edges.test.ts at the house 400-line ceiling; same
// fixture, same envelope.

// The loss-of-evidence edges my own task-10 claim left open, plus the two
// identity blockers the frontend hit wiring the envelope.
//
// Each one loses a record rather than producing a wrong number, which is why
// none of them showed up in the happy-path suites:
//
//   * splitting a merged donut dropped its voids — the halves came back billing
//     the courtyard they were supposed to deduct;
//   * duplicating a line copied only its primary drawing, so a wall traced as
//     three runs was copied as one;
//   * an assembly creation produced no receipt at all, so N priced lines existed
//     outside the undo stack;
//   * undoing a creation recorded `touchedSheetIds: []`, so the sheet-scoped
//     history lost the entry and the redo with it;
//   * every compensation reported itself as a "redo", including a redo, so the
//     client had to fold the parity itself.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
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
let coarseSheetId: string;
let assemblyId: string;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "batch-edges");
  coarseSheetId = `pcsh_edge_${randomUUID().slice(0, 8)}`;
  await db("precon_sheets").insert({
    id: coarseSheetId,
    session_id: fixture.sessionId,
    file_name: "coarse.pdf",
    storage_path: `qa/${coarseSheetId}.pdf`,
    page_number: 3,
    code: "EDGE-02",
    kind: "floor-plan",
    status: "measured",
    scale_mm_per_pt: 100,
    scale_confidence: 1,
    dim_unit: "mm",
    version: 1,
  });
  // A two-item priced assembly: 1.0 of the drawn area, and 2.5 of it.
  assemblyId = `asm_${randomUUID().slice(0, 8)}`;
  await db("precon_assemblies").insert({
    id: assemblyId,
    org_id: fixture.orgId,
    name: "Slab build-up",
    unit: "m2",
    element_group: "Slabs",
    items: JSON.stringify([
      { description: "Concrete slab", unit: "m2", factor: 1 },
      { description: "Formwork", unit: "m2", factor: 2.5 },
    ]),
  });
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db("precon_assemblies").where({ id: assemblyId }).delete();
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

async function reverse(eventId: string): Promise<{ eventId: string; direction: string }> {
  const outcome = await reverser().reverseOperation(fixture.sessionId, eventId, { operationId: newOperationId() }, fixture.actor, GRANTS);
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
  return outcome.reversed ? { eventId: outcome.receipt.eventId, direction: outcome.direction } : { eventId: "", direction: "" };
}

const figures = async (rowId: string): Promise<{ gross: number | null; net: number | null }> => {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return {
    gross: row?.["qty_gross"] === null || row?.["qty_gross"] === undefined ? null : Number(row["qty_gross"]),
    net: row?.["qty"] === null || row?.["qty"] === undefined ? null : Number(row["qty"]),
  };
};

const shapesOf = async (rowId: string, deduction: boolean): Promise<{ id: string; parent: string | null; quantity: number | null; vertices: number[][] }[]> => {
  const rows = await db("precon_geometries")
    .where({ row_id: rowId })
    .whereNull("deleted_at")
    .where(deduction ? { kind: "deduction" } : {})
    .modify((q) => {
      if (!deduction) q.whereNot({ kind: "deduction" });
    })
    .orderBy("created_at", "asc")
    .select("id", "parent_geometry_id", "quantity", "vertices");
  return rows.map((r: Record<string, unknown>) => ({
    id: r["id"] as string,
    parent: (r["parent_geometry_id"] ?? null) as string | null,
    quantity: r["quantity"] === null ? null : Number(r["quantity"]),
    vertices: r["vertices"] as number[][],
  }));
};

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

describe("an assembly creation is one reversible operation", () => {
  test("every output line lands together, independently, with one receipt", async () => {
    const created = await apply({
      kind: "create-assembly",
      sheetId: fixture.sheetId,
      assemblyId,
      tool: "area",
      vertices: rect(0, 80, 4, 4),
      elementGroup: "Slabs",
    });

    assert.equal(created.rows.length, 2, "one line per assembly item");
    assert.match(created.eventId, /^pae_/, "and one real audit event owning them");
    assert.equal(created.geometries.length, 2, "each line gets its own copy of the shape");
    assert.deepEqual(created.touchedSheetIds, [fixture.sheetId]);

    const figuresById = new Map<string, number>();
    for (const row of created.rows) figuresById.set(row.id, (await figures(row.id)).gross ?? 0);
    assert.deepEqual([...figuresById.values()].sort((a, b) => a - b), [16, 40], "16 m² × factor 1 and × factor 2.5");

    const shapeIds = new Set<string>();
    for (const row of created.rows) {
      const shapes = await shapesOf(row.id, false);
      assert.equal(shapes.length, 1, "each output line carries its own shape");
      assert.equal(shapeIds.has(shapes[0]!.id), false, "never a shared one");
      shapeIds.add(shapes[0]!.id);
      const definition = (await db("precon_geometries").where({ id: shapes[0]!.id }).first())?.["definition"] as {
        assembly?: { assemblyId?: string; factor?: number };
      };
      assert.equal(definition?.assembly?.assemblyId, assemblyId, "with the assembly frozen into it");
      assert.ok(definition?.assembly?.factor, "including the factor it was billed at");
    }

    const undone = await reverse(created.eventId);
    for (const row of created.rows) {
      assert.equal(
        await db("precon_boq_rows").where({ id: row.id }).whereNull("deleted_at").first(),
        undefined,
        `${row.id} is withdrawn by the undo`,
      );
    }
    await reverse(undone.eventId);
    for (const row of created.rows) {
      assert.ok(await db("precon_boq_rows").where({ id: row.id }).whereNull("deleted_at").first(), "and redo brings it back");
    }
  });

  test("creating an assembly needs measure as well as edit", async () => {
    await assert.rejects(
      apply(
        { kind: "create-assembly", sheetId: fixture.sheetId, assemblyId, tool: "area", vertices: rect(0, 100, 4, 4), elementGroup: "Slabs" },
        { edit: true, measure: false, verify: false },
      ),
      /measure/i,
    );
  });
});

describe("a compensation keeps the sheet it happened on", () => {
  test("undoing a creation still names the sheet, so the sheet history keeps it", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(20, 0, 4, 4),
      description: `Sheet-scoped ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const undone = await reverse(created.eventId);
    const record = await editorHistoryService(preconAuditRepository(db)).receipt(fixture.sessionId, undone.eventId, fixture.actor);
    assert.deepEqual(
      record.receipt?.touchedSheetIds,
      [fixture.sheetId],
      "the compensation records the drawing it happened on, even though every subject is now a tombstone",
    );

    const onSheet = await editorHistoryService(preconAuditRepository(db)).history(fixture.sessionId, fixture.actor, fixture.sheetId);
    assert.ok(
      onSheet.operations.some((entry) => entry.eventId === undone.eventId),
      "so the sheet-scoped history still carries it, and the redo does not vanish",
    );
  });
});

describe("history direction survives a redo", () => {
  test("reversing an edit, its undo and its redo alternate undo / redo / undo", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(30, 0, 4, 4),
      description: `Parity ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const edit = await apply({
      kind: "update-geometry",
      geometryId: created.geometries[0]!.id,
      vertices: rect(30, 0, 2, 4),
    });
    assert.equal((await figures(rowId)).gross, 8);

    const undone = await reverse(edit.eventId);
    assert.equal(undone.direction, "undo", "reversing the edit is an undo");
    assert.equal((await figures(rowId)).gross, 16);

    const redone = await reverse(undone.eventId);
    assert.equal(redone.direction, "redo", "reversing the undo is a redo");
    assert.equal((await figures(rowId)).gross, 8);

    const undoneAgain = await reverse(redone.eventId);
    assert.equal(
      undoneAgain.direction,
      "undo",
      "and reversing the REDO is an undo again — the client should not have to fold this parity itself",
    );
    assert.equal((await figures(rowId)).gross, 16);

    const history = await editorHistoryService(preconAuditRepository(db)).history(fixture.sessionId, fixture.actor, fixture.sheetId);
    const byId = new Map(history.operations.map((entry) => [entry.eventId, entry.direction]));
    assert.equal(byId.get(edit.eventId), "undo", "history agrees for the edit");
    assert.equal(byId.get(undone.eventId), "redo", "and for its undo");
    assert.equal(byId.get(redone.eventId), "undo", "and for the redo, which reverses back to an undo");
  });
});
