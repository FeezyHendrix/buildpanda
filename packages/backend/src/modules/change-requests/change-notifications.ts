import type { NotificationsService } from "../notifications/service.ts";

/**
 * A change moving is news for the person who raised it and for whoever has to
 * act next. The type is specific — "submitted", "approved", "rejected" — so a
 * QS can tell from the bell whether a variation needs pricing or has been
 * turned down, without opening the register.
 */
const DECISION_TYPES = {
  Submitted: { type: "change_request_submitted", title: "A change request was submitted for decision" },
  Approved: { type: "change_request_approved", title: "A change request was approved" },
  Rejected: { type: "change_request_rejected", title: "A change request was rejected" },
} as const;

export type ChangeDecisionStatus = keyof typeof DECISION_TYPES;

export function notifyChangeAssignee(
  notifications: NotificationsService | undefined,
  assigneeId: string | null | undefined,
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!notifications || !assigneeId || assigneeId === actorId) return;
  void notifications
    .notify(assigneeId, "change_request_assigned", {
      title: "A change request was assigned to you",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

export function notifyChangeDecided(
  notifications: NotificationsService | undefined,
  recipientIds: (string | null | undefined)[],
  projectId: string,
  title: string,
  status: ChangeDecisionStatus,
  actorId: string,
  reason: string | null = null,
): void {
  const meta = DECISION_TYPES[status];
  if (!notifications || !meta) return;
  const seen = new Set<string>();
  for (const recipientId of recipientIds) {
    if (!recipientId || recipientId === actorId || seen.has(recipientId)) continue;
    seen.add(recipientId);
    void notifications
      .notify(recipientId, meta.type, {
        title: meta.title,
        body: reason ? `${title} — ${reason}` : title,
        projectId,
      })
      .catch(() => undefined);
  }
}
