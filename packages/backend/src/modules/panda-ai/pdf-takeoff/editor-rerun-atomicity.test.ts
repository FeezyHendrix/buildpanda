// What a re-run of the automated take-off is allowed to destroy, and how many
// times it may land.
//
// The detector is INJECTED, not called: `fillDwgSession` takes the reading as an
// argument, so these run against a real database with a handover written here
// and no provider, no network and no PDF. That is deliberate — the claims are
// about the WRITE, and a suite that needed a model to make them could not make
// them repeatably.
//
// Four defects this pins, each of which silently destroyed a person's work or
// silently doubled the bill:
//
//   * the prune, the register rewrite and the insert ran as separate statements
//     against the pool, so a failure between them left a take-off with its old
//     lines gone and its new ones missing;
//   * nothing rejected a result computed for a SUPERSEDED request, so correcting
//     the layer map twice and having the slower first job land last overwrote
//     the corrected reading with the one it replaced;
//   * nothing rejected a result that had already landed, so a redelivered job
//     inserted the same drafted lines a second time;
//   * replaceability was judged from the line's own columns, so an opening cut
//     by hand out of a drafted wall went with the wall, and a redline pinned to
//     a figure was unhooked from the figure it questioned.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { ConflictError } from "../../../lib/errors.ts";
import { connectTestDatabase, dropEditorFixture, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { preconRepository } from "./repository.ts";
import { beginRerun, currentGeneration } from "./rerun-apply.ts";
import { preconService } from "./service.ts";
import type { DwgTakeoffHandover, PreconBoqRowRow } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const noop = (): void => {};
const service = () => preconService(preconRepository(db), noop);

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "rerun");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

/** A fixed reading: the same drawing register and the same two lines, every time. */
function handover(tag: string): DwgTakeoffHandover {
  return {
    units: { unit: "mm", scaleToMm: 50, errorPct: 0, note: `deterministic ${tag}` },
    layerMap: { "A-WALL": "wall" },
    sheets: [
      {
        id: 1,
        code: "QA-01",
        title: "QA plan",
        kind: "floor-plan",
        bounds: { minX: 0, minY: 0, maxX: 760, maxY: 560 },
        levelMm: null,
        multiplier: 1,
      },
    ],
    items: [
      {
        trade: "concrete",
        description: `Drafted slab ${tag}`,
        quantity: 24,
        unit: "m2",
        confidence: "high",
        basis: "model space",
        sheetId: 1,
      },
      {
        trade: "concrete",
        description: `Drafted wall ${tag}`,
        quantity: 10,
        unit: "m2",
        confidence: "high",
        basis: "model space",
        sheetId: 1,
      },
    ],
    notes: [],
  };
}

type RowSeed = Partial<Omit<PreconBoqRowRow, "created_at" | "updated_at">> & { description: string };

async function seedRow(seed: RowSeed): Promise<string> {
  const id = `pbr_${randomUUID()}`;
  await db("precon_boq_rows").insert({
    id,
    bill_id: fixture.billId,
    sort: Math.floor(Math.random() * 100_000),
    row_type: "item",
    element_group: "Concrete",
    description: seed.description,
    unit: "m2",
    qty_gross: 10,
    deductions: JSON.stringify([]),
    qty: 10,
    version: 1,
    origin: seed.origin ?? "ai",
    status: seed.status ?? "ai_generated",
    edited_at: seed.edited_at ?? null,
    edited_by: seed.edited_by ?? null,
    verified_by: seed.verified_by ?? null,
    verified_at: seed.verified_at ?? null,
    deleted_at: seed.deleted_at ?? null,
  });
  return id;
}

async function seedShape(rowId: string, source: "ai" | "manual", kind = "area"): Promise<string> {
  const id = `pgeo_${randomUUID()}`;
  await db("precon_geometries").insert({
    id,
    row_id: rowId,
    sheet_id: fixture.sheetId,
    kind,
    vertices: JSON.stringify([[0, 0], [20, 0], [20, 20], [0, 20]]),
    source,
    quantity: 1,
    unit: "m2",
  });
  return id;
}

const alive = async (rowId: string): Promise<boolean> =>
  Boolean(await db("precon_boq_rows").where({ id: rowId }).whereNull("deleted_at").first());

const onRecord = async (rowId: string): Promise<boolean> =>
  Boolean(await db("precon_boq_rows").where({ id: rowId }).first());

const draftedCount = async (): Promise<number> => {
  const rows = await db("precon_boq_rows")
    .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: fixture.sessionId }))
    .andWhere("description", "like", "Drafted %")
    .count<{ count: string }[]>("id as count");
  return Number(rows[0]?.count ?? 0);
};

describe("a re-run replaces its own untouched drafts and nothing else", () => {
  test("edits, sign-offs, tombstones, hand-cut openings and pinned redlines all survive", async () => {
    const untouched = await seedRow({ description: "AI untouched" });
    const edited = await seedRow({
      description: "AI corrected by a QS",
      status: "needs_review",
      edited_at: new Date(),
      edited_by: fixture.actor,
    });
    const verified = await seedRow({
      description: "Signed off",
      status: "verified",
      verified_by: fixture.actor,
      verified_at: new Date(),
    });
    const byHand = await seedRow({ description: "Measured by hand", origin: "manual", status: "needs_review" });
    const withdrawn = await seedRow({ description: "Withdrawn in a dispute", deleted_at: new Date() });

    // An opening cut by hand out of a wall the engine drafted. The wall is
    // still `ai_generated`; the opening is a person's measurement.
    const hostingOpening = await seedRow({ description: "AI wall with a hand-cut door" });
    const wall = await seedShape(hostingOpening, "ai", "linear");
    const opening = `pgeo_${randomUUID()}`;
    await db("precon_geometries").insert({
      id: opening,
      row_id: hostingOpening,
      sheet_id: fixture.sheetId,
      kind: "deduction",
      vertices: JSON.stringify([[0, 0], [5, 0], [5, 5], [0, 5]]),
      source: "manual",
      quantity: 1.89,
      unit: "m2",
      parent_geometry_id: wall,
    });

    // A redline raised against a figure that looked wrong.
    const questioned = await seedRow({ description: "AI line somebody questioned" });
    const pin = `mk_${randomUUID()}`;
    await db("drawing_markups").insert({
      id: pin,
      precon_session_id: fixture.sessionId,
      precon_sheet_id: fixture.sheetId,
      precon_row_id: questioned,
      kind: "pin",
      geometry: JSON.stringify({ kind: "pin", at: { x: 10, y: 20 }, space: "points" }),
      color: "#004DE7",
      version: 1,
    });

    await service().fillDwgSession(fixture.sessionId, { fileName: "rerun.pdf" }, handover("first"));

    assert.equal(await onRecord(untouched), false, "the engine's own untouched draft is replaced");
    assert.equal(await alive(edited), true, "a line a QS corrected is not the engine's to take back");
    assert.equal(await alive(verified), true, "a signed-off line survives");
    assert.equal(await alive(byHand), true, "a hand-entered line survives");
    assert.equal(await onRecord(withdrawn), true, "a tombstone survives, or the next draft reintroduces it");
    assert.equal(await alive(hostingOpening), true, "the wall stays, because somebody cut an opening out of it");
    assert.ok(
      await db("precon_geometries").where({ id: opening }).first(),
      "and the opening itself is still there to be re-measured",
    );
    assert.equal(await alive(questioned), true, "the line a redline questions stays");
    assert.equal(
      (await db("drawing_markups").where({ id: pin }).first())?.["precon_row_id"],
      questioned,
      "so the question is still attached to the figure it was about",
    );
    assert.equal(await draftedCount(), 2, "and the new reading landed");
  });
});

describe("a re-run lands once", () => {
  test("a redelivered result is refused, and inserts nothing a second time", async () => {
    const token = await beginRerun(db, fixture.sessionId);
    await service().fillDwgSession(fixture.sessionId, { fileName: "rerun.pdf" }, handover("once"), { token });
    const afterFirst = await draftedCount();

    await assert.rejects(
      service().fillDwgSession(fixture.sessionId, { fileName: "rerun.pdf" }, handover("once"), { token }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.match(error.message, /superseded|nothing was changed/i);
        return true;
      },
      "the same result cannot land twice",
    );
    assert.equal(await draftedCount(), afterFirst, "and the redelivery inserted nothing");
  });

  test("a result computed before a newer request is refused in favour of it", async () => {
    const stale = await beginRerun(db, fixture.sessionId);
    const current = await beginRerun(db, fixture.sessionId);
    assert.ok(current.generation > stale.generation, "the second request claims a later re-run");

    await assert.rejects(
      service().fillDwgSession(fixture.sessionId, { fileName: "rerun.pdf" }, handover("stale"), { token: stale }),
      ConflictError,
      "the slower first job may not overwrite the correction that superseded it",
    );
    assert.equal(
      await db("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: fixture.sessionId }))
        .andWhere("description", "like", "%stale")
        .first(),
      undefined,
      "nothing from the superseded reading was written",
    );

    await service().fillDwgSession(fixture.sessionId, { fileName: "rerun.pdf" }, handover("current"), { token: current });
    assert.ok(
      await db("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: fixture.sessionId }))
        .andWhere("description", "like", "%current")
        .first(),
      "and the current one lands",
    );
  });
});

describe("the whole apply is one unit of work", () => {
  test("a failure part-way through leaves the take-off exactly as it was", async () => {
    const standing = await seedRow({ description: "Standing before the failed re-run" });
    const repo = preconRepository(db);
    const token = await beginRerun(db, fixture.sessionId);
    const generationBefore = await currentGeneration(db, fixture.sessionId);

    await assert.rejects(
      repo.applyRerun(token, async (trx) => {
        await preconRepository(trx).deleteRows([standing]);
        throw new Error("the engine's insert failed half-way");
      }),
      /half-way/,
    );

    assert.equal(await alive(standing), true, "the prune rolled back with the insert that failed");
    assert.equal(
      await currentGeneration(db, fixture.sessionId),
      generationBefore,
      "and the re-run was not marked as having landed, so it can be retried",
    );
  });

  test("the session is locked for the whole apply, so an editor cannot interleave with it", async () => {
    const repo = preconRepository(db);
    const token = await beginRerun(db, fixture.sessionId);
    let contended: unknown = null;

    await repo.applyRerun(token, async () => {
      // A second connection asking for the same session without waiting is the
      // cheapest possible proof that this one is holding the lock.
      await db
        .transaction(async (other) => {
          await other.raw("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE NOWAIT", [fixture.sessionId]);
        })
        .catch((error: unknown) => {
          contended = error;
        });
    });

    assert.ok(contended, "the re-run held the session lock for the whole of its write");
  });
});

describe("the drawing register keeps its identity across re-runs", () => {
  test("a drawing that still carries evidence keeps the id bookmarks and exports name it by", async () => {
    const keeping = await seedRow({ description: "Hand-measured on the register sheet", origin: "manual" });
    await seedShape(keeping, "manual");
    const sheetBefore = await db("precon_sheets")
      .where({ session_id: fixture.sessionId, file_name: "register.dwg", page_number: 1 })
      .first();
    assert.equal(sheetBefore, undefined, "the register drawing does not exist yet");

    const first = await beginRerun(db, fixture.sessionId);
    await service().fillDwgSession(fixture.sessionId, { fileName: "register.dwg" }, handover("reg1"), { token: first });
    const minted = await db("precon_sheets")
      .where({ session_id: fixture.sessionId, file_name: "register.dwg", page_number: 1 })
      .first();
    assert.ok(minted, "the first re-run mints it");

    const second = await beginRerun(db, fixture.sessionId);
    await service().fillDwgSession(fixture.sessionId, { fileName: "register.dwg" }, handover("reg2"), { token: second });
    const again = await db("precon_sheets")
      .where({ session_id: fixture.sessionId, file_name: "register.dwg", page_number: 1 })
      .first();

    assert.equal(again?.["id"], minted["id"], "the second re-run re-uses it rather than minting a new one");
    assert.equal(await alive(keeping), true, "and the line standing on it is untouched");
  });
});
