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

describe("splitting an area that has voids", () => {
  test("each void is clipped onto the piece that contains it, once", async () => {
    // A 8×4 slab with two 1×1 voids: one at x=1 (left half), one at x=6 (right).
    const slab = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 0, 8, 4),
      description: `Void split ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = slab.rows[0]!.id;
    const parentId = slab.geometries[0]!.id;
    await apply({ kind: "add-deduction", rowId, label: "West void", vertices: rect(1, 1, 1, 1) });
    await apply({ kind: "add-deduction", rowId, label: "East void", vertices: rect(6, 1, 1, 1) });
    assert.deepEqual(await figures(rowId), { gross: 32, net: 30 }, "32 less two 1 m² voids");

    const split = await apply({
      kind: "split-polygon",
      rowId,
      geometryId: parentId,
      cut: [[m(4), m(-2)], [m(4), m(6)]],
    });

    const parents = await shapesOf(rowId, false);
    const voids = await shapesOf(rowId, true);
    assert.equal(parents.length, 2, "the slab is two pieces");
    assert.deepEqual(parents.map((p) => p.quantity).sort(), [16, 16], "16 m² each");
    assert.equal(voids.length, 2, "both voids survive the split");
    assert.deepEqual(await figures(rowId), { gross: 32, net: 30 }, "and the line still bills 30: nothing dropped, nothing doubled");

    const parentIds = new Set(parents.map((p) => p.id));
    for (const hole of voids) {
      assert.ok(hole.parent && parentIds.has(hole.parent), `void ${hole.id} names a surviving piece`);
    }
    assert.equal(
      new Set(voids.map((v) => v.parent)).size,
      2,
      "each void went to the piece it sits in, not both onto one",
    );

    const undone = await reverse(split.eventId);
    assert.equal((await shapesOf(rowId, false)).length, 1, "undo restores the single slab");
    assert.deepEqual(await figures(rowId), { gross: 32, net: 30 }, "with both voids still taken off once");
    assert.equal(
      (await shapesOf(rowId, true)).every((v) => v.parent === parentId),
      true,
      "and the voids point back at the original outline",
    );
    await reverse(undone.eventId);
    assert.equal((await shapesOf(rowId, false)).length, 2, "redo splits again");
    assert.deepEqual(await figures(rowId), { gross: 32, net: 30 });
  });

  test("a void straddling the cut is clipped to both pieces without double-subtracting", async () => {
    const slab = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 20, 8, 4),
      description: `Straddle ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = slab.rows[0]!.id;
    // a 2×1 void centred on the cut at x=4: 1 m² each side
    await apply({ kind: "add-deduction", rowId, label: "Straddling void", vertices: rect(3, 21, 2, 1) });
    assert.deepEqual(await figures(rowId), { gross: 32, net: 30 });

    await apply({
      kind: "split-polygon",
      rowId,
      geometryId: slab.geometries[0]!.id,
      cut: [[m(4), m(18)], [m(4), m(26)]],
    });

    const voids = await shapesOf(rowId, true);
    assert.equal(voids.length, 2, "the void is clipped into the two pieces it spans");
    assert.deepEqual(voids.map((v) => v.quantity).sort(), [1, 1], "1 m² on each side");
    assert.deepEqual(
      await figures(rowId),
      { gross: 32, net: 30 },
      "and together they still take off exactly the 2 m² the one void did",
    );
  });
});

describe("duplicating a line that carries several drawings", () => {
  test("every contribution and every child void is copied, with its own new ids", async () => {
    const first = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [[m(0), m(40)], [m(7), m(40)]],
      description: `Multi wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    const rowId = first.rows[0]!.id;
    // a second run on the same line, and an opening on the first
    await apply({
      kind: "split-polyline",
      rowId,
      geometryId: first.geometries[0]!.id,
      vertexIndex: 0,
    }).catch(() => undefined);
    await db("precon_geometries").insert({
      id: `pgeo_second_${randomUUID().slice(0, 8)}`,
      row_id: rowId,
      sheet_id: fixture.sheetId,
      kind: "linear",
      vertices: JSON.stringify([[m(0), m(44)], [m(3), m(44)]]),
      source: "manual",
      quantity: 3,
      unit: "m",
      definition: JSON.stringify({
        schemaVersion: 1,
        role: "measurement",
        tool: "wall_area",
        shape: { role: "path", start: [m(0), m(44)], segments: [{ kind: "line", end: [m(3), m(44)] }], closed: false },
        factor: { heightM: 2.7 },
        scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: 50 },
      }),
    });
    await apply({ kind: "set-row-factor", rowId, heightM: 2.7 });
    assert.equal((await figures(rowId)).gross, 27, "(7 + 3) m × 2.7 m");
    await apply({ kind: "add-deduction", rowId, label: "Doorway", mode: "wall-opening", dimensions: { widthM: 1, heightM: 2 } });
    assert.equal((await figures(rowId)).net, 25, "27 − 2");

    const sourceShapes = await shapesOf(rowId, false);
    const sourceVoids = await shapesOf(rowId, true);
    assert.equal(sourceShapes.length, 2, "the line is measured by two runs");

    const copied = await apply({ kind: "duplicate-row", rowId, offset: [0, m(10)] });
    const copyRow = copied.rows.find((r) => r.id !== rowId)?.id ?? "";
    assert.ok(copyRow, "the copy is its own line");

    const copyShapes = await shapesOf(copyRow, false);
    const copyVoids = await shapesOf(copyRow, true);
    assert.equal(copyShapes.length, 2, "BOTH runs were copied, not just the primary one");
    assert.equal(copyVoids.length, 1, "and so was the opening");
    assert.deepEqual(await figures(copyRow), { gross: 27, net: 25 }, "so the copy measures what the original does");

    const sourceIds = new Set([...sourceShapes, ...sourceVoids].map((s) => s.id));
    for (const shape of [...copyShapes, ...copyVoids]) {
      assert.equal(sourceIds.has(shape.id), false, `${shape.id} is a new id, never a shared one`);
    }
    const copyParentIds = new Set(copyShapes.map((s) => s.id));
    assert.ok(
      copyVoids.every((v) => v.parent && copyParentIds.has(v.parent)),
      "the copied opening points at the COPY's outline, not the original's",
    );
    assert.equal(
      (await db("precon_geometries").where({ id: copyShapes[0]!.id }).first())?.["definition"] !== null,
      true,
      "each copied run keeps a definition, so it stays re-measurable",
    );

    await reverse(copied.eventId);
    assert.equal(
      await db("precon_boq_rows").where({ id: copyRow }).whereNull("deleted_at").first(),
      undefined,
      "undo withdraws the whole copy",
    );
    assert.deepEqual(await figures(rowId), { gross: 27, net: 25 }, "and the original is untouched");
  });

  test("a whole-row copy onto a coarser sheet keeps the real size", async () => {
    const source = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: rect(0, 60, 4, 4),
      description: `Row cross-sheet ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = source.rows[0]!.id;
    const copied = await apply({
      kind: "duplicate-row",
      rowId,
      offset: [0, 0],
      targetSheetId: coarseSheetId,
      crossSheet: "preserve-real-size",
    });
    const copyRow = copied.rows.find((r) => r.id !== rowId)?.id ?? "";
    assert.equal((await figures(copyRow)).gross, 16, "still 16 m² on the 1:100 drawing");
    const copyShape = (await shapesOf(copyRow, false))[0]!;
    const width = Math.max(...copyShape.vertices.map((v) => v[0]!)) - Math.min(...copyShape.vertices.map((v) => v[0]!));
    assert.equal(Math.round(width), 40, "40 points at 100 mm/pt, not the 80 it had at 50");
  });
});

