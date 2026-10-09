// Areas overlap, and a merge must measure the overlap once.
//
// Split from `editor-merge-multishape.test.ts` at the house 400-line ceiling.
// That file pins what a merge does with lines carrying SEVERAL drawings; this
// one pins what it does when those drawings overlap, enclose a courtyard, or
// belong to tools that cannot be added together at all.

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

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "merge-union");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
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

const grossOf = async (rowId: string): Promise<number> => Number((await rowOf(rowId))["qty_gross"]);
const netOf = async (rowId: string): Promise<number> => Number((await rowOf(rowId))["qty"]);

const shapesOf = (rowId: string): Promise<{ id: string; kind: string; vertices: number[][] }[]> =>
  db("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at").orderBy("created_at", "asc").select("id", "kind", "vertices");

const drawnOn = async (rowId: string): Promise<{ id: string; kind: string; vertices: number[][] }[]> =>
  (await shapesOf(rowId)).filter((shape) => shape.kind !== "deduction");

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

async function slab(vertices: number[][], label: string): Promise<{ rowId: string; geometryId: string }> {
  const receipt = await apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
    rate: 10,
  });
  const rowId = receipt.rows[0]!.id;
  return { rowId, geometryId: (await drawnOn(rowId))[0]!.id };
}



// The absorb path was allowed to take AREAS when a line carried more than one
// drawing, and absorb sums. So a slab that had been split in two — an ordinary
// thing to do, and the shape the split command leaves behind — merged with an
// overlapping slab billed the strip they share TWICE. The union existed
// precisely to stop that and was skipped on the count of drawings, which has
// nothing to do with whether two outlines overlap.
//
// Areas are unioned whatever the count, and the openings already cut out of
// them come across as themselves: the same records, still pointing at a live
// outline, deducted once.
describe("overlapping areas are measured once however many drawings carry them", () => {
  test("a split slab merged with an overlapping one unions, and keeps both voids", async () => {
    const a = await slab(rect(0, 700, 6, 4), "Overlap A");
    await apply({
      kind: "add-deduction",
      rowId: a.rowId,
      label: "Void in A",
      mode: "area",
      vertices: rect(1, 701, 1, 1),
      sheetId: fixture.sheetId,
    });
    await apply({
      kind: "split-polygon",
      rowId: a.rowId,
      geometryId: a.geometryId,
      cut: [[m(3), m(699)], [m(3), m(705)]],
    });
    assert.equal((await drawnOn(a.rowId)).length, 2, "A is now two drawings, as a split leaves it");
    assert.equal(await grossOf(a.rowId), 24, "still the same 24 m² it always measured");
    assert.equal(await netOf(a.rowId), 23, "less its 1 m² void");

    const b = await slab(rect(4, 700, 4, 4), "Overlap B");
    await apply({
      kind: "add-deduction",
      rowId: b.rowId,
      label: "Void in B",
      mode: "area",
      vertices: rect(6.5, 701, 1, 1),
      sheetId: fixture.sheetId,
    });
    assert.equal(await grossOf(b.rowId), 16);

    const receipt = await apply({ kind: "merge-geometries", rowIds: [a.rowId, b.rowId] });

    assert.equal(
      await grossOf(a.rowId),
      32,
      "24 + 16 less the 8 m² strip they share — NOT the 40 an absorb would bill",
    );
    assert.equal(await netOf(a.rowId), 30, "32 less both voids, each taken off exactly once");
    assert.equal((await drawnOn(a.rowId)).length, 1, "and they make one continuous outline");

    const cuts = (await shapesOf(a.rowId)).filter((shape) => shape.kind === "deduction");
    assert.equal(cuts.length, 2, "both openings are still drawings of their own, still editable");
    const outlineId = (await drawnOn(a.rowId))[0]!.id;
    for (const cut of cuts) {
      const stored = await db("precon_geometries").where({ id: cut.id }).first();
      assert.equal(
        stored?.["parent_geometry_id"],
        outlineId,
        "each names the outline it is now a hole in, rather than a withdrawn one",
      );
    }

    await undo(receipt.eventId);
    assert.equal(await grossOf(a.rowId), 24, "undo puts the split slab back");
    assert.equal(await netOf(a.rowId), 23);
    assert.equal(await grossOf(b.rowId), 16, "and the line it absorbed");
    assert.equal(await netOf(b.rowId), 15);
  });

  test("bars round a courtyard still enclose it, even when one of them was split", async () => {
    const bars = [rect(0, 800, 4, 1), rect(0, 803, 4, 1), rect(0, 801, 1, 2), rect(3, 801, 1, 2)];
    const rows: { rowId: string; geometryId: string }[] = [];
    for (const [i, bar] of bars.entries()) rows.push(await slab(bar, `Donut bar ${i}`));
    await apply({
      kind: "split-polygon",
      rowId: rows[0]!.rowId,
      geometryId: rows[0]!.geometryId,
      cut: [[m(2), m(799)], [m(2), m(802)]],
    });
    assert.equal((await drawnOn(rows[0]!.rowId)).length, 2, "the first bar is two drawings now");

    const kept = rows[0]!.rowId;
    await apply({ kind: "merge-geometries", rowIds: rows.map((r) => r.rowId) });

    assert.equal(await grossOf(kept), 16, "the outer outline encloses 16 m², counted once");
    assert.equal(await netOf(kept), 12, "and the 2×2 courtyard is taken off");
    const shapes = await shapesOf(kept);
    assert.equal(shapes.filter((s) => s.kind !== "deduction").length, 1, "one outer outline");
    assert.equal(shapes.filter((s) => s.kind === "deduction").length, 1, "and the courtyard as an explicit ring");
  });

  test("an area and a wall billed in the same unit are still refused, on the tool", async () => {
    const area = await slab(rect(0, 900, 4, 4), "Same unit area");
    const wall = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [[m(0), m(920)], [m(4), m(920)]],
      description: `Same unit wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    const wallRow = wall.rows[0]!.id;
    assert.equal(
      String((await rowOf(area.rowId))["unit"]),
      String((await rowOf(wallRow))["unit"]),
      "both bill in m², so a unit check alone would let them merge",
    );

    await assert.rejects(
      apply({ kind: "merge-geometries", rowIds: [area.rowId, wallRow] }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /different tool/i, "a footprint and a wall elevation do not add up");
        return true;
      },
    );
    assert.equal(await grossOf(area.rowId), 16, "nothing was joined");
    assert.equal(await grossOf(wallRow), 10.8);
  });
});
