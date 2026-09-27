// Shapes that measure to a plausible number and mean nothing.
//
// A bow-tie — a closed path that crosses itself — has no defensible area:
// shoelace nets its two lobes against each other, so a badly drawn slab returns
// a smaller figure, or zero, and never an error. `validateGeometry` has refused
// it since task 3, and `update-geometry` calls it.
//
// **`create-geometry` did not.** The independent verifier drew a self-crossing
// quadrilateral through the live route and it was accepted 200. So a shape the
// editor would refuse to SAVE could be created in the first place, and the line
// it created carried a quantity nobody can defend.
//
// A run is the opposite case and must stay allowed: a skirting that returns
// along a corridor genuinely crosses itself, and its length is the sum of its
// segments however they lie.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "input-refusals");
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

const rowCount = async (): Promise<number> =>
  Number(
    (
      await db("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: fixture.sessionId }))
        .count<{ count: string }[]>("id as count")
    )[0]!.count,
  );

/** The classic bow-tie: opposite corners swapped, so the two sides cross. */
const BOW_TIE = (y: number): number[][] => [
  [m(0), m(y)],
  [m(4), m(y + 4)],
  [m(4), m(y)],
  [m(0), m(y + 4)],
];

describe("a self-crossing outline is refused before anything is written", () => {
  test("an area drawn as a bow-tie is refused, and no line is created", async () => {
    const before = await rowCount();
    await assert.rejects(
      apply({
        kind: "create-geometry",
        sheetId: fixture.sheetId,
        tool: "area",
        vertices: BOW_TIE(0),
        description: `Bow tie ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /self-intersect/i);
        return true;
      },
    );
    assert.equal(await rowCount(), before, "the refusal created no line to carry the figure");
  });

  test("the same outline declared as a shape is refused too", async () => {
    const before = await rowCount();
    await assert.rejects(
      apply({
        kind: "create-geometry",
        sheetId: fixture.sheetId,
        tool: "area",
        shape: {
          role: "path",
          start: [m(0), m(20)],
          segments: [
            { kind: "line", end: [m(4), m(24)] },
            { kind: "line", end: [m(4), m(20)] },
            { kind: "line", end: [m(0), m(24)] },
          ],
          closed: true,
        },
        description: `Bow tie shape ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /self-intersect/i, "the authoritative shape form is not a way round the check");
        return true;
      },
    );
    assert.equal(await rowCount(), before);
  });

  test("a volume drawn as a bow-tie is refused for the same reason", async () => {
    await assert.rejects(
      apply({
        kind: "create-geometry",
        sheetId: fixture.sheetId,
        tool: "volume",
        vertices: BOW_TIE(40),
        description: `Bow tie pour ${randomUUID().slice(0, 6)}`,
        elementGroup: "Slabs",
        factor: { depthM: 0.15 },
      }),
      BadRequestError,
    );
  });

  test("editing a good outline into a bow-tie is refused, and the figure stands", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: [
        [m(0), m(60)],
        [m(6), m(60)],
        [m(6), m(64)],
        [m(0), m(64)],
      ],
      description: `Good slab ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const geometryId = (await db("precon_geometries").where({ row_id: rowId }).first())!["id"] as string;

    await assert.rejects(
      apply({ kind: "update-geometry", geometryId, vertices: BOW_TIE(60) }),
      BadRequestError,
    );
    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty_gross"]), 24, "the 24 m² it was measured at is still what it bills");
    assert.equal(row?.["version"], 1, "and a refusal did not version it");
  });
});

describe("a run that crosses itself is a run", () => {
  test("a skirting returning along a corridor is measured, not refused", async () => {
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "polyline",
      vertices: BOW_TIE(80),
      description: `Crossing run ${randomUUID().slice(0, 6)}`,
      elementGroup: "Skirting",
    });
    const row = await db("precon_boq_rows").where({ id: created.rows[0]!.id }).first();
    assert.ok(Number(row?.["qty_gross"]) > 0, "it has a real length: the segments are summed however they lie");
  });
});
