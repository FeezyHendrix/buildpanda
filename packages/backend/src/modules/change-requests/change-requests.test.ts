import { test } from "node:test";
import assert from "node:assert/strict";
import { changeRequestsService, type ChangeOrderContracts } from "./service.ts";
import type { ChangeRequestsRepository } from "./repository.ts";
import type { ChangeRequestRow, ChangeStatus } from "./types.ts";

function row(over: Partial<ChangeRequestRow> = {}): ChangeRequestRow {
  return {
    id: "chg_1",
    project_id: "prj_1",
    title: "Extra bathroom",
    description: null,
    description_html: null,
    reason: null,
    reason_html: null,
    status: "Submitted",
    cost_impact: "120000.00",
    time_impact_days: 5,
    currency: "NGN",
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

test("approving a change request generates its change-order contract and exposes contractId", async () => {
  const { repo } = fakeRepo(row());
  const { contracts, generated } = fakeContracts();
  const svc = changeRequestsService(repo, { contracts });
  const updated = await svc.update("prj_1", "chg_1", { status: "Approved" }, "usr_2");
  assert.deepEqual(generated, [{ id: "chg_1", title: "Extra bathroom", costImpact: 120000 }]);
  assert.equal(updated.contractId, "con_co");
  assert.equal(updated.status, "Approved");
  // Approving again (idempotent edit) does not generate a second contract.
  await svc.update("prj_1", "chg_1", { title: "Extra bathroom (rev A)" }, "usr_2");
  assert.equal(generated.length, 1);
});

test("Executed requires an Approved request whose contract is Signed", async () => {
  const pending = fakeContracts("Pending");
  const svcPending = changeRequestsService(fakeRepo(row({ status: "Approved" })).repo, { contracts: pending.contracts });
  await assert.rejects(
    svcPending.update("prj_1", "chg_1", { status: "Executed" }, "usr_2"),
    /Sign the change order contract before executing it/,
  );

  const signed = fakeContracts("Signed");
  const notApproved = fakeRepo(row({ status: "Submitted" }));
  await assert.rejects(
    changeRequestsService(notApproved.repo, { contracts: signed.contracts }).update("prj_1", "chg_1", { status: "Executed" }, "usr_2"),
    /Only an approved change request can be executed/,
  );

  const ok = fakeRepo(row({ status: "Approved", decided_at: "2026-09-02T00:00:00.000Z", decided_by_id: "usr_2" }));
  const executed = await changeRequestsService(ok.repo, { contracts: signed.contracts }).update(
    "prj_1",
    "chg_1",
    { status: "Executed" },
    "usr_2",
  );
  assert.equal(executed.status, "Executed");
  // Executed keeps the approval stamp rather than clearing it.
  assert.equal(executed.decidedAt, "2026-09-02T00:00:00.000Z");
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
