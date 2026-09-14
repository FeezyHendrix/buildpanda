/**
 * Shared fake for both material-approval suites. The `approvals` table is one
 * array holding both kinds, so a repository that forgets to filter on kind
 * fails these tests the way the real database would leak rows.
 */
import type { NotificationType } from "../notifications/types.ts";
import type {
  MaterialApprovalDetailPatch,
  MaterialApprovalsRepository,
  NewMaterialApprovalDetailRecord,
  NewMaterialApprovalRecord,
} from "./material-repository.ts";
import type { MaterialApprovalJoinedRow, MaterialApprovalRow } from "./material-types.ts";
import type { ApprovalUpdatePatch } from "./repository.ts";
import type { ApprovalCommentRow } from "./types.ts";

export interface NotifyCall {
  userId: string;
  type: NotificationType;
  input: { title: string; body: string; projectId?: string | null };
}

const CLIENT_ROW: MaterialApprovalRow = {
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
  resubmitted_from_id: null,
  created_at: "2026-09-07T10:00:00.000Z",
  updated_at: "2026-09-07T10:00:00.000Z",
};

const MATERIAL_ROW: MaterialApprovalRow = {
  ...CLIENT_ROW,
  id: "apr_material",
  kind: "material",
  title: "Grade 42.5 cement",
};

export interface FakeStore {
  approvals: MaterialApprovalRow[];
  details: Map<string, MaterialApprovalJoinedRow>;
}

export function joinedDetail(record: NewMaterialApprovalDetailRecord): MaterialApprovalJoinedRow {
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
export function fakeStore(): FakeStore {
  return { approvals: [CLIENT_ROW, MATERIAL_ROW], details: new Map() };
}

export function materialRepository(store: FakeStore): MaterialApprovalsRepository {
  const ofKind = (): MaterialApprovalRow[] => store.approvals.filter((r) => r.kind === "material");
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
      const row: MaterialApprovalRow = {
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
        resubmitted_from_id: approval.resubmitted_from_id,
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

export function notificationRecorder(): {
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
