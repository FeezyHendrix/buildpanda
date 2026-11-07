import assert from "node:assert/strict";
import { test } from "node:test";
import type { UploadedFileRow } from "../files/types.ts";
import type { ApproverCandidate, ApprovalsRepository, AttachmentWithFile } from "./repository.ts";
import { approvalsService, type ApprovalProject } from "./service.ts";
import type { ApprovalAttachmentRow, ApprovalDecisionRow, ApprovalRow, ApprovalViewer } from "./types.ts";

const PROJECT: ApprovalProject = { id: "prj_1", ownerId: "usr_owner", organizationId: "org_1", startDate: "2026-01-01" };
const ME = "usr_me";
const viewer = (id: string, canDecide = true): ApprovalViewer => ({ id, canDecide, canOpenFiles: true });

function file(id: string, over: Partial<UploadedFileRow> = {}): UploadedFileRow {
  return {
    id,
    owner_id: ME,
    project_id: PROJECT.id,
    file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 1000,
    storage_path: `/${id}`,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const CANDIDATES: ApproverCandidate[] = [
  { id: "usr_owner", name: "Owner", org_role: "owner", participant_role: null, permissions: null, grants: null },
  { id: "usr_staff", name: "Staff", org_role: "member", participant_role: null, permissions: null, grants: null },
  { id: "usr_viewer", name: "Viewer", org_role: "viewer", participant_role: null, permissions: null, grants: null },
  { id: "usr_client", name: "Client", org_role: null, participant_role: "client", permissions: null, grants: null },
  { id: "usr_eng", name: "Engineer", org_role: null, participant_role: "engineer", permissions: null, grants: null },
  { id: "usr_qs", name: "QS", org_role: null, participant_role: "qs", permissions: null, grants: { approvals: ["view", "decide"] } },
  { id: ME, name: "Me", org_role: "member", participant_role: null, permissions: null, grants: null },
];

function harness(files: UploadedFileRow[], taken: string[] = []) {
  const attachments: ApprovalAttachmentRow[] = [];
  const decisions: ApprovalDecisionRow[] = [];
  const rows: ApprovalRow[] = [];
  const withFile = (a: ApprovalAttachmentRow): AttachmentWithFile =>
    ({ ...a, file: files.find((f) => f.id === a.file_id)!, current_version_id: null }) as AttachmentWithFile;
  const repo: ApprovalsRepository = {
    async create(record: Partial<ApprovalRow>, added: ApprovalAttachmentRow[] = []) {
      attachments.push(...added);
      const row = { ...record, kind: "client", revision: 1, created_at: "2026-02-01T00:00:00Z", updated_at: "now" } as ApprovalRow;
      rows.push(row);
      return row;
    },
    async findById(id: string) {
      return rows.find((r) => r.id === id);
    },
    async update(id: string, patch: Partial<ApprovalRow>, decision?: ApprovalDecisionRow) {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, patch);
      if (decision) decisions.push(decision);
      return row;
    },
    async resubmit(id: string, patch: Partial<ApprovalRow>, added: ApprovalAttachmentRow[], decision: ApprovalDecisionRow) {
      attachments.push(...added);
      return repo.update(id, patch, decision);
    },
    async addAttachments(added: ApprovalAttachmentRow[]) {
      attachments.push(...added);
    },
    async removeAttachments(approvalId: string, ids: string[]) {
      const before = attachments.length;
      for (let i = attachments.length - 1; i >= 0; i -= 1) {
        if (attachments[i]!.approval_id === approvalId && ids.includes(attachments[i]!.id)) attachments.splice(i, 1);
      }
      return before - attachments.length;
    },
    async attachedFileIds(ids: string[], except?: string) {
      return [...taken, ...attachments.filter((a) => a.approval_id !== except).map((a) => a.file_id!)].filter((id) => ids.includes(id));
    },
    async listAttachments(ids: string[]) {
      return attachments.filter((a) => ids.includes(a.approval_id)).map(withFile);
    },
    async listDecisions(id: string) {
      return decisions.filter((d) => d.approval_id === id);
    },
    async listComments() {
      return [];
    },
    async commentCounts() {
      return new Map<string, number>();
    },
    async approverCandidates() {
      return CANDIDATES;
    },
    async remove() {},
  } as unknown as ApprovalsRepository;
  const service = approvalsService(repo, {
    files: {
      async findRows(ids: string[]) {
        return files.filter((f) => ids.includes(f.id));
      },
      async presignViewUrl(row: UploadedFileRow) {
        return `signed:${row.id}`;
      },
    },
  });
  return { service, attachments, decisions };
}

const create = (h: ReturnType<typeof harness>, fileIds: string[], extra: Record<string, unknown> = {}) =>
  h.service.create(PROJECT, { title: "Tiles", attachments: fileIds.map((fileId) => ({ fileId })), ...extra }, ME, viewer(ME));

test("create stores attachments in order and returns them signed", async () => {
  const h = harness([file("f1"), file("f2", { mime_type: "application/pdf" })]);
  const approval = await create(h, ["f1", "f2"]);
  assert.equal(approval.attachmentCount, 2);
  assert.deepEqual(
    approval.attachments.map((a) => [a.fileName, a.url]),
    [
      ["f1.png", "signed:f1"],
      ["f2.png", "signed:f2"],
    ],
  );
  assert.deepEqual(h.attachments.map((a) => a.position), [0, 1]);
});

test("create rejects files the caller cannot attach, before writing anything", async () => {
  const cases: [string, UploadedFileRow[], string[], RegExp][] = [
    ["someone else's file", [file("f1", { owner_id: "usr_other" })], ["f1"], /not one you uploaded/],
    ["another project's file", [file("f1", { project_id: "prj_2" })], ["f1"], /not one you uploaded/],
    ["unknown file", [], ["f9"], /not one you uploaded/],
    ["wrong type", [file("f1", { mime_type: "text/html" })], ["f1"], /only PNG, JPG or PDF/],
    ["too big", [file("f1", { size_bytes: 11 * 1024 * 1024 })], ["f1"], /10 MB/],
    ["duplicate", [file("f1")], ["f1", "f1"], /attached twice/],
    ["too many", [1, 2, 3, 4, 5, 6].map((n) => file(`f${n}`)), [1, 2, 3, 4, 5, 6].map((n) => `f${n}`), /At most 5/],
  ];
  for (const [name, files, ids, message] of cases) {
    const h = harness(files);
    await assert.rejects(create(h, ids), message, name);
    assert.equal(h.attachments.length, 0, `${name}: nothing written`);
  }
  const reused = harness([file("f1")], ["f1"]);
  await assert.rejects(create(reused, ["f1"]), /already attached/);
});

test("create checks the title, the due date and the named reviewer", async () => {
  const h = harness([]);
  await assert.rejects(h.service.create(PROJECT, { title: "   " }, ME, viewer(ME)), /what needs approval/);
  await assert.rejects(create(h, [], { dueDate: "2025-12-31" }), /before the project starts/);
  await assert.rejects(create(h, [], { dueDate: "next week" }), /yyyy-mm-dd/);
  await assert.rejects(create(h, [], { requestedReviewerId: "usr_eng" }), /cannot decide approvals/);
  const ok = await create(h, [], { requestedReviewerId: "usr_client", dueDate: "2026-03-01" });
  assert.equal(ok.requestedReviewerId, "usr_client");
});

test("approvers are the owner, non-viewer staff, the client and anyone granted decide", async () => {
  const h = harness([]);
  const ids = (await h.service.approvers(PROJECT)).map((a) => a.id).sort();
  assert.deepEqual(ids, ["usr_client", "usr_me", "usr_owner", "usr_qs", "usr_staff"]);
});

test("viewerCanDecide follows the reviewer rule", async () => {
  const h = harness([]);
  const approval = await create(h, [], { requestedReviewerId: "usr_client" });
  const as = async (v: ApprovalViewer) => (await h.service.get(PROJECT.id, approval.id, v)).viewerCanDecide;
  assert.equal(await as(viewer("usr_client")), true);
  assert.equal(await as(viewer("usr_staff")), false, "named reviewer excludes other deciders");
  assert.equal(await as(viewer("usr_client", false)), false);
});

test("decisions are recorded, need a note to send back, and lock the record", async () => {
  const h = harness([]);
  const approval = await create(h, []);
  const reviewer = viewer("usr_client");
  await assert.rejects(h.service.update(PROJECT, approval.id, { status: "Rejected" }, "usr_client", reviewer), /note is required/);
  await assert.rejects(h.service.update(PROJECT, approval.id, { status: "Resubmit", response: "  " }, "usr_client", reviewer), /note is required/);
  const approved = await h.service.update(PROJECT, approval.id, { status: "Approved" }, "usr_client", reviewer);
  assert.equal(approved.status, "Approved");
  assert.deepEqual(h.decisions.map((d) => [d.decision, d.revision, d.actor_id]), [["Approved", 1, "usr_client"]]);
  await assert.rejects(h.service.update(PROJECT, approval.id, { title: "Different tiles" }, ME, viewer(ME)), /has been decided/);
  await assert.rejects(h.service.remove(PROJECT.id, approval.id), /cannot be deleted/);
  const detail = await h.service.get(PROJECT.id, approval.id, reviewer);
  assert.equal(detail.decisions.length, 1);
  assert.deepEqual(detail.revisions.map((r) => [r.revision, r.decision]), [[1, "Approved"]]);
});

test("resubmit opens a new revision with replacement files and keeps the old ones on record", async () => {
  const h = harness([file("f1"), file("f2")]);
  const approval = await create(h, ["f1"]);
  await h.service.update(PROJECT, approval.id, { status: "Resubmit", response: "Wrong colour" }, "usr_client", viewer("usr_client"));
  await assert.rejects(h.service.resubmit(PROJECT, approval.id, {}, "usr_other", viewer("usr_other")), /Only the requester/);
  const again = await h.service.resubmit(PROJECT, approval.id, { attachments: [{ fileId: "f2" }] }, ME, viewer(ME));
  assert.equal(again.status, "Pending");
  assert.equal(again.revision, 2);
  assert.deepEqual(again.attachments.map((a) => a.fileName), ["f2.png"]);
  const detail = await h.service.get(PROJECT.id, approval.id, viewer(ME));
  assert.deepEqual(
    detail.revisions.map((r) => [r.revision, r.attachments.map((a) => a.fileName), r.decision, r.decisionNote]),
    [
      [1, ["f1.png"], "Resubmit", "Wrong colour"],
      [2, ["f2.png"], null, null],
    ],
  );
  await assert.rejects(h.service.resubmit(PROJECT, approval.id, {}, ME, viewer(ME)), /changes requested can be resubmitted/);
});

test("attachments change only while pending", async () => {
  const h = harness([file("f1"), file("f2")]);
  const approval = await create(h, ["f1"]);
  const changed = await h.service.changeAttachments(PROJECT, approval.id, { add: [{ fileId: "f2" }], remove: [approval.attachments[0]!.id] }, ME, viewer(ME));
  assert.deepEqual(changed.attachments.map((a) => a.fileName), ["f2.png"]);
  await h.service.update(PROJECT, approval.id, { status: "Approved" }, "usr_client", viewer("usr_client"));
  await assert.rejects(h.service.changeAttachments(PROJECT, approval.id, { add: [{ fileId: "f2" }] }, ME, viewer(ME)), /only change while/);
});
