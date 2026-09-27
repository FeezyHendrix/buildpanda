import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { sanitizeRichText } from "../../lib/rich-text.ts";
import { toComment } from "./mappers.ts";
import type {
  CommentAuthorRow,
  DrawingMarkup,
  DrawingMarkupComment,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  EditCommentInput,
  EditMarkupInput,
  MarkupAuditSink,
  MarkupEditingStore,
  MarkupPatch,
} from "./types.ts";

const STALE = "was changed since you loaded it; refresh and retry";

export interface MarkupEditingDeps {
  repo: MarkupEditingStore;
  audit?: MarkupAuditSink;
  loadMarkup(id: string): Promise<DrawingMarkupRow>;
  getMarkup(id: string): Promise<DrawingMarkup>;
}

/**
 * A thread is "replied" once someone other than the person who opened it has
 * spoken: that is a conversation two parties are part of, and withdrawing the
 * pin it hangs on would take the other side's words off the sheet with it.
 */
export function hasRepliedThread(authors: readonly CommentAuthorRow[]): boolean {
  const opener = authors[0];
  if (!opener) return false;
  return authors.some((a) => a.created_by_id !== opener.created_by_id);
}

function markupAuditPayload(row: DrawingMarkupRow): Record<string, unknown> {
  return {
    markupId: row.id,
    geometry: row.geometry,
    color: row.color,
    style: row.style ?? null,
    version: row.version ?? 1,
    deletedAt: row.deleted_at ?? null,
  };
}

function patchFrom(input: EditMarkupInput): MarkupPatch {
  const patch: MarkupPatch = { version: input.version };
  if (input.geometry !== undefined) patch.geometry = input.geometry;
  if (input.color !== undefined) patch.color = input.color;
  if (input.style !== undefined) patch.style = input.style;
  return patch;
}

export function drawingMarkupEditing({ repo, audit, loadMarkup, getMarkup }: MarkupEditingDeps) {
  // Only a take-off pin has a session to file the entry against; a project
  // drawing's redline is audited by the documents module, not this one.
  async function record(
    row: DrawingMarkupRow,
    actor: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    if (!audit || row.precon_session_id === null) return;
    await audit.insertAuditEvent({
      id: generateId("pae"),
      session_id: row.precon_session_id,
      row_id: row.precon_row_id,
      actor,
      action,
      before,
      after,
    });
  }

  /**
   * Somebody speaking after a pin was withdrawn has joined a thread as it now
   * stands. Putting the pin back would fold their words into a discussion they
   * never saw the rest of, so the restore stops and a person decides.
   */
  async function assertDiscussionUnchanged(markupId: string, deletedAt: Date): Promise<void> {
    const since = (await repo.commentsForMarkupIncludeDeleted(markupId)).filter(
      (c) => c.deleted_at === null && new Date(c.created_at).getTime() > new Date(deletedAt).getTime(),
    );
    if (since.length > 0) {
      throw new ConflictError(
        `${since.length} comment${since.length === 1 ? " was" : "s were"} added to this markup after it was withdrawn; ` +
          "restoring it would rewrite a discussion that moved on. Review the replies first.",
      );
    }
  }

  async function loadComment(
    markupId: string,
    commentId: string,
  ): Promise<DrawingMarkupCommentRow> {
    const comment = await repo.commentById(commentId);
    if (!comment || comment.markup_id !== markupId || comment.deleted_at) {
      throw new NotFoundError("Comment");
    }
    return comment;
  }

  return {
    async editMarkup(
      markupId: string,
      userId: string,
      input: EditMarkupInput,
    ): Promise<DrawingMarkup> {
      const before = await loadMarkup(markupId);
      if (before.deleted_at) throw new BadRequestError("Restore this markup before editing it");
      if ((before.version ?? 1) !== input.version) throw new ConflictError(`Markup ${STALE}`);

      const updated = await repo.updateMarkup(markupId, patchFrom(input));
      if (!updated) throw new ConflictError(`Markup ${STALE}`);

      await record(updated, userId, "markup_edit", markupAuditPayload(before), markupAuditPayload(updated));
      return getMarkup(markupId);
    },

    async editComment(
      markupId: string,
      commentId: string,
      userId: string,
      input: EditCommentInput,
    ): Promise<DrawingMarkupComment> {
      const markup = await loadMarkup(markupId);
      const before = await loadComment(markupId, commentId);
      if (before.created_by_id !== userId) {
        throw new ForbiddenError("Only the comment's author can edit it");
      }
      if ((before.version ?? 1) !== input.version) throw new ConflictError(`Comment ${STALE}`);

      const body = input.body.trim();
      if (!body) throw new BadRequestError("Comment body is required");

      const updated = await repo.updateComment(commentId, {
        version: input.version,
        body,
        body_html: sanitizeRichText(input.bodyHtml ?? null),
      });
      if (!updated) throw new ConflictError(`Comment ${STALE}`);

      await record(
        markup,
        userId,
        "markup_comment_edit",
        { commentId, body: before.body, version: before.version ?? 1 },
        { commentId, body: updated.body, version: updated.version ?? 1 },
      );

      const users = await repo.usersByIds(
        [updated.created_by_id, updated.assignee_id].filter((id): id is string => id !== null),
      );
      return toComment(updated, new Map(users.map((u) => [u.id, u.name])));
    },

    async softDeleteMarkup(
      markupId: string,
      userId: string,
      version: number,
    ): Promise<{ ok: true }> {
      const before = await loadMarkup(markupId);
      if (before.deleted_at) return { ok: true };

      // Required, not optional. An omitted version used to mean "delete whatever
      // is there", which is the one thing a withdrawal of evidence may not mean.
      const current = before.version ?? 1;
      if (version !== current) throw new ConflictError(`Markup ${STALE}`);

      if (before.resolved_at === null && hasRepliedThread(await repo.commentAuthorsForMarkup(markupId))) {
        throw new BadRequestError(
          "Cannot delete a markup with unresolved discussion; resolve the thread first",
        );
      }

      const deletedAt = new Date();
      const updated = await repo.softDeleteMarkup(markupId, deletedAt, current);
      if (!updated) throw new ConflictError(`Markup ${STALE}`);
      await repo.softDeleteCommentsForMarkup(markupId, deletedAt);

      await record(updated, userId, "markup_delete", markupAuditPayload(before), markupAuditPayload(updated));
      return { ok: true };
    },

    async restoreMarkup(markupId: string, userId: string): Promise<DrawingMarkup> {
      const before = await loadMarkup(markupId);
      if (!before.deleted_at) return getMarkup(markupId);
      await assertDiscussionUnchanged(markupId, new Date(before.deleted_at));

      const updated = await repo.restoreMarkup(markupId, before.version ?? 1);
      if (!updated) throw new ConflictError(`Markup ${STALE}`);
      await repo.restoreCommentsForMarkup(markupId, new Date(before.deleted_at));

      await record(updated, userId, "markup_restore", markupAuditPayload(before), markupAuditPayload(updated));
      return getMarkup(markupId);
    },
  };
}
