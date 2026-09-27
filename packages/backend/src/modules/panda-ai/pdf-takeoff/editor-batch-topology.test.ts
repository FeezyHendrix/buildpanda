// Task 10's topology cases, through the operation envelope against real Postgres.
//
// The union of two slabs, a donut and two slabs that do not touch are three
// different answers, and the shipped merge gave the same one to all of them:
// `toRings` flattened outer rings and holes into a list and `unionRing` refused
// anything that was not exactly one ring. So a merge that should have produced a
// parent plus a hole was refused, and a merge that produced two disjoint shapes
// was refused too — with no way to express either on a bill.
//
// Every case below is measured, undone and redone, because a restructure that
// cannot be reversed is not a restructure a QS can risk.

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
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "batch-topology");
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
  assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
  return outcome.reversed ? outcome.receipt.eventId : "";
}

async function gross(rowId: string): Promise<number | null> {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return row?.["qty_gross"] === null || row?.["qty_gross"] === undefined ? null : Number(row["qty_gross"]);
}

async function net(rowId: string): Promise<number | null> {
  const row = await db("precon_boq_rows").where({ id: rowId }).first();
  return row?.["qty"] === null || row?.["qty"] === undefined ? null : Number(row["qty"]);
}

async function liveShapes(rowId: string): Promise<{ id: string; kind: string; vertices: number[][] }[]> {
  return db("precon_geometries")
    .where({ row_id: rowId })
    .whereNull("deleted_at")
    .orderBy("created_at", "asc")
    .select("id", "kind", "vertices");
}

/** A rectangle in metres, placed on the fixture sheet (20 pt = 1 m). */
const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

async function slab(vertices: number[][], label: string): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
    rate: 10,
  });
}

describe("overlapping areas merge into one outline", () => {
  test("two 4×4 slabs offset (2,0) union to 24 m², not 32", async () => {
    const a = await slab(rect(0, 0, 4, 4), "Union A");
    const b = await slab(rect(2, 0, 4, 4), "Union B");
    assert.equal(await gross(a.rows[0]!.id), 16);
    assert.equal(await gross(b.rows[0]!.id), 16);

    const merged = await apply({ kind: "merge-geometries", rowIds: [a.rows[0]!.id, b.rows[0]!.id] });
    assert.equal(await gross(a.rows[0]!.id), 24, "16 + 16 less the 8 m² they share");
    assert.deepEqual(merged.deletedRowIds, [b.rows[0]!.id], "the absorbed line is withdrawn");
    assert.equal(
      await db("precon_boq_rows").where({ id: b.rows[0]!.id }).whereNull("deleted_at").first(),
      undefined,
    );
    assert.ok(await db("precon_boq_rows").where({ id: b.rows[0]!.id }).first(), "withdrawn, never erased");
    assert.equal((await liveShapes(a.rows[0]!.id)).filter((s) => s.kind !== "deduction").length, 1, "one outline");

    const undone = await undo(merged.eventId);
    assert.equal(await gross(a.rows[0]!.id), 16, "undo restores the first slab");
    assert.equal(await gross(b.rows[0]!.id), 16, "and brings the absorbed one back");
    await undo(undone);
    assert.equal(await gross(a.rows[0]!.id), 24, "redo merges again");
  });
});

describe("a merge that encloses a void bills the void as a deduction", () => {
  test("four bars around a 2×2 courtyard net 12 m², not 16", async () => {
    // 4×4 overall with a 2×2 hole from (1,1) to (3,3): 16 − 4 = 12.
    const bars = [rect(0, 0, 4, 1), rect(0, 3, 4, 1), rect(0, 1, 1, 2), rect(3, 1, 1, 2)];
    const rows: string[] = [];
    for (const [i, bar] of bars.entries()) rows.push((await slab(bar, `Donut bar ${i}`)).rows[0]!.id);

    const merged = await apply({ kind: "merge-geometries", rowIds: rows });
    const kept = rows[0]!;

    assert.equal(await gross(kept), 16, "the outer outline encloses 16 m²");
    assert.equal(await net(kept), 12, "and the 2×2 courtyard is taken off, so the line bills 12 m²");

    const shapes = await liveShapes(kept);
    const parents = shapes.filter((s) => s.kind !== "deduction");
    const holes = shapes.filter((s) => s.kind === "deduction");
    assert.equal(parents.length, 1, "one outer outline");
    assert.equal(holes.length, 1, "and the void is an explicit deduction ring, not lost topology");
    const stored = await db("precon_boq_rows").where({ id: kept }).first();
    assert.equal((stored?.["deductions"] as { qty: number }[]).length, 1);
    assert.equal((stored?.["deductions"] as { qty: number }[])[0]?.qty, 4, "the courtyard is 4 m²");
    assert.equal(
      (await db("precon_geometries").where({ id: holes[0]!.id }).first())?.["parent_geometry_id"],
      parents[0]!.id,
      "and it names the outline it is a void in",
    );

    await undo(merged.eventId);
    assert.equal(await gross(kept), 4, "undo puts the first bar back at its own 4 m²");
    assert.equal((await liveShapes(kept)).filter((s) => s.kind === "deduction").length, 0, "the void deduction goes with it");
    for (const rowId of rows.slice(1)) {
      assert.ok(await db("precon_boq_rows").where({ id: rowId }).whereNull("deleted_at").first(), `${rowId} is back`);
    }
  });
});

describe("areas that do not touch stay separate shapes on one line", () => {
  test("a disjoint merge sums both and draws no bridge between them", async () => {
    const a = await slab(rect(0, 20, 4, 4), "Disjoint A");
    const b = await slab(rect(30, 20, 4, 4), "Disjoint B");

    const merged = await apply({ kind: "merge-geometries", rowIds: [a.rows[0]!.id, b.rows[0]!.id] });
    const kept = a.rows[0]!.id;
    assert.equal(await gross(kept), 32, "16 + 16: nothing overlaps, so nothing is netted off");

    const parents = (await liveShapes(kept)).filter((s) => s.kind !== "deduction");
    assert.equal(parents.length, 2, "two separate outlines on the one line, never one bridged shape");
    const xs = parents.flatMap((p) => p.vertices.map((v) => v[0]!));
    // A bridged outline would span the gap; two separate ones cannot.
    for (const shape of parents) {
      const span = Math.max(...shape.vertices.map((v) => v[0]!)) - Math.min(...shape.vertices.map((v) => v[0]!));
      assert.ok(span <= m(4) + 1e-6, `each outline is still 4 m wide, got ${span / 20} m`);
    }
    assert.ok(Math.max(...xs) - Math.min(...xs) > m(30), "and they are still 30 m apart");

    await undo(merged.eventId);
    assert.equal(await gross(kept), 16, "undo restores the first");
    assert.equal(await gross(b.rows[0]!.id), 16, "and the second");
  });
});

describe("a merge carries the absorbed lines' openings with it", () => {
  test("an opening on an absorbed line is kept once, not lost and not doubled", async () => {
    const a = await slab(rect(0, 40, 4, 4), "Carry A");
    const b = await slab(rect(2, 40, 4, 4), "Carry B");
    await apply({
      kind: "add-deduction",
      rowId: b.rows[0]!.id,
      label: "Absorbed hatch",
      vertices: rect(4.5, 41, 1, 1),
    });
    assert.equal(await net(b.rows[0]!.id), 15, "16 − 1");

    const merged = await apply({ kind: "merge-geometries", rowIds: [a.rows[0]!.id, b.rows[0]!.id] });
    const kept = a.rows[0]!.id;
    const deductions = (await db("precon_boq_rows").where({ id: kept }).first())?.["deductions"] as { qty: number; label: string }[];
    assert.equal(deductions.length, 1, "the absorbed line's opening is now on the kept line");
    assert.equal(deductions[0]?.qty, 1);
    assert.equal(await gross(kept), 24);
    assert.equal(await net(kept), 23, "24 − 1: taken off once, not twice and not dropped");

    await undo(merged.eventId);
    assert.equal(await net(b.rows[0]!.id), 15, "undo returns the opening to the line it came from");
    assert.equal(
      ((await db("precon_boq_rows").where({ id: kept }).first())?.["deductions"] as unknown[]).length,
      0,
      "and takes it off the kept line",
    );
  });
});

describe("incompatible merges are still refused", () => {
  test("lines on different sheets or in different units cannot merge", async () => {
    const a = await slab(rect(0, 60, 4, 4), "Refuse A");
    const wall = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [
        [m(0), m(70)],
        [m(4), m(70)],
      ],
      description: `Refuse wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    await assert.rejects(
      apply({ kind: "merge-geometries", rowIds: [a.rows[0]!.id, wall.rows[0]!.id] }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /cannot be merged|only areas merge/i);
        return true;
      },
    );
    assert.equal(await gross(a.rows[0]!.id), 16, "the refusal moved nothing");
    assert.equal(await gross(wall.rows[0]!.id), 10.8, "4 m × 2.7 m");
  });
});
