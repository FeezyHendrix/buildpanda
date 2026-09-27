// What the preview promises and what an apply must present to be allowed,
// against real Postgres: the two fingerprints, the expected rows, the exact
// unverified ids, and the refusal of every drift between reading and writing.
//
// A fingerprint noticing a change no version counter would have shown is a
// claim about the database, so this suite fails rather than skips when none is
// configured. The transaction and locking half lives in
// apply-to-estimate-locks.test.ts.

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import {
  dropApplyFixture,
  estimateItems,
  estimateTotals,
  insertRow,
  seedApplyFixture,
  type ApplyFixture,
} from "./apply-to-estimate-fixture.ts";
import { applyToEstimateService } from "./apply-to-estimate-service.ts";
import { connectTestDatabase } from "./editor-db-fixture.ts";
import type { ApplyPreview, ApplyResult, ApplyToEstimateBody } from "./types.ts";

let db: Knex;
let fixture: ApplyFixture;
let service: ReturnType<typeof applyToEstimateService>;

// Derived from the fixture, not fixed strings: the two apply suites run in
// separate processes against the same database, and a shared row id would
// collide on the primary key.
let WALL: string;
let SLAB: string;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedApplyFixture(db, "apply-estimate");
  WALL = `pbr_wall_${fixture.billId}`;
  SLAB = `pbr_slab_${fixture.billId}`;
  service = applyToEstimateService(db);
});

after(async () => {
  if (fixture) await dropApplyFixture(db, fixture);
  await db.destroy();
});

beforeEach(async () => {
  await db("estimate_items").where({ estimate_id: fixture.estimateId }).delete();
  await db("precon_boq_rows").where({ bill_id: fixture.billId }).delete();
  await db("estimates").where({ id: fixture.estimateId }).update({
    status: "Draft",
    contingency_pct: 0,
    tax_pct: 7.5,
    subtotal: 0,
    tax_amount: 0,
    total: 0,
  });
  await insertRow(db, fixture, { id: WALL, description: "Blockwork wall", qty: 18.9, rate: 100, sort: 0 });
  await insertRow(db, fixture, { id: SLAB, description: "Ground slab", qty: 24, rate: 50, sort: 1 });
});

async function preview(): Promise<ApplyPreview> {
  return (await service.run(fixture.sessionId, fixture.orgId, {
    estimateId: fixture.estimateId,
    mode: "preview",
  })) as ApplyPreview;
}

function pinnedFrom(p: ApplyPreview, overrides: Partial<ApplyToEstimateBody> = {}): ApplyToEstimateBody {
  return {
    estimateId: fixture.estimateId,
    mode: "apply",
    sourceFingerprint: p.source.fingerprint,
    targetFingerprint: p.target.fingerprint,
    expectedRows: p.source.expectedRows,
    acknowledgedUnverifiedRowIds: p.review.unverifiedRowIds,
    ...overrides,
  };
}

async function applyFrom(p: ApplyPreview, overrides: Partial<ApplyToEstimateBody> = {}): Promise<ApplyResult> {
  return (await service.run(fixture.sessionId, fixture.orgId, pinnedFrom(p, overrides))) as ApplyResult;
}

async function assertNothingWritten(): Promise<void> {
  assert.equal((await estimateItems(db, fixture.estimateId)).length, 0, "a refused apply must write nothing");
  const totals = await estimateTotals(db, fixture.estimateId);
  assert.equal(Number(totals["total"]), 0, "a refused apply must not move the totals");
}

describe("the preview describes both sides completely", () => {
  test("it returns the source set, the target state and the review state", async () => {
    const p = await preview();
    assert.equal(p.added, 2);
    assert.equal(p.source.sessionId, fixture.sessionId);
    assert.match(p.source.fingerprint, /^[0-9a-f]{64}$/);
    assert.match(p.target.fingerprint, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      p.source.expectedRows.map((r) => r.id),
      [SLAB, WALL].sort(),
    );
    assert.equal(p.target.status, "Draft");
    assert.equal(p.review.verified, 2);
    assert.deepEqual(p.review.unverifiedRowIds, []);
  });

  test("it names the exact unverified lines rather than only counting them", async () => {
    await db("precon_boq_rows").where({ id: WALL }).update({ status: "needs_review" });
    const p = await preview();
    assert.deepEqual(p.review.unverifiedRowIds, [WALL]);
    assert.equal(p.review.needsReview, 1);
    assert.equal(p.review.verified, 1);
  });

  test("it writes nothing", async () => {
    await preview();
    await assertNothingWritten();
  });

  test("the target fingerprint moves when only the totals change, which updatedAt would miss", async () => {
    const before = (await preview()).target.fingerprint;
    await db("estimates").where({ id: fixture.estimateId }).update({ contingency_pct: 10 });
    assert.notEqual((await preview()).target.fingerprint, before);
  });
});

describe("an apply must be pinned to the preview it came from", () => {
  test("an unpinned apply is refused rather than applied to whatever is current", async () => {
    await assert.rejects(
      () => service.run(fixture.sessionId, fixture.orgId, { estimateId: fixture.estimateId, mode: "apply" }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestError);
        assert.match(error.message, /Preview the changes before applying/);
        return true;
      },
    );
    await assertNothingWritten();
  });

  test("a pinned apply writes exactly what was previewed and recalculates the totals", async () => {
    const p = await preview();
    const result = await applyFrom(p);
    assert.equal(result.applied, true);
    assert.equal(result.written, 2);

    const rows = await estimateItems(db, fixture.estimateId);
    assert.equal(rows.length, 2);
    const totals = await estimateTotals(db, fixture.estimateId);
    // 18.9 × 100 + 24 × 50 = 3090; tax 7.5 % = 231.75
    assert.equal(Number(totals["subtotal"]), 3090);
    assert.equal(Number(totals["tax_amount"]), 231.75);
    assert.equal(Number(totals["total"]), 3321.75);
  });
});

describe("drift between preview and apply is refused, and writes nothing", () => {
  test("a re-measured source row", async () => {
    const p = await preview();
    await db("precon_boq_rows").where({ id: WALL }).update({ qty: 25, version: 2 });
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
  });

  test("a new source row added elsewhere in the session", async () => {
    const p = await preview();
    await insertRow(db, fixture, { id: `pbr_new_${fixture.billId}`, description: "Late addition", qty: 5, sort: 2 });
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
    await db("precon_boq_rows").where({ id: `pbr_new_${fixture.billId}` }).delete();
  });

  test("a source row deleted after the preview", async () => {
    const p = await preview();
    await db("precon_boq_rows").where({ id: SLAB }).delete();
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
  });

  test("a rate typed on the estimate after the preview", async () => {
    const p = await preview();
    await db("estimate_items").insert({
      id: `item_manual_${fixture.billId}`,
      estimate_id: fixture.estimateId,
      group_label: "General",
      description: "Hand-entered line",
      qty: 1,
      unit: "item",
      unit_rate: 500,
      total: 500,
      sort: 9,
    });
    await assert.rejects(() => applyFrom(p), ConflictError);
    const rows = await estimateItems(db, fixture.estimateId);
    assert.deepEqual(
      rows.map((r) => r["id"]),
      [`item_manual_${fixture.billId}`],
      "the refusal must leave the hand-entered line untouched",
    );
  });

  test("estimate meta changed after the preview", async () => {
    const p = await preview();
    await db("estimates").where({ id: fixture.estimateId }).update({ tax_pct: 10 });
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
  });

  test("a review status that changed after the preview", async () => {
    const p = await preview();
    await db("precon_boq_rows").where({ id: WALL }).update({ status: "needs_review" });
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
  });

  test("the refusal names what moved and carries refreshed state", async () => {
    const p = await preview();
    await db("estimates").where({ id: fixture.estimateId }).update({ tax_pct: 10 });
    await assert.rejects(
      () => applyFrom(p),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        const details = error.details as { reasons: string[]; target: { fingerprint: string } };
        assert.ok(details.reasons.some((r) => /estimate has changed/.test(r)));
        assert.notEqual(details.target.fingerprint, p.target.fingerprint);
        return true;
      },
    );
  });
});

describe("unverified quantities need an acknowledgement that matches exactly", () => {
  beforeEach(async () => {
    await db("precon_boq_rows").where({ id: WALL }).update({ status: "needs_review" });
  });

  test("an apply that acknowledges nothing is refused", async () => {
    const p = await preview();
    await assert.rejects(() => applyFrom(p, { acknowledgedUnverifiedRowIds: [] }), ConflictError);
    await assertNothingWritten();
  });

  test("an apply that acknowledges the wrong line is refused", async () => {
    const p = await preview();
    await assert.rejects(() => applyFrom(p, { acknowledgedUnverifiedRowIds: [SLAB] }), ConflictError);
    await assertNothingWritten();
  });

  test("an apply that acknowledges exactly the listed lines is accepted", async () => {
    const p = await preview();
    assert.deepEqual(p.review.unverifiedRowIds, [WALL]);
    const result = await applyFrom(p);
    assert.equal(result.written, 2);
  });

  test("an acknowledgement is not carried over once the line is verified", async () => {
    const p = await preview();
    await db("precon_boq_rows").where({ id: WALL }).update({ status: "verified" });
    await assert.rejects(() => applyFrom(p), ConflictError);
    await assertNothingWritten();
  });
});

describe("the estimate's own rules still hold", () => {
  test("an accepted estimate is never overwritten", async () => {
    const p = await preview();
    await db("estimates").where({ id: fixture.estimateId }).update({ status: "Accepted" });
    await assert.rejects(() => applyFrom(p), BadRequestError);
    await assertNothingWritten();
  });

  test("a sent estimate is never overwritten", async () => {
    const p = await preview();
    await db("estimates").where({ id: fixture.estimateId }).update({ status: "Sent" });
    await assert.rejects(() => applyFrom(p), BadRequestError);
    await assertNothingWritten();
  });

  test("another organisation cannot preview or apply", async () => {
    await assert.rejects(
      () => service.run(fixture.sessionId, "org_not_mine", { estimateId: fixture.estimateId, mode: "preview" }),
      NotFoundError,
    );
  });

  test("an estimate on another proposal is not found", async () => {
    await assert.rejects(
      () => service.run(fixture.sessionId, fixture.orgId, { estimateId: "est_elsewhere", mode: "preview" }),
      NotFoundError,
    );
  });
});

describe("items belonging to other take-offs and to nobody are preserved", () => {
  test("a hand-entered line and another session's line survive the replacement", async () => {
    await db("estimate_items").insert([
      {
        id: `item_hand_${fixture.billId}`,
        estimate_id: fixture.estimateId,
        group_label: "General",
        description: "Hand-entered",
        qty: 2,
        unit: "item",
        unit_rate: 250,
        total: 500,
        sort: 8,
      },
      {
        id: `item_other_${fixture.billId}`,
        estimate_id: fixture.estimateId,
        group_label: "General",
        description: "From another take-off",
        qty: 1,
        unit: "item",
        unit_rate: 300,
        total: 300,
        boq_item_id: "pbr_other_session",
        takeoff_session_id: "pcs_someone_else",
        sort: 9,
      },
    ]);
    const p = await preview();
    const result = await applyFrom(p);
    const rows = await estimateItems(db, fixture.estimateId);
    const descriptions = rows.map((r) => r["description"]);
    assert.ok(descriptions.includes("Hand-entered"), "a hand-entered line must survive");
    assert.ok(descriptions.includes("From another take-off"), "another session's line must survive");
    assert.equal(result.written, 4);
  });

  test("a rate already entered on the estimate is kept over a zero take-off rate", async () => {
    await db("precon_boq_rows").where({ id: WALL }).update({ rate: 0, amount: 0 });
    const first = await preview();
    await applyFrom(first);
    await db("estimate_items").where({ boq_item_id: WALL }).update({ unit_rate: 175, total: 18.9 * 175 });

    const second = await preview();
    await applyFrom(second);
    const kept = await db("estimate_items").where({ boq_item_id: WALL }).first("unit_rate");
    assert.equal(Number(kept?.["unit_rate"]), 175, "re-applying must not wipe an estimator's rate");
  });
});
