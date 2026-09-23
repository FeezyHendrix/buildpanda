// The transactional half of the take-off → estimate contract, against real
// Postgres: the replacement and the totals committing or failing together, two
// writers unable to interleave on one estimate, and the repositories refusing
// to write outside a transaction at all.
//
// None of these can be made by a double, so this suite fails rather than skips
// when no database is configured. The preview and drift refusals live next door
// in apply-to-estimate.test.ts.

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import type { Knex } from "knex";
import { ConflictError, ForbiddenError } from "../../../lib/errors.ts";
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
  fixture = await seedApplyFixture(db, "apply-locks");
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

describe("the replacement and the totals commit or fail together", () => {
  test("a failing totals recalculation rolls the replaced items back", async () => {
    const p = await preview();
    await applyFrom(p);
    const before = await estimateItems(db, fixture.estimateId);
    assert.equal(before.length, 2);

    // A constraint that only the totals update can violate. Scoped to this
    // fixture's estimate so the sibling suite's writes are unaffected, and
    // NOT VALID so the row already holding 3090 is left alone while any NEW
    // write of it fails: the replacement succeeds, the recalculation then
    // fails, and the whole apply must unwind.
    await db.raw(
      `ALTER TABLE estimates ADD CONSTRAINT qa_totals_guard CHECK (id <> '${fixture.estimateId}' OR subtotal < 100) NOT VALID`,
    );
    try {
      const again = await preview();
      await assert.rejects(() => applyFrom(again));
      const after = await estimateItems(db, fixture.estimateId);
      assert.deepEqual(
        after.map((r) => r["id"]).sort(),
        before.map((r) => r["id"]).sort(),
        "the original items must still be there, not deleted by a half-applied replacement",
      );
    } finally {
      await db.raw("ALTER TABLE estimates DROP CONSTRAINT qa_totals_guard");
    }
  });
});

describe("two writers cannot interleave on one estimate", () => {
  test("a concurrent send and apply do not both win", async () => {
    const p = await preview();
    const results = await Promise.allSettled([
      applyFrom(p),
      db.transaction(async (trx) => {
        await trx.raw("SELECT id FROM estimates WHERE id = ? FOR UPDATE", [fixture.estimateId]);
        await trx("estimates").where({ id: fixture.estimateId }).update({ status: "Sent" });
      }),
    ]);
    const applied = results[0];
    const status = (await estimateTotals(db, fixture.estimateId))["status"];
    if (applied.status === "fulfilled") {
      assert.equal(status, "Sent", "the send must have landed after the apply, not inside it");
    } else {
      assert.ok(applied.reason instanceof Error);
    }
    const rows = await estimateItems(db, fixture.estimateId);
    assert.ok(rows.length === 0 || rows.length === 2, "never a partially replaced item set");
  });

  test("an apply is refused while the take-off session is held by an editor", async () => {
    const p = await preview();
    await db.transaction(async (trx) => {
      await trx.raw("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE", [fixture.sessionId]);
      await assert.rejects(() => applyFrom(p), ConflictError);
    });
    await assertNothingWritten();
  });
});

describe("the estimate writers that are not the apply path take the lock too", () => {
  test("replaceItems refuses to run outside a transaction", async () => {
    const { estimateItemsRepository } = await import("../../proposals/estimate-items-repository.ts");
    await assert.rejects(
      () => estimateItemsRepository(db).replaceItems(fixture.estimateId, [], []),
      /must run inside a transaction/,
    );
  });

  test("lockEstimate refuses to run outside a transaction", async () => {
    const { estimatesRepository } = await import("../../proposals/estimates-repository.ts");
    await assert.rejects(
      () => estimatesRepository(db).lockEstimate(fixture.estimateId),
      /must run inside a transaction/,
    );
  });

  test("the proposals service saves items under the lock, with totals", async () => {
    const { estimateItemsService } = await import("../../proposals/estimate-items-service.ts");
    const saved = await estimateItemsService(db).saveEstimateItems(
      fixture.estimateId,
      fixture.proposalId,
      fixture.orgId,
      [{ groupLabel: "General", description: "Direct save", qty: 3, unit: "item", unitRate: 100 }],
    );
    assert.equal(saved.length, 1);
    assert.equal(Number((await estimateTotals(db, fixture.estimateId))["subtotal"]), 300);
  });

  test("the proposals service refuses a foreign organisation", async () => {
    const { estimateItemsService } = await import("../../proposals/estimate-items-service.ts");
    await assert.rejects(
      () => estimateItemsService(db).saveEstimateItems(fixture.estimateId, fixture.proposalId, "org_not_mine", []),
      ForbiddenError,
    );
  });
});
