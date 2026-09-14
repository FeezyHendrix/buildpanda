import { test } from "node:test";
import assert from "node:assert/strict";
import { materialApprovalsService } from "./material-service.ts";
import { fakeStore, materialRepository, notificationRecorder } from "./material-approvals.fixtures.ts";

test("a decided request cannot be edited — the decision refers to what was submitted", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));
  const created = await service.create(
    "proj_1",
    { title: "Laterite LAT-OQ-001", materialName: "Laterite", specification: "CBR 30% min" },
    "requester_1",
  );
  await service.update(
    "proj_1",
    created.id,
    { status: "Rejected", response: "CBR 18% — fails the specification" },
    "reviewer_1",
  );

  await assert.rejects(
    service.update("proj_1", created.id, { specification: "CBR 25% min" }, "requester_1"),
    /cannot be changed/i,
  );
  await assert.rejects(
    service.update("proj_1", created.id, { status: "Pending" }, "requester_1"),
    /cannot be changed/i,
  );
  assert.equal(store.details.get(created.id)?.specification, "CBR 30% min");
});

test("an approved request is equally read-only", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));
  const created = await service.create(
    "proj_1",
    { title: "Crushed stone", materialName: "Crushed stone 0/20" },
    "requester_1",
  );
  await service.update("proj_1", created.id, { status: "Approved" }, "reviewer_1");
  await assert.rejects(
    service.update("proj_1", created.id, { title: "Crushed stone (revised)" }, "requester_1"),
    /cannot be changed/i,
  );
});

test("resubmitting clones the material detail into a new Pending request linked to the old one", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));
  const original = await service.create(
    "proj_1",
    {
      title: "Laterite LAT-OQ-001",
      materialName: "Laterite",
      specification: "CBR 30% min",
      quantity: 3000,
      unit: "m3",
      supplier: "Ogun Quarries",
      neededBy: "2026-11-16",
      requestedReviewerId: "reviewer_1",
    },
    "requester_1",
  );
  await service.update("proj_1", original.id, { status: "Rejected" }, "reviewer_1");

  const resubmission = await service.resubmit(
    "proj_1",
    original.id,
    { specification: "CBR 32% — second borrow pit, cert LAT-OQ-002" },
    "requester_1",
  );

  assert.equal(resubmission.status, "Pending");
  assert.equal(resubmission.resubmittedFromId, original.id);
  assert.notEqual(resubmission.id, original.id);
  assert.match(resubmission.title, /resubmission/i);
  assert.equal(resubmission.materialName, "Laterite");
  assert.equal(resubmission.quantity, 3000);
  assert.equal(resubmission.supplier, "Ogun Quarries");
  assert.equal(resubmission.specification, "CBR 32% — second borrow pit, cert LAT-OQ-002");
  assert.equal(resubmission.requestedReviewerId, "reviewer_1");
  assert.equal(resubmission.submittedById, "requester_1");

  // The decided record is untouched.
  const decided = await service.get("proj_1", original.id);
  assert.equal(decided.status, "Rejected");
  assert.equal(decided.specification, "CBR 30% min");
});

test("a request still awaiting a decision has nothing to resubmit", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));
  const created = await service.create(
    "proj_1",
    { title: "Bitumen", materialName: "60/70 bitumen" },
    "requester_1",
  );
  await assert.rejects(
    service.resubmit("proj_1", created.id, {}, "requester_1"),
    /still awaiting a decision/i,
  );
});

test("a resubmission notifies the reviewer it is aimed at", async () => {
  const recorder = notificationRecorder();
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store), {
    notifications: recorder.notifications,
  });
  const original = await service.create(
    "proj_1",
    { title: "Laterite", materialName: "Laterite", requestedReviewerId: "reviewer_1" },
    "requester_1",
  );
  await service.update("proj_1", original.id, { status: "Rejected" }, "reviewer_1");
  recorder.calls.length = 0;

  await service.resubmit("proj_1", original.id, {}, "requester_1");
  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0]?.userId, "reviewer_1");
});
