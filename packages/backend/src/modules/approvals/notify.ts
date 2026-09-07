import type { NotificationsService } from "../notifications/service.ts";

export interface ApprovalsDeps {
  notifications?: Pick<NotificationsService, "notify">;
}

export function notifyApprovalDecided(
  deps: ApprovalsDeps,
  submitterId: string | null | undefined,
  projectId: string,
  title: string,
  status: string,
  actorId: string,
): void {
  if (!deps.notifications || !submitterId || submitterId === actorId) return;
  void deps.notifications
    .notify(submitterId, "approval_decided", {
      title: status === "Approved" ? "Approval Request approved" : `Approval ${status.toLowerCase()}`,
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

export function notifyApprovalReviewer(
  deps: ApprovalsDeps,
  reviewerId: string | null | undefined,
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!deps.notifications || !reviewerId || reviewerId === actorId) return;
  void deps.notifications
    .notify(reviewerId, "approval_requested", {
      title: "An approval needs your decision",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}
