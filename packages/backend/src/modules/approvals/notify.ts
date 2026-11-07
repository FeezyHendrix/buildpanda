import type { DocumentsService } from "../documents/service.ts";
import type { FilesService } from "../files/service.ts";
import type { NotificationsService } from "../notifications/service.ts";

export interface ApprovalsDeps {
  notifications?: Pick<NotificationsService, "notify">;
  files?: Pick<FilesService, "findRows" | "presignViewUrl">;
  documents?: Pick<DocumentsService, "resolveVersionFile">;
}

const link = (projectId: string, approvalId: string) => `/project/${projectId}/approvals?approval=${approvalId}`;

export function notifyApprovalDecided(
  deps: ApprovalsDeps,
  submitterId: string | null | undefined,
  projectId: string,
  title: string,
  status: string,
  actorId: string,
  approvalId?: string,
): void {
  if (!deps.notifications || !submitterId || submitterId === actorId) return;
  const heading =
    status === "Approved" ? "Approval request approved"
    : status === "Resubmit" ? "Changes requested on your approval request"
    : `Approval request ${status.toLowerCase()}`;
  void deps.notifications
    .notify(submitterId, "approval_decided", { title: heading, body: title, projectId, ...(approvalId ? { ctaUrl: link(projectId, approvalId) } : {}) })
    .catch(() => undefined);
}

/** "Needs your decision", to the named reviewer or to everyone who may decide. */
export function notifyApprovalRequested(
  deps: ApprovalsDeps,
  recipientIds: string[],
  projectId: string,
  approval: { id: string; title: string; dueDate: string | null; attachmentCount: number; resubmitted?: boolean },
  actorId: string,
): void {
  if (!deps.notifications) return;
  const parts = [approval.title];
  if (approval.dueDate) parts.push(`decision needed by ${approval.dueDate.slice(0, 10)}`);
  if (approval.attachmentCount > 0) parts.push(`${approval.attachmentCount} attachment${approval.attachmentCount === 1 ? "" : "s"}`);
  for (const id of new Set(recipientIds)) {
    if (id === actorId) continue;
    void deps.notifications
      .notify(id, "approval_requested", {
        title: approval.resubmitted ? "An approval request was resubmitted" : "An approval needs your decision",
        body: parts.join(" · "),
        projectId,
        ctaUrl: link(projectId, approval.id),
      })
      .catch(() => undefined);
  }
}

/** Single named reviewer, no approval link (material approvals). */
export function notifyApprovalReviewer(deps: ApprovalsDeps, reviewerId: string | null | undefined, projectId: string, title: string, actorId: string): void {
  if (!deps.notifications || !reviewerId || reviewerId === actorId) return;
  void deps.notifications
    .notify(reviewerId, "approval_requested", { title: "An approval needs your decision", body: title, projectId })
    .catch(() => undefined);
}
