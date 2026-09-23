// Merging lines that are NOT one closed slab each.
//
// `merge-geometries` shipped as a polygon union and nothing else: it required
// exactly one `area` shape per line, so it could not touch the two ordinary
// cases beside it —
//
//   * a line measured by SEVERAL drawings (a wall traced as three runs, a slab
//     that gained a second bay). It was refused outright, and the refusal named
//     the shape count, which is not something a QS can act on;
//   * a line measured as a RUN at all. Two lengths of the same skirting on one
//     bill line is the most ordinary merge there is, and the union has no
//     meaning for it.
//
// The union is kept exactly where it earns its keep — one closed area each, so
// two overlapping slabs are measured once rather than twice, which is contract
// 7's double-counting guard and is pinned in editor-batch-topology.test.ts. For
// everything else compatible the merge ABSORBS: every drawing moves onto the
// surviving line under its own id, keeping its arcs, its scale binding and the
// openings cut out of it, and the line is re-added from all of them. Absorbing
// never invents an edge across a gap — two runs 7 m apart bill 7 m of run, not
// 14 m of a wall nobody drew.
//
// The refusal is re-ordered with it. An area and a run were refused on KIND
// ("drawn as linear, not an area"), which is the wrong reason twice over: it
// hid the real one (they bill in different units and cannot become one figure)
// and it refused every compatible run pair as well.

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
  fixture = await seedEditorFixture(db, "merge-multishape");
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

async function run(vertices: number[][], label: string): Promise<{ rowId: string; geometryId: string }> {
  const receipt = await apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "polyline",
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Skirting",
  });
  const rowId = receipt.rows[0]!.id;
  return { rowId, geometryId: (await drawnOn(rowId))[0]!.id };
}

/**
 * A line carrying two drawings, built the way a QS actually gets one: the
 * second bay was billed on its own line and then moved onto this one.
 */
async function twoShapeLine(label: string, at: number): Promise<string> {
  const first = await slab(rect(at, 200, 6, 4), `${label} bay 1`);
  const second = await slab(rect(at, 220, 6, 4), `${label} bay 2`);
  await apply({ kind: "reassign-geometry", geometryId: second.geometryId, targetRowId: first.rowId });
  assert.equal((await drawnOn(first.rowId)).length, 2, "the line is now measured by two drawings");
  assert.equal(await grossOf(first.rowId), 48, "two 24 m² bays");
  return first.rowId;
}

describe("a line measured by several drawings merges whole", () => {
  test("every drawing and every opening comes across, and the sum is exact", async () => {
    const keepId = await twoShapeLine("Multi", 0);
    const other = await slab(rect(20, 200, 4, 4), "Multi absorbed");
    await apply({
      kind: "add-deduction",
      rowId: other.rowId,
      label: "Void",
      mode: "area",
      vertices: rect(21, 201, 1, 1),
      sheetId: fixture.sheetId,
    });
    assert.equal(await grossOf(other.rowId), 16, "one 16 m² slab");
    assert.equal(await netOf(other.rowId), 15, "less its 1 m² void");

    const receipt = await apply({ kind: "merge-geometries", rowIds: [keepId, other.rowId] });
    assert.equal(await grossOf(keepId), 64, "48 + 16, exactly");
    assert.equal(await netOf(keepId), 63, "and the absorbed line's opening came with it, taken off once");
    assert.equal((await drawnOn(keepId)).length, 3, "all three drawings are on the surviving line");
    assert.ok((await rowOf(other.rowId))["deleted_at"], "the absorbed line is withdrawn, never erased");

    await undo(receipt.eventId);
    assert.equal(await grossOf(keepId), 48, "undo restores the line that survived");
    assert.equal(await grossOf(other.rowId), 16, "and the one it absorbed");
    assert.equal(await netOf(other.rowId), 15, "with its own opening back on it");
    assert.equal((await rowOf(other.rowId))["deleted_at"], null);
    assert.equal((await drawnOn(keepId)).length, 2);
  });

  // Identity survival is the ABSORB path's guarantee, and absorb is what runs
  // and tallies take: nothing about them is re-measured, so the drawing that
  // carries the arcs and the scale binding has to be the same record. Areas do
  // not get this and must not — the union produces an outline nobody drew, so
  // keeping the old ids would attach a QS's arc controls to a shape that is no
  // longer theirs.
  test("an absorbed run keeps its own identity, so nothing is redrawn", async () => {
    const a = await run([[0, m(250)], [m(3), m(250)]], "Identity run A");
    const b = await run([[m(10), m(250)], [m(14), m(250)]], "Identity run B");
    const before = (await drawnOn(b.rowId))[0]!;

    await apply({ kind: "merge-geometries", rowIds: [a.rowId, b.rowId] });
    const moved = (await drawnOn(a.rowId)).find((shape) => shape.id === before.id);
    assert.ok(moved, "the absorbed drawing moved under the id it already had");
    assert.deepEqual(moved.vertices, before.vertices, "and its outline was not re-traced by the merge");
  });
});

describe("runs merge without inventing the gap between them", () => {
  test("two 3 m and 4 m runs 7 m apart bill 7 m, as two separate runs", async () => {
    const a = await run([[0, m(300)], [m(3), m(300)]], "Run A");
    const b = await run([[m(10), m(300)], [m(14), m(300)]], "Run B");
    assert.equal(await grossOf(a.rowId), 3);
    assert.equal(await grossOf(b.rowId), 4);

    const receipt = await apply({ kind: "merge-geometries", rowIds: [a.rowId, b.rowId] });
    assert.equal(await grossOf(a.rowId), 7, "3 + 4; the 7 m gap between them is not billed as a bridge");

    const drawn = await drawnOn(a.rowId);
    assert.equal(drawn.length, 2, "kept as two separate runs");
    for (const shape of drawn) {
      const span = Math.max(...shape.vertices.map((v) => v[0]!)) - Math.min(...shape.vertices.map((v) => v[0]!));
      assert.ok(span <= m(4) + 1e-6, `each run is still its own length, got ${span / 20} m`);
    }

    await undo(receipt.eventId);
    assert.equal(await grossOf(a.rowId), 3, "undo returns each run to its own line");
    assert.equal(await grossOf(b.rowId), 4);
  });
});

describe("lines that do not bill in the same unit cannot be merged", () => {
  test("the refusal names the unit, not the shape kind", async () => {
    const area = await slab(rect(0, 400, 4, 4), "Unit area");
    const linear = await run([[0, m(420)], [m(4), m(420)]], "Unit run");

    await assert.rejects(
      apply({ kind: "merge-geometries", rowIds: [area.rowId, linear.rowId] }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /unit/i, "a QS can act on 'different unit'; they cannot act on 'not an area'");
        assert.match(error.message, /m2|m\b/i, "and it says which two units");
        return true;
      },
    );
    assert.equal(await grossOf(area.rowId), 16, "nothing was joined");
    assert.equal(await grossOf(linear.rowId), 4);
  });
});

describe("merging, splitting and merging again moves no figure by itself", () => {
  test("the gross and the net are the exact arithmetic throughout", async () => {
    const a = await slab(rect(0, 500, 4, 4), "Round A");
    const b = await slab(rect(20, 500, 4, 4), "Round B");
    const c = await slab(rect(40, 500, 4, 4), "Round C");
    await apply({
      kind: "add-deduction",
      rowId: a.rowId,
      label: "Riser",
      mode: "area",
      vertices: rect(1, 501, 1, 1),
      sheetId: fixture.sheetId,
    });
    assert.equal(await netOf(a.rowId), 15, "16 − 1");

    const merged = await apply({ kind: "merge-geometries", rowIds: [a.rowId, b.rowId] });
    assert.equal(await grossOf(a.rowId), 32, "16 + 16, nothing overlapping to net off");
    assert.equal(await netOf(a.rowId), 31, "and the riser is still taken off once");

    // A cut across one of the two outlines divides it; it cannot change what the
    // line measures, because the two halves are the same region.
    await apply({
      kind: "split-polygon",
      rowId: a.rowId,
      geometryId: (await drawnOn(a.rowId))[0]!.id,
      cut: [[m(2), m(499)], [m(2), m(505)]],
    });
    assert.equal(await grossOf(a.rowId), 32, "a split re-describes a measurement; it never changes one");
    assert.equal(await netOf(a.rowId), 31);
    assert.equal((await drawnOn(a.rowId)).length, 3, "two outlines became three");

    const again = await apply({ kind: "merge-geometries", rowIds: [a.rowId, c.rowId] });
    assert.equal(await grossOf(a.rowId), 48, "32 + 16 with no drift from the split in between");
    assert.equal(await netOf(a.rowId), 47);
    // Three, not four: the two halves of the cut slab share a whole edge, so the
    // union puts them back as the one outline they always described. The figure
    // is what must not move, and it did not — a merge re-describes a set of
    // measurements, it never changes what they measure.
    assert.equal((await drawnOn(a.rowId)).length, 3, "the three regions that genuinely do not touch");

    await undo(again.eventId);
    assert.equal(await grossOf(a.rowId), 32, "undoing the second merge returns the split line exactly as it was");
    assert.equal(await netOf(a.rowId), 31);
    assert.equal((await drawnOn(a.rowId)).length, 3);
    assert.equal(await grossOf(c.rowId), 16);
    assert.ok(merged.eventId, "the first merge's receipt is still the one that would undo it");
  });
});

describe("copying one drawing puts it on a line of its own", () => {
  test("duplicate-geometry does not add a second drawing to the line it copied from", async () => {
    const source = await slab(rect(0, 600, 6, 4), "Copy source");
    assert.equal(await grossOf(source.rowId), 24);

    const receipt = await apply({
      kind: "duplicate-geometry",
      rowId: source.rowId,
      geometryId: source.geometryId,
      offset: [0, m(20)],
    });

    assert.equal(await grossOf(source.rowId), 24, "the line it was copied FROM is unchanged, which is the contract");
    assert.equal((await drawnOn(source.rowId)).length, 1, "and still carries exactly the one drawing");

    const copyId = receipt.rows.map((r) => r.id).find((id) => id !== source.rowId);
    assert.ok(copyId, "the copy is a line of its own, named in the receipt");
    assert.equal(await grossOf(copyId), 24, "billing the same 24 m² as its own claim");
    assert.equal(String((await rowOf(copyId))["status"]), "needs_review", "a new claim starts unreviewed");
  });
});
