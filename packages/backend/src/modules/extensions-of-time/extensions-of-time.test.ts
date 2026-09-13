import { test } from "node:test";
import assert from "node:assert/strict";
import { isAppError } from "../../lib/errors.ts";
import { eotService } from "./service.ts";
import type { ClaimableDelayRow, EotRepository } from "./repository.ts";
import type { EotClaimPatch, EotClaimRow } from "./types.ts";

function claimRow(over: Partial<EotClaimRow> = {}): EotClaimRow {
  return {
    id: "eot_1",
    project_id: "prj_1",
    number: 1,
    title: "Late TMP approval and NNPC main diversion",
    days_claimed: 14,
    days_awarded: null,
    applied_days: 0,
    status: "Draft",
    reason: null,
    delay_ids: [],
    change_request_id: null,
    decided_by_id: null,
    decided_at: null,
    submitted_at: null,
    notes: null,
    created_by_id: "usr_1",
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
    ...over,
  };
}

function delay(over: Partial<ClaimableDelayRow> = {}): ClaimableDelayRow {
  return {
    id: "delay_client",
    activity_id: "act_1",
    activity_name: "TMP approval & signage",
    reason_code: "APPROVAL_CLIENT",
    days_lost: 7,
    culpability: "client",
    eot_claimable: true,
    started_at: "2026-09-18T08:00:00.000Z",
    ...over,
  };
}

function build(rows: EotClaimRow[], delays: ClaimableDelayRow[] = []) {
  const awards: number[] = [];
  const repository = {
    listByProject: async () => rows,
    findById: async (id: string) => rows.find((r) => r.id === id),
    nextNumber: async () => rows.length + 1,
    insert: async (record: Record<string, unknown>) => {
      const created = claimRow(record as Partial<EotClaimRow>);
      rows.push(created);
      return created;
    },
    update: async (id: string, patch: EotClaimPatch) => {
      const found = rows.find((r) => r.id === id);
      if (!found) return undefined;
      Object.assign(found, patch);
      return found;
    },
    delaysByIds: async (_projectId: string, ids: string[]) =>
      delays.filter((d) => ids.includes(d.id)),
    position: async () => ({ approved: 0, pending: 0, count: rows.length }),
  } as unknown as EotRepository;
  return {
    rows,
    awards,
    service: eotService(repository, {
      applyAward: async (_projectId, days) => {
        awards.push(days);
      },
    }),
  };
}

const ACTOR = "usr_engineer";

test("a claim citing a contractor-culpable delay is refused and names it", async () => {
  const { service } = build(
    [],
    [
      delay(),
      delay({
        id: "delay_supplier",
        activity_name: "Import laterite & spread",
        reason_code: "MATERIAL_DELIVERY",
        culpability: "contractor",
        eot_claimable: false,
      }),
    ],
  );
  await assert.rejects(
    service.create(
      "prj_1",
      { title: "EOT-001", delayIds: ["delay_client", "delay_supplier"] },
      "usr_1",
    ),
    (error: unknown) => {
      assert.ok(isAppError(error));
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Import laterite & spread/);
      assert.match(error.message, /contractor/);
      return true;
    },
  );
});

test("a claim citing only claimable delays is created as a draft", async () => {
  const { service } = build([], [delay()]);
  const claim = await service.create(
    "prj_1",
    { title: "EOT-001", daysClaimed: 14, delayIds: ["delay_client"] },
    "usr_1",
  );
  assert.equal(claim.status, "Draft");
  assert.equal(claim.reference, "EOT-001");
  assert.equal(claim.delays.length, 1);
});

test("citing a delay that is not on this project is refused", async () => {
  const { service } = build([], []);
  await assert.rejects(
    service.create("prj_1", { title: "EOT-001", delayIds: ["delay_ghost"] }, "usr_1"),
    /Delay not found on this project/i,
  );
});

test("a claim with no days claimed cannot be submitted", async () => {
  const { service } = build([claimRow({ days_claimed: 0 })]);
  await assert.rejects(service.submit("prj_1", "eot_1"), /State the days claimed/i);
});

test("a submitted claim cannot be submitted again", async () => {
  const { service } = build([claimRow({ status: "Submitted" })]);
  await assert.rejects(service.submit("prj_1", "eot_1"), /cannot be submitted/i);
});

test("a draft claim cannot be decided", async () => {
  const { service } = build([claimRow()]);
  await assert.rejects(
    service.decide("prj_1", "eot_1", { decision: "Approved", daysAwarded: 14 }, ACTOR),
    /Submit the claim before deciding/i,
  );
});

test("approving awards the days and applies them once", async () => {
  const { rows, awards, service } = build([claimRow({ status: "Submitted" })]);
  const decided = await service.decide(
    "prj_1",
    "eot_1",
    { decision: "Approved", daysAwarded: 14 },
    ACTOR,
  );
  assert.equal(decided.status, "Approved");
  assert.equal(decided.daysAwarded, 14);
  assert.equal(decided.decidedById, ACTOR);
  assert.deepEqual(awards, [14]);
  assert.equal(rows[0]!.applied_days, 14);
});

test("approving with no days named awards what was claimed", async () => {
  const { awards, service } = build([claimRow({ status: "Submitted", days_claimed: 9 })]);
  await service.decide("prj_1", "eot_1", { decision: "Approved" }, ACTOR);
  assert.deepEqual(awards, [9]);
});

test("revising an award applies only the difference", async () => {
  const { awards, service } = build([
    claimRow({ status: "Approved", days_awarded: 14, applied_days: 14 }),
  ]);
  const decided = await service.decide(
    "prj_1",
    "eot_1",
    { decision: "Approved", daysAwarded: 9 },
    ACTOR,
  );
  assert.equal(decided.daysAwarded, 9);
  assert.deepEqual(awards, [-5]);
});

test("re-approving the same award moves nothing", async () => {
  const { awards, service } = build([
    claimRow({ status: "Approved", days_awarded: 14, applied_days: 14 }),
  ]);
  await service.decide("prj_1", "eot_1", { decision: "Approved", daysAwarded: 14 }, ACTOR);
  assert.deepEqual(awards, []);
});

test("rejecting a previously approved claim takes the time back", async () => {
  const { awards, service } = build([
    claimRow({ status: "Approved", days_awarded: 14, applied_days: 14 }),
  ]);
  const decided = await service.decide("prj_1", "eot_1", { decision: "Rejected" }, ACTOR);
  assert.equal(decided.daysAwarded, 0);
  assert.deepEqual(awards, [-14]);
});

test("rejecting awards no time", async () => {
  const { awards, service } = build([claimRow({ status: "Submitted" })]);
  await service.decide("prj_1", "eot_1", { decision: "Rejected" }, ACTOR);
  assert.deepEqual(awards, []);
});

test("a decided claim cannot be edited", async () => {
  const { service } = build([claimRow({ status: "Approved", days_awarded: 14, applied_days: 14 })]);
  await assert.rejects(
    service.update("prj_1", "eot_1", { title: "Reworded" }),
    /decided claim cannot be edited/i,
  );
});

test("a claim on another project is a 404", async () => {
  const { service } = build([claimRow({ project_id: "prj_other" })]);
  await assert.rejects(service.get("prj_1", "eot_1"), /not found/i);
});
