import { test } from "node:test";
import assert from "node:assert/strict";
import { materialsEquipmentService } from "./service.ts";
import { materialDeliveryService } from "./delivery-service.ts";
import { isMaterialOrderLate } from "./mappers.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import type { MaterialDeliveryRow, MaterialOrderRow } from "./types.ts";

const TODAY = new Date().toISOString().slice(0, 10);

function dayOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function orderRow(overrides: Partial<MaterialOrderRow> = {}): MaterialOrderRow {
  return {
    id: "mo_1",
    project_id: "prj_1",
    title: "Laterite to formation",
    material_name: "Laterite",
    quantity: "3000",
    unit: "m3",
    supplier: "Ogun Quarries",
    supplier_id: null,
    supplier_name: null,
    status: "Ordered",
    priority: "Normal",
    phase_id: "stg_1",
    phase_name: "Earthworks",
    activity_id: "act_1",
    activity_name: "Import laterite & spread",
    document_id: null,
    document_name: null,
    requested_by_id: "usr_1",
    needed_by: dayOffset(30),
    ordered_at: TODAY,
    expected_delivery_at: null,
    delivered_at: null,
    unit_rate: "4500",
    estimated_cost: "13500000",
    actual_cost: "0",
    currency: "NGN",
    delivery_location: null,
    notes: null,
    cancel_reason: null,
    rejected_reason: null,
    procurement_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

interface Fake {
  repository: MaterialsEquipmentRepository;
  orders: Map<string, MaterialOrderRow>;
  deliveries: MaterialDeliveryRow[];
  procurements: string[];
}

function fakeRepo(
  seed: MaterialOrderRow[] = [orderRow()],
  approvals = new Map<string, string>(),
): Fake {
  const orders = new Map(seed.map((row) => [row.id, row]));
  const deliveries: MaterialDeliveryRow[] = [];
  const procurements: string[] = [];
  const repository = {
    listMaterialOrders: async (projectId: string, status?: string) =>
      [...orders.values()].filter(
        (row) => row.project_id === projectId && (!status || row.status === status),
      ),
    findMaterialOrder: async (id: string) => orders.get(id),
    createMaterialOrder: async (record: Record<string, unknown>) => {
      const row = orderRow(record as Partial<MaterialOrderRow>);
      orders.set(row.id, row);
      return row;
    },
    updateMaterialOrder: async (id: string, patch: Record<string, unknown>) => {
      const current = orders.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch } as MaterialOrderRow;
      orders.set(id, next);
      return next;
    },
    deleteMaterialOrder: async (id: string) => (orders.delete(id) ? 1 : 0),
    listDeliveriesForOrders: async (ids: string[]) =>
      deliveries.filter((d) => ids.includes(d.order_id)),
    insertDelivery: async (record: Record<string, unknown>) => {
      const row = { ...record, received_by_name: null, ledger_entry_id: null, transaction_id: null, created_at: new Date() } as unknown as MaterialDeliveryRow;
      deliveries.push(row);
      return row;
    },
    linkDeliveryRecords: async () => undefined,
    approvalStatusByMaterial: async () => approvals,
    createMaterialProcurementFromOrder: async (row: MaterialOrderRow) => {
      procurements.push(row.id);
    },
    listEquipmentRequests: async () => [],
    findEquipmentRequest: async () => undefined,
    createEquipmentRequest: async () => {
      throw new Error("not used");
    },
    updateEquipmentRequest: async () => undefined,
    appendHireExtension: async () => undefined,
    deleteEquipmentRequest: async () => 0,
  } as unknown as MaterialsEquipmentRepository;
  return { repository, orders, deliveries, procurements };
}

test("the ladder allows a single-drop delivery straight from Ordered", async () => {
  const fake = fakeRepo();
  const service = materialsEquipmentService(fake.repository);
  const order = await service.updateMaterialOrder("prj_1", "mo_1", { status: "Delivered" });
  assert.equal(order.status, "Delivered");
  assert.equal(order.deliveredAt, TODAY);
  assert.deepEqual(fake.procurements, ["mo_1"]);
});

test("Cancelled and Rejected are reachable from any live state but need a reason", async () => {
  const service = materialsEquipmentService(fakeRepo().repository);
  await assert.rejects(
    service.updateMaterialOrder("prj_1", "mo_1", { status: "Cancelled" }),
    /must say why/i,
  );
  const cancelled = await service.updateMaterialOrder("prj_1", "mo_1", {
    status: "Cancelled",
    reason: "Quarry could not supply",
  });
  assert.equal(cancelled.status, "Cancelled");
  assert.equal(cancelled.cancelReason, "Quarry could not supply");
});

test("a rejected load is a terminal record, not a deletion", async () => {
  const service = materialsEquipmentService(fakeRepo().repository);
  const rejected = await service.updateMaterialOrder("prj_1", "mo_1", {
    status: "Rejected",
    reason: "CBR fail on the source sample",
  });
  assert.equal(rejected.status, "Rejected");
  assert.equal(rejected.rejectedReason, "CBR fail on the source sample");
  await assert.rejects(
    service.updateMaterialOrder("prj_1", "mo_1", { status: "Delivered" }),
    /Cannot move material order from Rejected/,
  );
});

test("a terminal order cannot be reopened", async () => {
  const fake = fakeRepo([orderRow({ status: "Delivered" })]);
  const service = materialsEquipmentService(fake.repository);
  await assert.rejects(
    service.updateMaterialOrder("prj_1", "mo_1", { status: "Ordered" }),
    /Cannot move material order from Delivered to Ordered/,
  );
});

test("ordering a material with an unresolved approval is refused until forced", async () => {
  const fake = fakeRepo(
    [orderRow({ status: "Approved" })],
    new Map([["laterite", "Rejected"]]),
  );
  const service = materialsEquipmentService(fake.repository);
  await assert.rejects(
    service.updateMaterialOrder("prj_1", "mo_1", { status: "Ordered" }),
    /rejected material approval/i,
  );
  const forced = await service.updateMaterialOrder("prj_1", "mo_1", {
    status: "Ordered",
    force: true,
    forceNote: "Client instructed to proceed",
  });
  assert.equal(forced.status, "Ordered");
  assert.equal(forced.approvalStatus, "Rejected");
  assert.match(forced.notes ?? "", /Client instructed to proceed/);
});

test("estimated cost is rate x quantity when a rate is given", async () => {
  const fake = fakeRepo([]);
  const service = materialsEquipmentService(fake.repository);
  const created = await service.createMaterialOrder(
    "prj_1",
    {
      title: "Cement",
      materialName: "Cement",
      quantity: 800,
      unit: "bags",
      neededBy: dayOffset(10),
      unitRate: 8500,
    },
    "usr_1",
  );
  assert.equal(created.estimatedCost, 6800000);
  assert.equal(created.unitRate, 8500);
});

test("late is computed from the dates, never stored", () => {
  assert.equal(isMaterialOrderLate(orderRow({ needed_by: dayOffset(-12) })), true);
  assert.equal(isMaterialOrderLate(orderRow({ needed_by: dayOffset(30) })), false);
  // Delivered and cancelled orders are closed and cannot be late.
  assert.equal(
    isMaterialOrderLate(orderRow({ needed_by: dayOffset(-12), status: "Delivered" })),
    false,
  );
  assert.equal(
    isMaterialOrderLate(orderRow({ needed_by: dayOffset(-12), status: "Cancelled" })),
    false,
  );
  // Promised after it was wanted: late before the date even arrives.
  assert.equal(
    isMaterialOrderLate(
      orderRow({ needed_by: dayOffset(30), expected_delivery_at: dayOffset(35) }),
    ),
    true,
  );
});

test("listLateMaterialOrders returns only the orders a QS has to chase", async () => {
  const fake = fakeRepo([
    orderRow({ id: "mo_late", needed_by: dayOffset(-12), status: "Requested" }),
    orderRow({ id: "mo_ok", needed_by: dayOffset(30), status: "Ordered" }),
    orderRow({ id: "mo_done", needed_by: dayOffset(-5), status: "Delivered" }),
    orderRow({ id: "mo_promised_late", needed_by: dayOffset(20), expected_delivery_at: dayOffset(26) }),
  ]);
  const service = materialsEquipmentService(fake.repository);
  const late = await service.listLateMaterialOrders("prj_1");
  assert.deepEqual(late.map((o) => o.id).sort(), ["mo_late", "mo_promised_late"]);
});

test("deliveries sum to part-delivered, then delivered, and price the order", async () => {
  const fake = fakeRepo();
  const service = materialsEquipmentService(fake.repository);
  const deliveries = materialDeliveryService(fake.repository, service);

  const partial = await deliveries.record(
    "prj_1",
    "mo_1",
    { deliveredQty: 1800, deliveredAt: "2026-11-21", deliveryNote: "DN-4471" },
    "usr_1",
  );
  assert.equal(partial.status, "PartiallyDelivered");
  assert.equal(partial.deliveredQuantity, 1800);
  assert.equal(partial.outstandingQuantity, 1200);
  assert.equal(partial.actualCost, 8100000);

  const complete = await deliveries.record(
    "prj_1",
    "mo_1",
    { deliveredQty: 1200, deliveredAt: "2026-11-24", deliveryNote: "DN-4502" },
    "usr_1",
  );
  assert.equal(complete.status, "Delivered");
  assert.equal(complete.deliveredQuantity, 3000);
  assert.equal(complete.outstandingQuantity, 0);
  assert.equal(complete.actualCost, 13500000);
  assert.deepEqual(fake.procurements, ["mo_1"]);
});

test("a rejected load is recorded against the supplier but books nothing", async () => {
  const fake = fakeRepo();
  const service = materialsEquipmentService(fake.repository);
  const booked: string[] = [];
  const deliveries = materialDeliveryService(fake.repository, service, {
    bookStock: async () => {
      booked.push("stock");
      return "mle_1";
    },
    bookCost: async () => {
      booked.push("cost");
      return "txn_1";
    },
  });

  const order = await deliveries.record(
    "prj_1",
    "mo_1",
    { deliveredQty: 600, deliveredAt: "2026-11-21", rejected: true, rejectedReason: "CBR fail" },
    "usr_1",
  );
  assert.deepEqual(booked, []);
  assert.equal(order.deliveredQuantity, 0);
  assert.equal(order.status, "Ordered");
  assert.equal(order.deliveries[0]?.rejected, true);

  await assert.rejects(
    deliveries.record("prj_1", "mo_1", { deliveredQty: 10, deliveredAt: "2026-11-21", rejected: true }, "usr_1"),
    /why it was refused/i,
  );
});

test("an accepted delivery books stock and books cost on the order's phase", async () => {
  const fake = fakeRepo();
  const service = materialsEquipmentService(fake.repository);
  const stock: unknown[] = [];
  const costs: Array<{ amount: number; stageId: string | null; reference: string | null }> = [];
  const deliveries = materialDeliveryService(fake.repository, service, {
    bookStock: async (input) => {
      stock.push(input);
      return "mle_1";
    },
    bookCost: async (input) => {
      costs.push({ amount: input.amount, stageId: input.order.phase_id, reference: input.deliveryNote });
      return "txn_1";
    },
  });

  await deliveries.record(
    "prj_1",
    "mo_1",
    { deliveredQty: 1800, deliveredAt: "2026-11-21", deliveryNote: "DN-4471" },
    "usr_1",
  );
  assert.equal(stock.length, 1);
  assert.deepEqual(costs, [{ amount: 8100000, stageId: "stg_1", reference: "DN-4471" }]);
});

test("an unpriced order books stock but no cost", async () => {
  const fake = fakeRepo([orderRow({ unit_rate: null })]);
  const service = materialsEquipmentService(fake.repository);
  let costCalls = 0;
  const deliveries = materialDeliveryService(fake.repository, service, {
    bookStock: async () => "mle_1",
    bookCost: async () => {
      costCalls += 1;
      return "txn_1";
    },
  });
  await deliveries.record("prj_1", "mo_1", { deliveredQty: 100, deliveredAt: "2026-11-21" }, "usr_1");
  assert.equal(costCalls, 0);
});

test("a cancelled order cannot receive a delivery", async () => {
  const fake = fakeRepo([orderRow({ status: "Cancelled" })]);
  const service = materialsEquipmentService(fake.repository);
  const deliveries = materialDeliveryService(fake.repository, service);
  await assert.rejects(
    deliveries.record("prj_1", "mo_1", { deliveredQty: 10, deliveredAt: "2026-11-21" }, "usr_1"),
    /cannot receive a delivery/i,
  );
});
