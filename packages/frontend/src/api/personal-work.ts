import { participantsApi } from "./participants";
import { taskApi } from "./tasks";
import { approvalsApi } from "./approvals";
import { rfisApi } from "./rfis";
import { canViewResource } from "@/lib/project-types";

export interface WorkItem {
  id: string;
  title: string;
  kind: string;
  dueDate: string | null;
  to: string;
}

export const personalWorkApi = {
  async list(projectId: string, userId: string): Promise<WorkItem[]> {
    const access = await participantsApi.getAccess(projectId);
    const [board, approvals, rfis] = await Promise.all([
      canViewResource(access, "tasks") ? taskApi.board(projectId, "assigned") : null,
      canViewResource(access, "approvals") && access.capabilities.canDecideApprovals ? approvalsApi.list(projectId, { status: "Pending" }) : [],
      canViewResource(access, "rfis") ? rfisApi.list(projectId) : [],
    ]);
    const finished = new Set(board?.columns.filter(column => /^(done|completed)$/i.test(column.status ?? "")).map(column => column.id));
    const root = `/project/${projectId}`;
    return [
      ...(board?.tasks ?? []).filter(task => !finished.has(task.columnId)).map(task => ({
        id: task.id, title: task.title, kind: "Your task", dueDate: task.dueDate, to: `${root}/tasks?task=${task.id}`,
      })),
      ...approvals.filter(approval => approval.requestedReviewerId === userId).map(approval => ({
        id: approval.id, title: approval.title, kind: "Your decision", dueDate: approval.dueDate, to: `${root}/approvals?approval=${approval.id}`,
      })),
      ...rfis.filter(rfi => rfi.ballInCourtId === userId && (rfi.status === "Open" || rfi.status === "InReview")).map(rfi => ({
        id: rfi.id, title: rfi.subject, kind: "Your response", dueDate: rfi.dueDate, to: `${root}/rfis?rfi=${rfi.id}`,
      })),
    ];
  },
};
