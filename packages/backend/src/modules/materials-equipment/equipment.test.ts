import { test } from "node:test";
import assert from "node:assert/strict";
import { equipmentRequestService } from "./equipment-service.ts";
import { isEquipmentLate } from "./mappers.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import type { EquipmentRequestRow } from "./types.ts";

function dayOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function hireRow(overrides: Partial<EquipmentRequestRow> = {}): EquipmentRequestRow {
  return {
    id: "er_1",
    project_id: "prj_1",
    title: "Motor grader",
    equipment_name: "CAT 140K motor grader",
    equipment_type: "Plant",
    quantity: 1,
    supplier: "Arab Contractors",
    supplier_id: null,
    supplier_name: null,
    status: "OnHire",
    priority: "Normal",
    phase_id: "stg_1",
    phase_name: "Earthworks",
    activity_id: null,
    activity_name: null,
    document_id: null,
    document_name: null,
    requested_by_id: "usr_1",
    needed_from: "2026-10-05",
    needed_until: "2026-10-20",
    mobilized_at: null,
    returned_at: null,
    on_hire_at: "2026-10-05",
    off_hire_at: "2026-10-20",
    plant_ref: "PL-014",
    daily_rate: "600000",
    extensions: [],
    estimated_cost: "9600000",
    actual_cost: "0",
    currency: "NGN",
    delivery_location: null,
    operator_required: "Yes",
    notes: null,
    cancel_reason: null,
    rejected_reason: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function fakeRepo(seed: EquipmentRequestRow = hireRow()) {
  let row = seed;
  const repository = {
    listEquipmentRequests: async () => [row],
    findEquipmentRequest: async (id: string) => (id === row.id ? row : undefined),
    createEquipmentRequest: async (record: Record<string, unknown>) => {
      row = hireRow(record as Partial<EquipmentRequestRow>);
      return row;
    },
    updateEquipmentRequest: async (_id: string, patch: Record<string, unknown>) => {
      row = { ...row, ...patch } as EquipmentRequestRow;
      return row;
    },
    appendHireExtension: async (
      _id: string,
      extensions: EquipmentRequestRow["extensions"],
      patch: Record<string, unknown>,
    ) => {
      row = { ...row, ...patch, extensions } as EquipmentRequestRow;
      return row;
    },
    deleteEquipmentRequest: async () => 1,
  } as unknown as MaterialsEquipmentRepository;
  return { repository, current: () => row };
}

test("returning plant needs the off-hire date it actually came back", async () => {
  const fake = fakeRepo(hireRow({ off_hire_at: null }));
  const service = equipmentRequestService(fake.repository);
  await assert.rejects(
    service.updateEquipmentRequest("prj_1", "er_1", { status: "Returned" }),
    /off-hire date/i,
  );
  const returned = await service.updateEquipmentRequest("prj_1", "er_1", {
    status: "Returned",
    offHireAt: "2026-10-14",
  });
  assert.equal(returned.status, "Returned");
  assert.equal(returned.offHireAt, "2026-10-14");
  assert.equal(returned.returnedAt, "2026-10-14");
});

test("an early return reprices the hire from the rate and the days on hire", async () => {
  const fake = fakeRepo();
  const service = equipmentRequestService(fake.repository);
  const returned = await service.updateEquipmentRequest("prj_1", "er_1", {
    status: "Returned",
    offHireAt: "2026-10-14",
  });
  // 5 Oct to 14 Oct inclusive = 10 days at 600,000.
  assert.equal(returned.hireDays, 10);
  assert.equal(returned.estimatedCost, 6000000);
});

test("extending a hire keeps the original off-hire date in the history", async () => {
  const fake = fakeRepo(hireRow({ needed_until: "2026-12-18", off_hire_at: "2026-12-18" }));
  const service = equipmentRequestService(fake.repository);
  const extended = await service.extendHire(
    "prj_1",
    "er_1",
    { offHireAt: "2027-01-15", reason: "Shoulder works added" },
    "usr_1",
  );
  assert.equal(extended.offHireAt, "2027-01-15");
  assert.equal(extended.extensions.length, 1);
  assert.equal(extended.extensions[0]?.from, "2026-12-18");
  assert.equal(extended.extensions[0]?.to, "2027-01-15");
  assert.equal(extended.extensions[0]?.reason, "Shoulder works added");
  assert.equal(extended.extensions[0]?.actorId, "usr_1");
});

test("an extension must push the date later, and a returned hire cannot be extended", async () => {
  const fake = fakeRepo();
  const service = equipmentRequestService(fake.repository);
  await assert.rejects(
    service.extendHire("prj_1", "er_1", { offHireAt: "2026-10-10" }, "usr_1"),
    /later than it is now/i,
  );
  const returnedFake = fakeRepo(hireRow({ status: "Returned" }));
  await assert.rejects(
    equipmentRequestService(returnedFake.repository).extendHire(
      "prj_1",
      "er_1",
      { offHireAt: "2027-01-15" },
      "usr_1",
    ),
    /cannot be extended/i,
  );
});

test("cancelling or rejecting a hire needs a reason", async () => {
  const fake = fakeRepo(hireRow({ status: "Requested" }));
  const service = equipmentRequestService(fake.repository);
  await assert.rejects(
    service.updateEquipmentRequest("prj_1", "er_1", { status: "Rejected" }),
    /must say why/i,
  );
  const rejected = await service.updateEquipmentRequest("prj_1", "er_1", {
    status: "Rejected",
    reason: "Plant not available in the window",
  });
  assert.equal(rejected.status, "Rejected");
  assert.equal(rejected.rejectedReason, "Plant not available in the window");
  assert.equal(rejected.bucket, "returns");
});

test("a hire wanted before today and not yet on site reads as late", () => {
  assert.equal(isEquipmentLate(hireRow({ needed_from: dayOffset(-12), status: "Requested" })), true);
  assert.equal(isEquipmentLate(hireRow({ needed_from: dayOffset(12), status: "Requested" })), false);
  assert.equal(isEquipmentLate(hireRow({ needed_from: dayOffset(-12), status: "OnHire" })), false);
  assert.equal(isEquipmentLate(hireRow({ needed_from: dayOffset(-12), status: "Returned" })), false);
});
