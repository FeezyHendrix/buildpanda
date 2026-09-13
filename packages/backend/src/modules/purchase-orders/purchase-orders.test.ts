import { test } from "node:test";
import assert from "node:assert/strict";
import { purchaseOrdersService } from "./service.ts";
import { nextPoNumber } from "./mappers.ts";
import type {
  NewPurchaseOrderItemRecord,
  NewPurchaseOrderRecord,
  PurchaseOrdersRepository,
} from "./repository.ts";
import type { PurchaseOrderItemRow, PurchaseOrderRowWithStage } from "./types.ts";

function fakeRepo(): PurchaseOrdersRepository & { inserted: NewPurchaseOrderRecord[] } {
  const inserted: NewPurchaseOrderRecord[] = [];
  const stored = new Map<string, PurchaseOrderRowWithStage>();
  const items = new Map<string, PurchaseOrderItemRow[]>();
  return {
    inserted,
    listByProject: async () => [...stored.values()],
    findById: async (id) => stored.get(id),
    findByNumber: async (projectId, poNumber) =>
      [...stored.values()].find((r) => r.project_id === projectId && r.po_number === poNumber),
    listNumbers: async (projectId) =>
      [...stored.values()].filter((r) => r.project_id === projectId).map((r) => r.po_number),
    listItemsForPurchaseOrders: async (ids) => ids.flatMap((id) => items.get(id) ?? []),
    committedByStage: async () => [],
    create: async (record, lines: NewPurchaseOrderItemRecord[]) => {
      inserted.push(record);
      const row: PurchaseOrderRowWithStage = {
        ...record,
        issued_at: null,
        issued_by_id: null,
        cancel_reason: null,
        cancelled_at: null,
        closed_at: null,
        over_receipt: false,
        created_at: new Date(),
        stage_name: record.stage_id ? "Foundation" : null,
      };
      stored.set(record.id, row);
      items.set(
        record.id,
        lines.map((line) => ({ ...line, received_quantity: "0", created_at: new Date() })),
      );
      return row;
    },
    update: async (id, patch, lines) => {
      const current = stored.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch };
      stored.set(id, next);
      items.set(id, lines.map((line) => ({ ...line, received_quantity: "0", created_at: new Date() })));
      return next;
    },
    transition: async (id, patch) => {
      const current = stored.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch };
      stored.set(id, next);
      return next;
    },
    applyReceipt: async (id, received, patch) => {
      const current = stored.get(id);
      if (!current) return undefined;
      const lines = items.get(id) ?? [];
      items.set(
        id,
        lines.map((line) => {
          const hit = received.find((r) => r.itemId === line.id);
          return hit ? { ...line, received_quantity: String(hit.receivedQuantity) } : line;
        }),
      );
      const next = { ...current, ...patch };
      stored.set(id, next);
      return next;
    },
    deletePurchaseOrder: async (id) => (stored.delete(id) ? 1 : 0),
  };
}

const input = {
  vendorName: "Dangote",
  items: [{ description: "Cement 42.5R", quantity: 800, unitPrice: 8500 }],
};

test("create attributes the PO to a stage and returns the joined stage name", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo, { stageBelongsToProject: async () => true });
  const po = await svc.create("prj_1", { ...input, poNumber: "PO-IS2-001", stageId: " stg_1 " });
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

test("a PO is born a draft and commits nothing until it is issued", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const draft = await svc.create("prj_1", input);
  assert.equal(draft.status, "Draft");
  assert.equal(draft.committed, false);
  assert.equal(await svc.committedTotal("prj_1"), 0);

  const issued = await svc.issue("prj_1", draft.id, { issuedAt: "2026-09-13" }, "usr_1");
  assert.equal(issued.status, "Issued");
  assert.equal(issued.issuedAt, "2026-09-13");
  assert.equal(issued.issuedById, "usr_1");
  assert.equal(issued.committed, true);
  assert.equal(await svc.committedTotal("prj_1"), 6800000);
});

test("a cancelled PO stays on file with its reason and commits nothing", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const po = await svc.create("prj_1", { ...input, items: [{ description: "Y16 rebar", quantity: 20, unitPrice: 1200000 }] });
  await svc.issue("prj_1", po.id, {}, "usr_1");
  assert.equal(await svc.committedTotal("prj_1"), 24000000);

  await assert.rejects(svc.cancel("prj_1", po.id, { reason: "  " }), /must say why/i);
  const cancelled = await svc.cancel("prj_1", po.id, { reason: "Supplier could not hold the price" });
  assert.equal(cancelled.status, "Cancelled");
  assert.equal(cancelled.cancelReason, "Supplier could not hold the price");
  assert.equal(cancelled.committed, false);
  assert.equal(await svc.committedTotal("prj_1"), 0);
  await assert.rejects(svc.issue("prj_1", po.id, {}, "usr_1"), /cancelled purchase order cannot be issued/i);
});

test("receiving part of a line leaves the PO partially received", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const po = await svc.create("prj_1", input);
  await svc.issue("prj_1", po.id, {}, "usr_1");
  const lineId = po.items[0]!.id;

  const partial = await svc.receive("prj_1", po.id, { lines: [{ itemId: lineId, receivedQuantity: 500 }] });
  assert.equal(partial.status, "PartiallyReceived");
  assert.equal(partial.items[0]?.receivedQuantity, 500);
  assert.equal(partial.items[0]?.outstandingQuantity, 300);
  assert.equal(partial.overReceipt, false);

  const complete = await svc.receive("prj_1", po.id, { lines: [{ itemId: lineId, receivedQuantity: 800 }] });
  assert.equal(complete.status, "Received");
  assert.equal(complete.items[0]?.outstandingQuantity, 0);
  assert.equal(complete.receivedTotal, 6800000);
});

test("receiving more than was ordered is recorded and flagged, not refused", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const po = await svc.create("prj_1", input);
  await svc.issue("prj_1", po.id, {}, "usr_1");

  const over = await svc.receive("prj_1", po.id, {
    lines: [{ itemId: po.items[0]!.id, receivedQuantity: 850 }],
  });
  assert.equal(over.status, "Received");
  assert.equal(over.overReceipt, true);
  assert.equal(over.items[0]?.overReceived, true);
  assert.equal(over.items[0]?.receivedQuantity, 850);
  // The ordered quantity is untouched: the PO still says what was ordered.
  assert.equal(over.items[0]?.quantity, 800);
});

test("the lines of a received PO are read-only", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const po = await svc.create("prj_1", input);
  await svc.issue("prj_1", po.id, {}, "usr_1");
  await svc.receive("prj_1", po.id, { lines: [{ itemId: po.items[0]!.id, receivedQuantity: 800 }] });

  await assert.rejects(
    svc.edit("prj_1", po.id, { items: [{ description: "Cement 42.5R", quantity: 850, unitPrice: 8500 }] }),
    /cannot be edited/i,
  );
});

test("a received PO closes, and an issued PO cannot be deleted", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const po = await svc.create("prj_1", input);
  await svc.issue("prj_1", po.id, {}, "usr_1");
  await assert.rejects(svc.remove("prj_1", po.id), /cancel it with a reason/i);

  await svc.receive("prj_1", po.id, { lines: [{ itemId: po.items[0]!.id, receivedQuantity: 800 }] });
  const closed = await svc.close("prj_1", po.id);
  assert.equal(closed.status, "Closed");
  assert.equal(closed.committed, true);
  await assert.rejects(svc.close("prj_1", po.id), /closed purchase order cannot be closed/i);
});

test("PO numbers are sequenced per project and never collide", async () => {
  assert.equal(nextPoNumber([]), "PO-1");
  assert.equal(nextPoNumber(["PO-1", "PO-3", "PO-IS2-009"]), "PO-4");

  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo);
  const first = await svc.create("prj_1", input);
  const second = await svc.create("prj_1", input);
  assert.equal(first.poNumber, "PO-1");
  assert.equal(second.poNumber, "PO-2");
  await assert.rejects(svc.create("prj_1", { ...input, poNumber: "PO-1" }), /already used/i);
});

test("a PO raised from a material request carries its supplier, quantity and stage", async () => {
  const repo = fakeRepo();
  const svc = purchaseOrdersService(repo, { stageBelongsToProject: async () => true });
  const po = await svc.createFromMaterialOrder("prj_1", {
    id: "mo_1",
    title: "Cement for culvert bases",
    materialName: "Dangote cement 42.5R",
    quantity: 800,
    unit: "bags",
    unitRate: 8500,
    estimatedCost: 6800000,
    supplier: "Dangote Ikorodu depot",
    supplierId: "sup_1",
    phaseId: "stg_1",
    expectedDeliveryAt: "2026-10-10",
    neededBy: "2026-10-12",
  });
  assert.equal(po.vendorName, "Dangote Ikorodu depot");
  assert.equal(po.supplierId, "sup_1");
  assert.equal(po.materialOrderId, "mo_1");
  assert.equal(po.stageId, "stg_1");
  assert.equal(po.expectedDate, "2026-10-10");
  assert.equal(po.total, 6800000);
  assert.equal(po.items[0]?.description, "Dangote cement 42.5R (800 bags)");
  assert.equal(po.status, "Draft");
});

test("a material request with no supplier cannot raise a PO", async () => {
  const svc = purchaseOrdersService(fakeRepo());
  await assert.rejects(
    svc.createFromMaterialOrder("prj_1", {
      id: "mo_2",
      title: "Precast culvert",
      materialName: "Precast box culvert",
      quantity: 1,
      unit: "no",
      unitRate: null,
      estimatedCost: 18500000,
      supplier: null,
      supplierId: null,
      phaseId: null,
      expectedDeliveryAt: null,
      neededBy: "2026-10-20",
    }),
    /Name the supplier/i,
  );
});
