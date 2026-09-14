import { test } from "node:test";
import assert from "node:assert/strict";
import { toTransaction } from "./mappers.ts";
import { transactionsService } from "./service.ts";
import type { CustomCategoriesRepository, TransactionsRepository } from "./repository.ts";
import type { CustomCategoryRow, TransactionRowWithUser } from "./types.ts";

function txRow(over: Partial<TransactionRowWithUser> = {}): TransactionRowWithUser {
  return {
    id: "txn_1",
    project_id: "prj_1",
    title: "Plant hire deposit",
    description: null,
    category: "equipment",
    category_type: "preset",
    amount: "12000000.00",
    transacted_at: "2026-09-14",
    vendor: "Julius Berger Plant",
    reference: null,
    receipt_file_id: null,
    stage_id: "stg_1",
    credit: false,
    recoverable: false,
    created_by_id: "usr_1",
    created_by_name: "QA Reviewer",
    stage_name: "Mobilisation",
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
    ...over,
  };
}

function service(startDate: string | null = "2026-09-07") {
  let stored = txRow();
  const transactions = {
    listByProject: async () => [stored],
    findById: async () => stored,
    create: async (record: Record<string, unknown>) => {
      stored = { ...stored, ...record } as TransactionRowWithUser;
      return stored;
    },
    update: async (_id: string, patch: Record<string, unknown>) => {
      stored = { ...stored, ...patch } as TransactionRowWithUser;
      return stored;
    },
    remove: async () => 1,
    projectStartDate: async () => startDate,
  } as unknown as TransactionsRepository;
  const categories = {
    listByOrg: async (): Promise<CustomCategoryRow[]> => [],
    findByLabel: async () => undefined,
  } as unknown as CustomCategoriesRepository;
  return { svc: transactionsService(transactions, categories), current: () => stored };
}

test("a negative expense is refused and points at recording a credit instead", async () => {
  const { svc } = service();
  await assert.rejects(
    svc.create("prj_1", "org_1", "usr_1", {
      title: "Diesel refund",
      category: "equipment",
      amount: -6_400_000,
      transactedAt: "2026-09-14",
    }),
    /cannot be negative — record a refund or credit instead/,
  );
});

test("a refund is a credit record of its own, and it subtracts from the stage", async () => {
  const { svc, current } = service();
  await svc.create("prj_1", "org_1", "usr_1", {
    title: "Diesel refund",
    category: "equipment",
    amount: 6_400_000,
    transactedAt: "2026-09-14",
    credit: true,
  });
  assert.equal(current().credit, true);
});

test("a refundable outlay is flagged so it does not sit in used cost for ever", async () => {
  const { svc, current } = service();
  await svc.create("prj_1", "org_1", "usr_1", {
    title: "Plant hire deposit",
    category: "equipment",
    amount: 12_000_000,
    transactedAt: "2026-09-14",
    recoverable: true,
  });
  assert.equal(current().recoverable, true);
});

test("spend before site possession is flagged, not blocked", () => {
  const index = new Map<string, CustomCategoryRow>();
  // Possession 7 Sept; this expense is dated the 1st.
  const before = toTransaction(txRow({ transacted_at: "2026-09-01" }), index, "2026-09-07");
  assert.equal(before.preContract, true);
  const after = toTransaction(txRow({ transacted_at: "2026-09-14" }), index, "2026-09-07");
  assert.equal(after.preContract, false);
  // With no recorded start date nothing is claimed either way.
  assert.equal(toTransaction(txRow({ transacted_at: "2026-09-01" }), index, null).preContract, false);
});
