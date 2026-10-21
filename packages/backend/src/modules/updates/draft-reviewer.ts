import type { NotifyInput } from "../notifications/service.ts";

export interface DraftReviewProject {
  owner_id: string | null;
}

export interface DraftReviewNotifier {
  notify(userId: string, type: "update_draft_ready", input: NotifyInput): Promise<void>;
}

/**
 * A generated update is a proposal. Its project owner is the accountable
 * reviewer by default, so a draft alert never becomes an organisation-wide
 * broadcast merely because someone can access the project.
 */
export async function notifyDraftReviewer(
  notifications: DraftReviewNotifier,
  project: DraftReviewProject,
  input: NotifyInput,
): Promise<void> {
  if (!project.owner_id) return;
  await notifications.notify(project.owner_id, "update_draft_ready", input);
}
