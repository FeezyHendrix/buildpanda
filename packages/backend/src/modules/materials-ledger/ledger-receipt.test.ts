import { test } from "node:test";
import assert from "node:assert/strict";
import { materialsLedgerService } from "./service.ts";
import type { MaterialsLedgerRepository, PostEntryInput } from "./repository.ts";
import type { LedgerEntryRow, MaterialCatalogRow } from "./types.ts";

const CATALOG: MaterialCatalogRow = {
  id: "mcat_1",
  project_id: "prj_1",
  name: "Laterite",
  normalized_name: "laterite",
  unit: "m3",
  low_stock_threshold: null,
  active: true,
  created_by_id: "usr_1",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  reorder_quantity: null,
  lead_time_days: null,
  preferred_supplier_id: null,
  preferred_supplier_name: null,
  auto_reorder_enabled: false,
};

function entryRow(input: PostEntryInput): LedgerEntryRow {
  return {
    id: input.id,
    project_id: input.projectId,
    idempotency_key: input.idempotencyKey,
    entry_type: input.entryType,
    status: "Posted",
    material_id: input.materialId,
    material_name_snapshot: input.materialName,
    unit_snapshot: input.unit,
    location_key: input.locationKey,
    stage_id: input.stageId,
    stage_name: null,
    approval_status: input.approvalStatus,
    approved_by_id: null,
    approved_by_name: null,
    approved_at: null,
    quantity: String(input.quantity),
    stock_delta: String(input.stockDelta),
    occurred_at: input.occurredAt,
    timestamp_suspect: input.timestampSuspect,
    negative_stock: false,
    logged_by_id: input.loggedById,
    logged_by_name: null,
    material_order_id: input.materialOrderId,
    task_id: input.taskId,
    activity_id: input.activityId,
    reversal_for_entry_id: input.reversalForEntryId,
    reason: input.reason,
    notes_html: input.notesHtml,
    supplier: input.supplier,
    delivery_note: input.deliveryNote,
    self_approved: false,
    created_at: "2026-11-21T00:00:00.000Z",
  };
}

function fakeRepo() {
  const posted: PostEntryInput[] = [];
  const rows = new Map<string, LedgerEntryRow>();
  const repository = {
    findOrCreateCatalog: async () => CATALOG,
    postEntry: async (input: PostEntryInput) => {
      posted.push(input);
      rows.set(input.id, entryRow(input));
      return { entryId: input.id, duplicate: false, negativeStock: false, onHandQty: input.quantity };
    },
    findEntryById: async (id: string) => rows.get(id),
    listFilesForEntries: async () => [],
    listEntries: async () => [...rows.values()],
    listStock: async () => [],
    listCatalog: async () => [CATALOG],
    findCatalogById: async () => CATALOG,
    updateCatalogPolicy: async () => CATALOG,
    approveEntry: async () => null,
  } as unknown as MaterialsLedgerRepository;
  return { repository, posted };
}

test("a receipt raised from a signed delivery note carries the supplier, DN and date", async () => {
  const fake = fakeRepo();
  const service = materialsLedgerService(fake.repository);

  const result = await service.logEntry(
    "prj_1",
    {
      entryType: "IN",
      materialName: "Laterite",
      unit: "m3",
      quantity: 1800,
      stageId: "stg_1",
      occurredAt: "2026-11-21",
      materialOrderId: "mo_1",
      supplier: "Ogun Quarries",
      deliveryNote: "DN-4471",
      approvalStatus: "Approved",
    },
    "usr_1",
  );

  const posted = fake.posted[0];
  assert.equal(posted?.supplier, "Ogun Quarries");
  assert.equal(posted?.deliveryNote, "DN-4471");
  assert.equal(posted?.occurredAt, "2026-11-21");
  assert.equal(posted?.materialOrderId, "mo_1");
  assert.equal(posted?.stageId, "stg_1");
  // The goods-received event is already a fact, so the receipt is accepted.
  assert.equal(posted?.approvalStatus, "Approved");
  assert.equal(posted?.stockDelta, 1800);
  assert.equal(result.entry.supplier, "Ogun Quarries");
  assert.equal(result.entry.deliveryNote, "DN-4471");
  assert.equal(result.entry.selfApproved, false);
});

test("an entry typed straight into the log is still a claim awaiting a checker", async () => {
  const fake = fakeRepo();
  const service = materialsLedgerService(fake.repository);
  await service.logEntry(
    "prj_1",
    { entryType: "USED", materialName: "Laterite", unit: "m3", quantity: 120 },
    "usr_1",
  );
  assert.equal(fake.posted[0]?.approvalStatus, "Pending");
  assert.equal(fake.posted[0]?.stockDelta, -120);
  assert.equal(fake.posted[0]?.supplier, null);
});
