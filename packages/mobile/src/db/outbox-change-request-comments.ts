import { eq } from "drizzle-orm";
import { changeRequestsApi } from "@/api/change-requests";
import {
  CHANGE_REQUEST_COMMENTS_RESOURCE,
  changeRequestCommentsRepository,
} from "./change-request-comments-repository";
import type { Db } from "./client";
import { done, skipped, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { changeRequestComments, type OutboxRow } from "./schema";

export { CHANGE_REQUEST_COMMENTS_RESOURCE };

/**
 * Pushes a comment queued against a change request.
 *
 * A comment whose parent is still `local_` waits: the request's own create
 * re-points it to the server id in the same transaction, and the next flush
 * picks it up.
 */
export async function pushChangeRequestCommentOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== CHANGE_REQUEST_COMMENTS_RESOURCE) return skipped;

  const [comment] = await db
    .select()
    .from(changeRequestComments)
    .where(eq(changeRequestComments.id, item.entityId))
    .limit(1);
  if (!comment) return dropItem(db, item);
  if (comment.changeRequestId.startsWith("local_")) return done(false);

  const server = await changeRequestsApi.addComment(item.projectId, comment.changeRequestId, comment.body);
  await changeRequestCommentsRepository.reconcileCreate(db, comment.id, server);
  return finishItem(db, item);
}
