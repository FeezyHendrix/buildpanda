import { test } from "node:test";
import assert from "node:assert/strict";
import { changeActions } from "./change-actions.ts";
import { changeRequestsService, type ChangeOrderContracts } from "./service.ts";
import type { ChangeRequestsRepository } from "./repository.ts";
import { parseRevisions } from "./transitions.ts";
import type { ChangeRequestRow, ChangeStatus } from "./types.ts";

const SUBMITTER = { id: "usr_1", name: "Site QS", holdsApproval: false };
const ENGINEER = { id: "usr_2", name: "Resident Engineer", holdsApproval: true };

function row(over: Partial<ChangeRequestRow> = {}): ChangeRequestRow {
  return {
    id: "chg_1",
    project_id: "prj_1",
    title: "Additional 120 m lined drain",
    description: null,
    description_html: null,
    reason: "Ground conditions at ch. 2+300",
    reason_html: null,
    status: "Submitted",
    type: "variation",
    cost_impact: "4800000.00",
    time_impact_days: 6,
    currency: "NGN",
    stage_id: null,
    rfi_id: null,
    eot_claim_id: null,
    rejected_reason: null,
    submitted_at: null,
    revisions: null,
    submitted_by_id: "usr_1",
    decided_by_id: null,
    decided_by_name: null,
    decided_at: null,
    assignee_id: null,
    assignee_name: null,
    estimate_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function fakeRepo(seed: ChangeRequestRow, counts: Array<{ status: ChangeStatus; count: string }> = []) {
  let stored = seed;
  const repo = {
    projectEstimateId: async () => null,
    listByProject: async () => [stored],
    findById: async (id: string) => (id === stored.id ? stored : undefined),
    countsByStatus: async () => counts,
    commentCounts: async () => new Map<string, number>(),
    create: async () => stored,
    update: async (_id: string, patch: Record<string, unknown>) => {
      stored = { ...stored, ...patch } as ChangeRequestRow;
      return stored;
    },
    remove: async () => {},
    countReferencingRfis: async () => 0,
    listComments: async () => [],
    addComment: async () => { throw new Error("unused"); },
    listBudgetLinks: async () => [],
    replaceBudgetLinks: async () => {},
  } as unknown as ChangeRequestsRepository;
  return { repo, current: () => stored };
}

function fakeContracts(status: "Pending" | "Signed" | null = null) {
  const generated: Array<{ id: string; title: string; costImpact: number }> = [];
  const contracts: ChangeOrderContracts = {
    ensureForChangeRequest: async (_projectId, source) => {
      generated.push(source);
      return { id: "con_co", status: "Pending" };
    },
    findByChangeRequest: async () => (status ? { id: "con_co", status } : null),
    idsByChangeRequests: async (ids) => new Map(ids.map((id) => [id, "con_co"])),
  };
  return { contracts, generated };
}

function harness(seed: ChangeRequestRow, contractStatus: "Pending" | "Signed" | null = null) {
  const { repo, current } = fakeRepo(seed);
  const { contracts, generated } = fakeContracts(contractStatus);
  const service = changeRequestsService(repo, { contracts });
  const shifted: Array<{ stageId: string; days: number }> = [];
  const eot: Array<{ days: number }> = [];
  const decided: Array<{ action: string; reason: string | null }> = [];
  const actions = changeActions(repo, {
    assertExecutable: (r) => service.assertExecutable(r),
    shiftStageEnd: async (_projectId, stageId, days) => {
      shifted.push({ stageId, days });
    },
    applyApprovedEot: async (_projectId, days) => {
      eot.push({ days });
    },
    onApproved: (r, actor) => service.onApproved(r, { id: actor.id, name: actor.name }),
    onDecided: (_r, action, reason) => decided.push({ action, reason }),
  });
  return { service, actions, current, generated, shifted, eot, decided };
}

test("status cannot be walked by editing — only the actions move it", async () => {
  const { service, current } = harness(row({ status: "Draft" }));
  await service.update("prj_1", "chg_1", { title: "Revised title" }, "usr_1");
  // The update path has no status field at all; the record stays Draft.
  assert.equal(current().status, "Draft");
});

test("a rejection always carries a reason and records it on the change", async () => {
  const { actions, current, decided } = harness(row());
  await assert.rejects(
    actions.run("prj_1", "chg_1", "reject", {}, ENGINEER),
    /Say why the change is rejected/,
  );
  await actions.run(
    "prj_1",
    "chg_1",
    "reject",
    { reason: "Rate for lined drain is above the BoQ rate" },
    ENGINEER,
  );
  assert.equal(current().status, "Rejected");
  assert.equal(current().rejected_reason, "Rate for lined drain is above the BoQ rate");
  assert.equal(current().decided_by_id, "usr_2");
  assert.deepEqual(decided.at(-1), {
    action: "reject",
    reason: "Rate for lined drain is above the BoQ rate",
  });
});

test("the person who raised a change cannot decide it", async () => {
  const { actions } = harness(row());
  await assert.rejects(
    actions.run("prj_1", "chg_1", "approve", {}, SUBMITTER),
    /someone with the approval permission has to decide it/,
  );
  // Holding the approval grant is the exception.
  await assert.doesNotReject(
    actions.run("prj_1", "chg_1", "approve", {}, { ...SUBMITTER, holdsApproval: true }),
  );
});

test("resubmitting a rejected change opens a new priced version and keeps the trail", async () => {
  const { actions, current } = harness(row({ status: "Rejected", rejected_reason: "Rate too high" }));
  await actions.run(
    "prj_1",
    "chg_1",
    "resubmit",
    { costImpact: 4_200_000, reason: "Re-priced against the BoQ rate" },
    SUBMITTER,
  );
  const after = current();
  assert.equal(after.status, "Submitted");
  assert.equal(after.cost_impact, "4200000");
  // The rejection is cleared, but the version that was rejected survives.
  assert.equal(after.rejected_reason, null);
  const revisions = parseRevisions(after.revisions);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0]?.version, 1);
  assert.equal(revisions[0]?.costImpact, 4_200_000);
  assert.equal(revisions[0]?.reason, "Re-priced against the BoQ rate");
  assert.equal(revisions[0]?.actorName, "Site QS");
});

test("a draft cannot be approved without being submitted first", async () => {
  const { actions } = harness(row({ status: "Draft" }));
  await assert.rejects(
    actions.run("prj_1", "chg_1", "approve", {}, ENGINEER),
    /A Draft change request cannot be approved — it must be Submitted/,
  );
});

test("approving generates the change-order contract and records the variation once", async () => {
  const { actions, generated, current } = harness(row());
  await actions.run("prj_1", "chg_1", "approve", {}, ENGINEER);
  assert.equal(current().status, "Approved");
  assert.deepEqual(generated, [
    { id: "chg_1", title: "Additional 120 m lined drain", costImpact: 4_800_000 },
  ]);
  // Approving an already-approved change is not a transition at all.
  await assert.rejects(actions.run("prj_1", "chg_1", "approve", {}, ENGINEER), /cannot be approved/);
  assert.equal(generated.length, 1);
});

test("execution waits for the signed change-order contract", async () => {
  const pending = harness(row({ status: "Approved" }), "Pending");
  await assert.rejects(
    pending.actions.run("prj_1", "chg_1", "execute", {}, ENGINEER),
    /Sign the change order contract before executing it/,
  );
  const notApproved = harness(row({ status: "Submitted" }), "Signed");
  await assert.rejects(
    notApproved.actions.run("prj_1", "chg_1", "execute", {}, ENGINEER),
    /cannot be executed — it must be Approved/,
  );
});

test("executing applies the time impact to the stage it was claimed against", async () => {
  const { actions, shifted, eot, current } = harness(
    row({ status: "Approved", stage_id: "stg_6", time_impact_days: 6 }),
    "Signed",
  );
  await actions.run("prj_1", "chg_1", "execute", {}, ENGINEER);
  assert.equal(current().status, "Executed");
  assert.deepEqual(shifted, [{ stageId: "stg_6", days: 6 }]);
  // A money variation is not an extension of time on its own.
  assert.deepEqual(eot, []);
});

test("a time-only change awards its days through the extension-of-time module", async () => {
  const { actions, eot, shifted } = harness(
    row({ status: "Approved", type: "eot_only", cost_impact: "0.00", time_impact_days: 14, stage_id: "stg_6" }),
    "Signed",
  );
  await actions.run("prj_1", "chg_1", "execute", {}, ENGINEER);
  assert.deepEqual(eot, [{ days: 14 }]);
  assert.deepEqual(shifted, [{ stageId: "stg_6", days: 14 }]);
});

test("a change an RFI was converted into cannot be deleted out from under it", async () => {
  const { actions } = harness(row());
  await assert.rejects(
    actions.assertRemovable("prj_1", "chg_1", 1),
    /unlink it before deleting the change/,
  );
  await assert.doesNotReject(actions.assertRemovable("prj_1", "chg_1", 0));
});

test("an approved change cannot be silently re-priced by editing", async () => {
  const { service } = harness(row({ status: "Approved" }));
  await assert.rejects(
    service.update("prj_1", "chg_1", { costImpact: 9_000_000 }, "usr_1"),
    /raise a new change request to alter its value/,
  );
});

test("summary counts every status and reports no gross profit without a cost build-up", async () => {
  const { repo } = fakeRepo(row(), [
    { status: "Draft", count: "2" },
    { status: "Approved", count: "1" },
    { status: "Executed", count: "3" },
  ]);
  const summary = await changeRequestsService(repo).summary("prj_1");
  assert.deepEqual(summary, { draft: 2, submitted: 0, approved: 1, executed: 3, rejected: 0, grossProfit: null });
});

test("list resolves contract ids in one batched lookup and tolerates no contracts dep", async () => {
  const { repo } = fakeRepo(row());
  const withContracts = await changeRequestsService(repo, fakeContracts()).list("prj_1");
  assert.equal(withContracts[0]?.contractId, "con_co");
  const without = await changeRequestsService(repo).list("prj_1");
  assert.equal(without[0]?.contractId, null);
});
