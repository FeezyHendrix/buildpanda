// A curve that stays a curve, and a selection that saves as one act.
//
// The analytic arc engine has existed since task 3 and no command could reach
// it. `create/update-geometry` took `vertices` only, so a bay window drawn as
// an arc arrived as a densified polyline: the midpoint that DEFINES the curve
// was gone, every reload re-measured the chords, and a QS billing a radiused
// kerb was short by 4.7 % on a quarter circle and 36 % on a half one.
//
// And a multi-shape move was N separate operations. N receipts, N history
// entries, N chances for step 4 to fail after steps 1-3 committed — the client
// papering over a missing envelope by looping.
//
// So: the logical shape is what a command declares and what the server stores,
// the renderer's vertices are DERIVED from it, and the analytic engine measures
// it every time it is read back. One envelope carries a list of commands into
// one transaction, one snapshot and one receipt.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
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

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "shapes");
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

const rowOf = async (id: string) => db("precon_boq_rows").where({ id }).first();
const geometryOf = async (id: string) => db("precon_geometries").where({ id }).first();
const qtyOf = async (id: string): Promise<number> => Number((await rowOf(id))?.["qty_gross"]);

/** A semicircle of radius 1 m, as a logical arc: length π m, not the 2 m chord. */
const semicircle = (cx: number, cy: number) => ({
  role: "path" as const,
  start: [m(cx - 1), m(cy)] as [number, number],
  segments: [{ kind: "arc" as const, mid: [m(cx), m(cy + 1)] as [number, number], end: [m(cx + 1), m(cy)] as [number, number] }],
  closed: false,
});

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

const create = (sheetId: string, tool: string, extra: Record<string, unknown>) =>
  apply({
    kind: "create-geometry",
    sheetId,
    tool,
    description: `${tool} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Shapes",
    ...extra,
  } as EditorCommand);

describe("a saved arc is stored as an arc and measured as one", () => {
  test("creating from a logical shape keeps the controls and bills the arc length", async () => {
    const made = await create(fixture.sheetId, "polyline", { shape: semicircle(4, 0) });
    const rowId = made.rows[0]!.id;
    const geometryId = made.geometries[0]!.id;

    assert.equal(await qtyOf(rowId), 3.14, "π m, not the 2 m chord");

    const stored = await geometryOf(geometryId);
    const shape = stored?.["definition"]?.["shape"];
    assert.equal(shape?.["role"], "path");
    assert.equal(shape?.["segments"]?.[0]?.["kind"], "arc", "the curve is recorded AS a curve");
    assert.ok(shape?.["segments"]?.[0]?.["mid"], "and its midpoint — the control that defines it — survives");
    assert.ok(
      (stored?.["vertices"] as number[][]).length > 4,
      "the renderer still gets a tessellation, derived by the server",
    );

    // Reading it back must re-measure the ARC, not the chords it was drawn with.
    await apply({ kind: "set-row-typical", rowId, typical: 1 });
    assert.equal(await qtyOf(rowId), 3.14, "a recompute re-reads the logical arc, not its tessellation");
  });

  test("an arc area bills its bulge, and a straight-to-arc edit is one act that undoes", async () => {
    const straight = await create(fixture.sheetId, "area", { vertices: rect(0, 20, 4, 4) });
    const rowId = straight.rows[0]!.id;
    const geometryId = straight.geometries[0]!.id;
    assert.equal(await qtyOf(rowId), 16, "4 m x 4 m while every side is straight");

    // Bulge the top side out through a midpoint 1 m above it: the extra area is
    // the circular segment, which shoelace over the tessellation cannot see.
    const receipt = await apply({
      kind: "update-geometry",
      geometryId,
      shape: {
        role: "path",
        start: [m(0), m(20)],
        segments: [
          { kind: "line", end: [m(4), m(20)] },
          { kind: "line", end: [m(4), m(24)] },
          { kind: "arc", mid: [m(2), m(25)], end: [m(0), m(24)] },
        ],
        closed: true,
      },
    });
    const bulged = await qtyOf(rowId);
    assert.ok(bulged > 16.5, `the bulge is billed (got ${bulged})`);
    assert.equal(
      (await geometryOf(geometryId))?.["definition"]?.["shape"]?.["segments"]?.[2]?.["kind"],
      "arc",
      "and the curve is stored as a curve",
    );

    await undo(receipt.eventId);
    assert.equal(await qtyOf(rowId), 16, "undo restores the straight outline");
    assert.equal(
      (await geometryOf(geometryId))?.["definition"]?.["shape"]?.["segments"]?.[2]?.["kind"],
      "line",
      "controls and all",
    );
  });

  test("vertices alone still mean a straight path, and cannot contradict a declared shape", async () => {
    const plain = await create(fixture.sheetId, "polyline", { vertices: [[0, m(40)], [m(3), m(40)], [m(3), m(44)]] });
    assert.equal(await qtyOf(plain.rows[0]!.id), 7, "the shipped vertices-only contract is unchanged: 3 + 4 m");
    assert.equal(
      (await geometryOf(plain.geometries[0]!.id))?.["definition"]?.["shape"]?.["segments"]?.[0]?.["kind"],
      "line",
      "recorded as the straight path it is",
    );

    await assert.rejects(
      create(fixture.sheetId, "polyline", {
        shape: semicircle(4, 60),
        vertices: [[0, m(60)], [m(8), m(60)]],
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /disagree|both|shape/i, "two different declarations is never resolved by guessing");
        return true;
      },
    );
  });

  test("a malformed shape is refused rather than normalised into a plausible figure", async () => {
    for (const [why, shape] of [
      ["no segments at all", { role: "path", start: [0, 0], segments: [], closed: false }],
      ["a non-finite control", { role: "path", start: [0, 0], segments: [{ kind: "arc", mid: [Number.NaN, 0], end: [m(1), 0] }], closed: false }],
      ["a zero-length side", { role: "path", start: [0, 0], segments: [{ kind: "line", end: [0, 0] }], closed: false }],
    ] as const) {
      await assert.rejects(
        create(fixture.sheetId, "polyline", { shape }),
        BadRequestError,
        `refused: ${why}`,
      );
    }
  });
});

describe("one envelope, one receipt, one undo", () => {
  test("a multi-shape move commits as a single operation and reverses as one", async () => {
    const a = await create(fixture.sheetId, "area", { vertices: rect(0, 80, 4, 4) });
    const b = await create(fixture.sheetId, "area", { vertices: rect(10, 80, 6, 4) });
    const [rowA, rowB] = [a.rows[0]!.id, b.rows[0]!.id];
    const before = [await qtyOf(rowA), await qtyOf(rowB)];

    const receipt = await apply({
      kind: "batch",
      commands: [
        { kind: "transform-geometry", rowId: rowA, geometryId: a.geometries[0]!.id, translate: [m(1), 0] },
        { kind: "transform-geometry", rowId: rowB, geometryId: b.geometries[0]!.id, translate: [m(1), 0] },
      ],
    });
    assert.ok(receipt.eventId, "ONE receipt");
    assert.equal(
      (await db("precon_audit_events").where({ operation_id: receipt.operationId })).length,
      1,
      "and exactly one audit event for the whole batch",
    );
    assert.equal((await geometryOf(a.geometries[0]!.id))?.["vertices"]?.[0]?.[0], m(1), "shape A moved");
    assert.equal((await geometryOf(b.geometries[0]!.id))?.["vertices"]?.[0]?.[0], m(11), "shape B moved");
    assert.deepEqual([await qtyOf(rowA), await qtyOf(rowB)], before, "a move restates no figure");

    await undo(receipt.eventId);
    assert.equal((await geometryOf(a.geometries[0]!.id))?.["vertices"]?.[0]?.[0], 0, "one undo puts BOTH back");
    assert.equal((await geometryOf(b.geometries[0]!.id))?.["vertices"]?.[0]?.[0], m(10));
  });

  test("one stale member means none of the batch is written", async () => {
    const a = await create(fixture.sheetId, "area", { vertices: rect(0, 100, 4, 4) });
    const b = await create(fixture.sheetId, "area", { vertices: rect(10, 100, 4, 4) });
    const beforeA = (await geometryOf(a.geometries[0]!.id))?.["vertices"];

    await assert.rejects(
      apply({
        kind: "batch",
        commands: [
          { kind: "transform-geometry", rowId: a.rows[0]!.id, geometryId: a.geometries[0]!.id, translate: [m(1), 0] },
          { kind: "transform-geometry", rowId: b.rows[0]!.id, geometryId: "pgeo_does_not_exist", translate: [m(1), 0] },
        ],
      }),
      (error: unknown) => {
        assert.ok(error !== null);
        return true;
      },
    );
    assert.deepEqual(
      (await geometryOf(a.geometries[0]!.id))?.["vertices"],
      beforeA,
      "the member that WOULD have worked did not land either",
    );
  });

  test("a batch cannot nest, and cannot be empty", async () => {
    await assert.rejects(
      apply({ kind: "batch", commands: [{ kind: "batch", commands: [] } as never] }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /nest/i);
        return true;
      },
    );
    await assert.rejects(apply({ kind: "batch", commands: [] }), BadRequestError);
  });
});

describe("rebinding a shape that records the wrong region", () => {
  test("it is explicit, recomputes the whole line, and shows the figure move", async () => {
    const detailSheet = `pcsh_rb_${randomUUID().slice(0, 8)}`;
    await db("precon_sheets").insert({
      id: detailSheet,
      session_id: fixture.sessionId,
      file_name: "rebind.pdf",
      storage_path: `qa/${detailSheet}.pdf`,
      page_number: 70,
      code: "RB-01",
      kind: "floor-plan",
      status: "measured",
      scale_mm_per_pt: 50,
      dim_unit: "mm",
      version: 1,
      viewports: JSON.stringify([{ id: "vp_rb", label: "Detail", rect: [m(0), m(0), m(20), m(20)], scaleMmPerPt: 25 }]),
    });
    // Drawn against the SHEET scale by an explicit choice, though it sits in the region.
    const made = await create(detailSheet, "area", {
      vertices: rect(1, 1, 4, 4),
      scaleChoice: { source: "sheet" },
    });
    const rowId = made.rows[0]!.id;
    const geometryId = made.geometries[0]!.id;
    assert.equal(await qtyOf(rowId), 16, "16 m² at the sheet's 50 mm/pt");
    await apply({ kind: "add-deduction", rowId, label: "Void", vertices: rect(2, 2, 1, 1), sheetId: detailSheet });
    assert.equal(Number((await rowOf(rowId))?.["qty"]), 15, "less a 1 m² void");

    const receipt = await apply({
      kind: "rebind-geometry",
      geometryId,
      scaleChoice: { source: "viewport", viewportId: "vp_rb" },
    });
    assert.equal(
      (await geometryOf(geometryId))?.["definition"]?.["scale"]?.["viewportId"],
      "vp_rb",
      "the binding is what it now records",
    );
    assert.equal(await qtyOf(rowId), 4, "re-measured at the region's 25 mm/pt: a quarter of the area");
    assert.equal(Number((await rowOf(rowId))?.["qty"]), 3.75, "and its void was re-cut at the same scale");
    assert.equal((await rowOf(rowId))?.["status"], "needs_review", "a figure that moved goes back for review");

    await undo(receipt.eventId);
    assert.equal(await qtyOf(rowId), 16, "undo restores the figure");
    assert.equal(
      (await geometryOf(geometryId))?.["definition"]?.["scale"]?.["source"],
      "sheet",
      "and the binding it was measured against",
    );
  });

  test("a batch transform leaves every binding exactly as it found it", async () => {
    const sheetId = fixture.sheetId;
    const made = await create(sheetId, "area", { vertices: rect(0, 120, 4, 4) });
    const bindingBefore = (await geometryOf(made.geometries[0]!.id))?.["definition"]?.["scale"];
    await apply({
      kind: "batch",
      commands: [
        { kind: "transform-geometry", rowId: made.rows[0]!.id, geometryId: made.geometries[0]!.id, translate: [m(2), 0] },
      ],
    });
    assert.deepEqual(
      (await geometryOf(made.geometries[0]!.id))?.["definition"]?.["scale"],
      bindingBefore,
      "moving a shape is not a rebind",
    );
  });

  test("a stale version pins a rebind like any other write", async () => {
    const made = await create(fixture.sheetId, "area", { vertices: rect(0, 140, 4, 4) });
    await assert.rejects(
      editorOperationService(db, noop).apply(
        fixture.sessionId,
        {
          operationId: `op_${randomUUID()}`,
          expectedRows: [{ id: made.rows[0]!.id, version: 99 }],
          command: { kind: "rebind-geometry", geometryId: made.geometries[0]!.id, scaleChoice: { source: "sheet" } },
        },
        fixture.actor,
        GRANTS,
      ),
      ConflictError,
    );
  });
});
