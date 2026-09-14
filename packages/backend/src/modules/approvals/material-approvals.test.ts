import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { materialApprovalsService } from "./material-service.ts";
import { fakeStore, materialRepository, notificationRecorder } from "./material-approvals.fixtures.ts";

test("creating a material approval persists the approval and its material details", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));

  const created = await service.create(
    "proj_1",
    {
      title: "Grade 42.5 cement",
      materialName: "Portland cement 42.5N",
      specification: "BS EN 197-1 CEM II/B-L 42.5N",
      quantity: 400,
      unit: "bag",
      supplier: "Dangote Cement",
      neededBy: "2026-10-01",
    },
    "requester_1",
  );

  assert.equal(created.kind, "material");
  assert.equal(created.status, "Pending");
  assert.equal(created.submittedById, "requester_1");
  assert.equal(created.materialName, "Portland cement 42.5N");
  assert.equal(created.specification, "BS EN 197-1 CEM II/B-L 42.5N");
  assert.equal(created.quantity, 400);
  assert.equal(created.unit, "bag");
  assert.equal(created.supplier, "Dangote Cement");
  assert.equal(created.neededBy, "2026-10-01");

  const persisted = store.details.get(created.id);
  assert.equal(persisted?.material_name, "Portland cement 42.5N");
  assert.equal(persisted?.quantity, 400);
});

test("creating a material approval notifies the requested reviewer", async () => {
  const recorder = notificationRecorder();
  const service = materialApprovalsService(materialRepository(fakeStore()), {
    notifications: recorder.notifications,
  });

  await service.create(
    "proj_1",
    { title: "Grade 42.5 cement", materialName: "Portland cement", requestedReviewerId: "reviewer_1" },
    "requester_1",
  );

  assert.deepEqual(recorder.calls, [
    {
      userId: "reviewer_1",
      type: "approval_requested",
      input: {
        title: "An approval needs your decision",
        body: "Grade 42.5 cement",
        projectId: "proj_1",
      },
    },
  ]);
});

test("listing material approvals excludes client approvals", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));

  const rows = await service.list("proj_1");

  assert.deepEqual(
    rows.map((r) => r.id),
    ["apr_material"],
  );
});

test("deciding a material approval stamps the reviewer, status and timestamp", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));

  const decided = await service.update("proj_1", "apr_material", { status: "Approved" }, "reviewer_1");

  assert.equal(decided.status, "Approved");
  assert.equal(decided.reviewedById, "reviewer_1");
  assert.ok(decided.reviewedAt, "expected reviewed_at to be stamped");
});

test("deciding a material approval notifies the submitter", async () => {
  const recorder = notificationRecorder();
  const service = materialApprovalsService(materialRepository(fakeStore()), {
    notifications: recorder.notifications,
  });

  await service.update("proj_1", "apr_material", { status: "Rejected" }, "reviewer_1");

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0]?.userId, "requester_1");
  assert.equal(recorder.calls[0]?.type, "approval_decided");
});

test("a client approval is not reachable through the material approvals service", async () => {
  const service = materialApprovalsService(materialRepository(fakeStore()));

  await assert.rejects(() => service.get("proj_1", "apr_client"), /not found/i);
  await assert.rejects(
    () => service.update("proj_1", "apr_client", { status: "Approved" }, "reviewer_1"),
    /not found/i,
  );
});

test("amending material details on an existing request updates the detail row", async () => {
  const store = fakeStore();
  const service = materialApprovalsService(materialRepository(store));

  const created = await service.create(
    "proj_1",
    { title: "Rebar", materialName: "Y12 rebar", quantity: 100, unit: "length" },
    "requester_1",
  );
  const updated = await service.update(
    "proj_1",
    created.id,
    { quantity: 150, supplier: "Standard Steel" },
    "requester_1",
  );

  assert.equal(updated.quantity, 150);
  assert.equal(updated.supplier, "Standard Steel");
  assert.equal(updated.materialName, "Y12 rebar");
});

test("the client approvals repository is scoped to kind = 'client'", async () => {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");

  assert.match(source, /\.where\("a\.kind", "client"\)/);
  assert.match(source, /insert\(\{ \.\.\.record, kind: "client" \}\)/);
  assert.match(source, /where\(\{ id, kind: "client" \}\)\.update/);
  assert.match(source, /where\(\{ id, kind: "client" \}\)\.del/);
});

test("material approval routes are guarded by materials permissions, never approvals:*", async () => {
  const source = await readFile(new URL("./material-routes.ts", import.meta.url), "utf8");

  const guards = [...source.matchAll(/requireProjectPermission\(\s*[^)]*?"(\w[\w-]*)",\s*\n?\s*"?/g)];
  assert.ok(guards.length > 0, "expected route guards to be present");

  assert.match(source, /"\/projects\/:id\/material-approvals"[\s\S]*?"materials",\s*"view"/);
  assert.match(source, /"materials",\s*\n?\s*"request",/);
  assert.match(source, /deciding \? "approve" : "request"/);
  assert.match(source, /Only a material approver can reassign the requested reviewer/);
  assert.match(source, /Only pending material approvals can be deleted/);
  assert.doesNotMatch(source, /"approvals",\s*"(view|decide|manage)"/);
});
