import { test } from "node:test";
import assert from "node:assert/strict";
import { purchaseOrdersService } from "./service.ts";
import type { NewPurchaseOrderRecord, PurchaseOrdersRepository } from "./repository.ts";
import type { PurchaseOrderRowWithStage } from "./types.ts";

function fakeRepo(): PurchaseOrdersRepository & { inserted: NewPurchaseOrderRecord[] } {
  const inserted: NewPurchaseOrderRecord[] = [];
  const stored = new Map<string, PurchaseOrderRowWithStage>();
  return {
    inserted,
    listByProject: async () => [...stored.values()],
    findById: async (id) => stored.get(id),
    listItemsForPurchaseOrders: async () => [],
    committedByStage: async () => [],
    create: async (record) => {
      inserted.push(record);
      const row = { ...record, created_at: new Date(), stage_name: record.stage_id ? "Foundation" : null };
      stored.set(record.id, row);
      return row;
    },
    update: async () => undefined,
    deletePurchaseOrder: async () => 1,
  };
}

const input = { poNumber: "PO-1", vendorName: "Dangote", items: [{ description: "Cement", quantity: 10, unitPrice: 5000 }] };

test("create attributes the PO to a stage and returns the joined stage name", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo, { stageBelongsToProject: async () => true });
  const po = await svc.create("prj_1", { ...input, stageId: " stg_1 " });
  assert.equal(repo.inserted[0]?.stage_id, "stg_1");
  assert.equal(po.stageId, "stg_1");
  assert.equal(po.stageName, "Foundation");
});

test("create rejects a stage from another project and treats blank as none", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo, { stageBelongsToProject: async () => false });
  await assert.rejects(svc.create("prj_1", { ...input, stageId: "stg_other" }), /does not belong/i);
  const po = await svc.create("prj_1", { ...input, stageId: "" });
  assert.equal(po.stageId, null);
  assert.equal(po.stageName, null);
});
