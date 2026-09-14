import { test } from "node:test";
import assert from "node:assert/strict";
import { contractsService, type ContractsDeps } from "./service.ts";
import type { ContractsRepository } from "./repository.ts";
import type { ContractRow, NewContractRecord } from "./types.ts";
import type { FinancesRow } from "../finances/types.ts";

interface Fake {
  repo: ContractsRepository;
  rows: Map<string, ContractRow>;
}

function fakeRepo(seed: ContractRow[] = []): Fake {
  const rows = new Map(seed.map((row) => [row.id, row]));
  const persist = (record: NewContractRecord): ContractRow => {
    const row: ContractRow = { ...record, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" };
    rows.set(row.id, row);
    return row;
  };
  const repo: ContractsRepository = {
    listByProject: async (projectId) => [...rows.values()].filter((r) => r.project_id === projectId),
    findById: async (id) => rows.get(id),
    findMain: async (projectId) => [...rows.values()].find((r) => r.project_id === projectId && r.kind === "main"),
    findByChangeRequest: async (id) => [...rows.values()].find((r) => r.change_request_id === id),
    listByChangeRequests: async (ids) => [...rows.values()].filter((r) => r.change_request_id && ids.includes(r.change_request_id)),
    create: async (record) => persist(record),
    createMainIfMissing: async (record) => {
      const existing = [...rows.values()].find((r) => r.project_id === record.project_id && r.kind === "main");
      return existing ?? persist(record);
    },
    update: async (id, patch) => {
      const row = rows.get(id);
      if (!row) return undefined;
      const next = { ...row, ...patch } as ContractRow;
      rows.set(id, next);
      return next;
    },
    remove: async (id) => {
      rows.delete(id);
    },
  };
  return { repo, rows };
}

function deps(over: Partial<ContractsDeps> = {}, contractSum = 5_000_000): ContractsDeps {
  return {
    finances: { findSummary: async () => ({ project_id: "prj_1", contract_sum: String(contractSum) }) as unknown as FinancesRow },
    stages: { countByContract: async () => [] },
    documents: { fileNamesByIds: async (ids) => new Map(ids.map((id) => [id, `${id}.pdf`])) },
    ...over,
  };
}

test("listByProject materialises the main contract from the contract sum on first read", async () => {
  const fake = fakeRepo();
  const svc = contractsService(fake.repo, deps());
  const contracts = await svc.listByProject("prj_1");
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0]?.kind, "main");
  assert.equal(contracts[0]?.title, "Main contract");
  assert.equal(contracts[0]?.total, 5_000_000);
  // A second read reuses it rather than creating another main.
  await svc.listByProject("prj_1");
  assert.equal(fake.rows.size, 1);
});

test("the main contract total tracks the contract terms on every read", async () => {
  const fake = fakeRepo();
  let sum = 5_000_000;
  const svc = contractsService(
    fake.repo,
    deps({ finances: { findSummary: async () => ({ project_id: "prj_1", contract_sum: String(sum) }) as unknown as FinancesRow } }),
  );
  await svc.listByProject("prj_1");
  sum = 5_250_000;
  const [main] = await svc.listByProject("prj_1");
  assert.equal(main?.total, 5_250_000);
});

test("stages with no contract count on the main contract; others on theirs", async () => {
  const fake = fakeRepo([
    {
      id: "con_co",
      project_id: "prj_1",
      kind: "change_order",
      change_request_id: "chg_1",
      title: "CO - Extra bathroom",
      trade: null,
      legal_entity: null,
      total: "120000.00",
      status: "Pending",
      document_id: null,
      signed_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
  ]);
  const svc = contractsService(
    fake.repo,
    deps({
      stages: {
        countByContract: async () => [
          { contract_id: null, count: "3" },
          { contract_id: "con_co", count: "1" },
        ],
      },
    }),
  );
  const contracts = await svc.listByProject("prj_1");
  const byKind = new Map(contracts.map((c) => [c.kind, c]));
  assert.equal(byKind.get("main")?.phaseCount, 3);
  assert.equal(byKind.get("change_order")?.phaseCount, 1);
});

test("an approved change request generates one Pending change-order contract carrying its cost impact", async () => {
  const fake = fakeRepo();
  const svc = contractsService(fake.repo, deps());
  const first = await svc.ensureForChangeRequest("prj_1", { id: "chg_1", title: "Extra bathroom", costImpact: 120000.5 });
  const second = await svc.ensureForChangeRequest("prj_1", { id: "chg_1", title: "Extra bathroom", costImpact: 999 });
  assert.equal(first.id, second.id);
  assert.equal(first.kind, "change_order");
  assert.equal(first.status, "Pending");
  assert.equal(first.title, "CO - Extra bathroom");
  assert.equal(first.total, 120000.5);
  assert.equal(first.changeRequestId, "chg_1");
  assert.deepEqual(await svc.idsByChangeRequests(["chg_1", "chg_x"]), new Map([["chg_1", first.id]]));
});

test("Signed requires the signed document; signedAt defaults to today", async () => {
  const fake = fakeRepo();
  const svc = contractsService(fake.repo, deps());
  const co = await svc.create("prj_1", { title: "Landscaping CO", trade: " Landscaping ", total: 80000 });
  await assert.rejects(svc.update("prj_1", co.id, { status: "Signed" }), /Upload the signed contract first/);
  const signed = await svc.update("prj_1", co.id, { status: "Signed", documentId: "doc_1" });
  assert.equal(signed.status, "Signed");
  assert.equal(signed.documentName, "doc_1.pdf");
  assert.match(signed.signedAt ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(signed.trade, "Landscaping");
});

test("only a change-order contract with no stages can be deleted", async () => {
  const fake = fakeRepo();
  const svc = contractsService(
    fake.repo,
    deps({ stages: { countByContract: async () => [{ contract_id: "con_busy", count: "2" }] } }),
  );
  const [main] = await svc.listByProject("prj_1");
  await assert.rejects(svc.remove("prj_1", main!.id), /main contract cannot be deleted/);
  const busy = await svc.create("prj_1", { title: "Busy" });
  fake.rows.set("con_busy", { ...fake.rows.get(busy.id)!, id: "con_busy" });
  await assert.rejects(svc.remove("prj_1", "con_busy"), /Move this contract's stages/);
  const empty = await svc.create("prj_1", { title: "Empty" });
  await svc.remove("prj_1", empty.id);
  assert.equal(fake.rows.has(empty.id), false);
  await assert.rejects(svc.remove("prj_other", busy.id), /not found/i);
});
