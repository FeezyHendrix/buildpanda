import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { NotificationType } from "../notifications/types.ts";
import { materialApprovalsService } from "./material-service.ts";
import type {
  MaterialApprovalDetailPatch,
  MaterialApprovalsRepository,
  NewMaterialApprovalDetailRecord,
  NewMaterialApprovalRecord,
} from "./material-repository.ts";
import type { MaterialApprovalJoinedRow } from "./material-types.ts";
import type { ApprovalUpdatePatch } from "./repository.ts";
import type { ApprovalCommentRow, ApprovalRow } from "./types.ts";

interface NotifyCall {
  userId: string;
  type: NotificationType;
  input: { title: string; body: string; projectId?: string | null };
}

const CLIENT_ROW: ApprovalRow = {
  id: "apr_client",
  project_id: "proj_1",
  kind: "client",
  title: "Kitchen tile selection",
  category: null,
  description: null,
  description_html: null,
  status: "Pending",
  response: null,
  response_html: null,
  due_date: null,
  submitted_by_id: "requester_1",
  requested_reviewer_id: null,
  requested_reviewer_name: null,
  reviewed_by_id: null,
  reviewed_by_name: null,
  reviewed_at: null,
  created_at: "2026-09-07T10:00:00.000Z",
  updated_at: "2026-09-07T10:00:00.000Z",
};

const MATERIAL_ROW: ApprovalRow = {
  ...CLIENT_ROW,
  id: "apr_material",
  kind: "material",
  title: "Grade 42.5 cement",
};

interface FakeStore {
  approvals: ApprovalRow[];
  details: Map<string, MaterialApprovalJoinedRow>;
}

function joinedDetail(record: NewMaterialApprovalDetailRecord): MaterialApprovalJoinedRow {
  return {
    approval_id: record.approval_id,
    material_name: record.material_name,
    specification: record.specification,
    quantity: record.quantity,
    unit: record.unit,
    supplier: record.supplier,
    needed_by: record.needed_by,
    phase_id: record.phase_id,
    activity_id: record.activity_id,
    phase_name: null,
    activity_name: null,
  };
}

/**
 * Fakes the `approvals` table as one shared array holding both kinds, so a
 * repository that forgets to filter on kind fails these tests the way the real
 * database would leak rows across the two route surfaces.
 */
function fakeStore(): FakeStore {
  return { approvals: [CLIENT_ROW, MATERIAL_ROW], details: new Map() };
}

function materialRepository(store: FakeStore): MaterialApprovalsRepository {
  const ofKind = (): ApprovalRow[] => store.approvals.filter((r) => r.kind === "material");
  return {
    async listByProject(projectId, status) {
      return ofKind().filter(
        (r) => r.project_id === projectId && (!status || r.status === status),
      );
    },
    async findById(id) {
      return ofKind().find((r) => r.id === id);
    },
    async detailsFor(ids: string[]) {
      return new Map(
        ids.flatMap((id) => {
          const row = store.details.get(id);
          return row ? ([[id, row]] as [string, MaterialApprovalJoinedRow][]) : [];
        }),
      );
    },
    async commentCounts(ids: string[]) {
      return new Map(ids.map((id) => [id, 0]));
    },
    async create(approval: NewMaterialApprovalRecord, details: NewMaterialApprovalDetailRecord) {
      const row: ApprovalRow = {
        ...MATERIAL_ROW,
        id: approval.id,
        project_id: approval.project_id,
        kind: "material",
        title: approval.title,
        description: approval.description,
        description_html: approval.description_html,
        status: approval.status,
        due_date: approval.due_date,
        submitted_by_id: approval.submitted_by_id,
        requested_reviewer_id: approval.requested_reviewer_id,
      };
      store.approvals.push(row);
      store.details.set(details.approval_id, joinedDetail(details));
      return row;
    },
    async update(id: string, patch: ApprovalUpdatePatch, detailPatch: MaterialApprovalDetailPatch) {
      const index = store.approvals.findIndex((r) => r.id === id && r.kind === "material");
      if (index === -1) return undefined;
      const current = store.approvals[index];
      if (!current) return undefined;
      const next = { ...current, ...patch };
      store.approvals[index] = next;
      const detail = store.details.get(id);
      if (detail) store.details.set(id, { ...detail, ...detailPatch });
      return next;
    },
    async remove(id: string) {
      store.approvals = store.approvals.filter((r) => !(r.id === id && r.kind === "material"));
    },
    async listComments() {
      return [];
    },
    async addComment(record: ApprovalCommentRow) {
      return record;
    },
  };
}

function notificationRecorder(): {
  calls: NotifyCall[];
  notifications: {
    notify: (userId: string, type: NotificationType, input: NotifyCall["input"]) => Promise<void>;
  };
} {
  const calls: NotifyCall[] = [];
  return {
    calls,
    notifications: {
      async notify(userId, type, input) {
        calls.push({ userId, type, input });
      },
    },
  };
}

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
