import { test } from "node:test";
import assert from "node:assert/strict";
import type { NotificationType } from "../notifications/types.ts";
import { approvalsService } from "./service.ts";
import type { ApprovalsRepository, ApprovalUpdatePatch, NewApprovalRecord } from "./repository.ts";
import type { ApprovalCommentRow, ApprovalRow } from "./types.ts";

interface NotifyCall {
  userId: string;
  type: NotificationType;
  input: {
    title: string;
    body: string;
    projectId?: string | null;
  };
}

const BASE_ROW: ApprovalRow = {
  id: "apr_1",
  project_id: "proj_1",
  kind: "client",
  title: "Roof tile sample",
  category: "Materials",
  description: "Please approve the sample.",
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

function approvalRepository(initial: ApprovalRow = BASE_ROW): ApprovalsRepository {
  let row: ApprovalRow = initial;
  return {
    async listByProject() {
      return [row];
    },
    async findById(id: string) {
      return id === row.id ? row : undefined;
    },
    async commentCounts(ids: string[]) {
      return new Map(ids.map((id) => [id, 0]));
    },
    async create(record: NewApprovalRecord) {
      row = {
        ...BASE_ROW,
        id: record.id,
        project_id: record.project_id,
        title: record.title,
        category: record.category,
        description: record.description,
        description_html: record.description_html,
        status: record.status,
        due_date: record.due_date,
        submitted_by_id: record.submitted_by_id,
        requested_reviewer_id: record.requested_reviewer_id,
      };
      return row;
    },
    async update(id: string, patch: ApprovalUpdatePatch) {
      if (id !== row.id) return undefined;
      row = { ...row, ...patch };
      return row;
    },
    async remove() {},
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
  notifications: { notify: (userId: string, type: NotificationType, input: NotifyCall["input"]) => Promise<void> };
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

test("create notifies the requested reviewer", async () => {
  const recorder = notificationRecorder();
  const service = approvalsService(approvalRepository(), { notifications: recorder.notifications });

  await service.create(
    "proj_1",
    { title: "Roof tile sample", requestedReviewerId: "reviewer_1" },
    "requester_1",
  );

  assert.deepEqual(recorder.calls, [
    {
      userId: "reviewer_1",
      type: "approval_requested",
      input: {
        title: "An approval needs your decision",
        body: "Roof tile sample",
        projectId: "proj_1",
      },
    },
  ]);
});

test("update notifies a newly assigned reviewer only", async () => {
  const recorder = notificationRecorder();
  const service = approvalsService(approvalRepository(), { notifications: recorder.notifications });

  await service.update("proj_1", "apr_1", { requestedReviewerId: "reviewer_1" }, "requester_1");
  await service.update("proj_1", "apr_1", { requestedReviewerId: "reviewer_1" }, "requester_1");
  await service.update("proj_1", "apr_1", { requestedReviewerId: "reviewer_2" }, "requester_1");

  assert.equal(recorder.calls.length, 2);
  assert.equal(recorder.calls[0]?.userId, "reviewer_1");
  assert.equal(recorder.calls[1]?.userId, "reviewer_2");
});

test("reviewer assignment does not notify the actor", async () => {
  const recorder = notificationRecorder();
  const service = approvalsService(approvalRepository(), { notifications: recorder.notifications });

  await service.create(
    "proj_1",
    { title: "Self-reviewed sample", requestedReviewerId: "requester_1" },
    "requester_1",
  );

  assert.deepEqual(recorder.calls, []);
});
