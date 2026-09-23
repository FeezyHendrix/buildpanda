import type { Knex } from "knex";
import type {
  CommentAuthorRow,
  CommentPatch,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupAuthorRow,
  MarkupLinkRow,
  MarkupPatch,
  MarkupVersionRow,
} from "./types.ts";

export function drawingMarkupRepository(db: Knex) {
  return {
    listByVersion: (documentVersionId: string, pageNo?: number): Promise<DrawingMarkupRow[]> =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ document_version_id: documentVersionId })
        .whereNull("deleted_at")
        .modify((q) => {
          if (pageNo !== undefined) q.where({ page_no: pageNo });
        })
        .orderBy("created_at", "asc"),

    listByDocument: (documentId: string) =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ document_id: documentId })
        .whereNull("deleted_at")
        .orderBy("created_at", "asc"),

    listBySession: (preconSessionId: string, preconSheetId?: string): Promise<DrawingMarkupRow[]> =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ precon_session_id: preconSessionId })
        .whereNull("deleted_at")
        .modify((q) => {
          if (preconSheetId !== undefined) q.where({ precon_sheet_id: preconSheetId });
        })
        .orderBy("created_at", "asc"),

    listBySessionIncludeDeleted: (
      preconSessionId: string,
      preconSheetId?: string,
    ): Promise<DrawingMarkupRow[]> =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ precon_session_id: preconSessionId })
        .modify((q) => {
          if (preconSheetId !== undefined) q.where({ precon_sheet_id: preconSheetId });
        })
        .orderBy("created_at", "asc"),

    byId: (id: string) => db<DrawingMarkupRow>("drawing_markups").where({ id }).first(),

    markupVersionsByIds: (ids: readonly string[]): Promise<{ id: string; version: number | null }[]> =>
      ids.length === 0
        ? Promise.resolve([])
        : db<DrawingMarkupRow>("drawing_markups").whereIn("id", ids).select("id", "version"),

    insertMarkup: (row: DrawingMarkupRow) => db<DrawingMarkupRow>("drawing_markups").insert(row),

    deleteMarkup: (id: string) => db<DrawingMarkupRow>("drawing_markups").where({ id }).del(),

    resolveMarkup: (id: string, userId: string | null, resolved: boolean) =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ id })
        .update({
          resolved_at: resolved ? new Date() : null,
          resolved_by_id: resolved ? userId : null,
          updated_at: new Date(),
        }),

    // The version in the WHERE is the whole concurrency check: no row comes back
    // when someone else has already moved this markup, and nothing was written.
    updateMarkup: async (id: string, patch: MarkupPatch): Promise<DrawingMarkupRow | null> => {
      const { version, ...fields } = patch;
      const rows = await db<DrawingMarkupRow>("drawing_markups")
        .where({ id, version })
        .whereNull("deleted_at")
        .update({ ...fields, version: version + 1, updated_at: new Date() })
        .returning("*");
      return rows[0] ?? null;
    },

    softDeleteMarkup: async (
      id: string,
      deletedAt: Date,
      version: number,
    ): Promise<DrawingMarkupRow | null> => {
      const rows = await db<DrawingMarkupRow>("drawing_markups")
        .where({ id, version })
        .whereNull("deleted_at")
        .update({ deleted_at: deletedAt, version: version + 1, updated_at: new Date() })
        .returning("*");
      return rows[0] ?? null;
    },

    restoreMarkup: async (id: string, version: number): Promise<DrawingMarkupRow | null> => {
      const rows = await db<DrawingMarkupRow>("drawing_markups")
        .where({ id, version })
        .whereNotNull("deleted_at")
        .update({ deleted_at: null, version: version + 1, updated_at: new Date() })
        .returning("*");
      return rows[0] ?? null;
    },

    commentsForMarkups: (markupIds: readonly string[]) =>
      markupIds.length === 0
        ? Promise.resolve([])
        : db<DrawingMarkupCommentRow>("drawing_markup_comments")
            .whereIn("markup_id", markupIds)
            .whereNull("deleted_at")
            .orderBy("created_at", "asc"),

    commentById: (id: string) =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments").where({ id }).first(),

    /** Authors in the order they spoke — the first is the one who opened the thread. */
    commentAuthorsForMarkup: (markupId: string): Promise<CommentAuthorRow[]> =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments")
        .where({ markup_id: markupId })
        .whereNull("deleted_at")
        .orderBy("created_at", "asc")
        .select("id", "created_by_id"),

    insertComment: (row: DrawingMarkupCommentRow) =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments").insert(row),

    updateComment: async (id: string, patch: CommentPatch): Promise<DrawingMarkupCommentRow | null> => {
      const { version, ...fields } = patch;
      const rows = await db<DrawingMarkupCommentRow>("drawing_markup_comments")
        .where({ id, version })
        .whereNull("deleted_at")
        .update({ ...fields, version: version + 1, updated_at: new Date() })
        .returning("*");
      return rows[0] ?? null;
    },

    softDeleteCommentsForMarkup: (markupId: string, deletedAt: Date) =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments")
        .where({ markup_id: markupId })
        .whereNull("deleted_at")
        .update({ deleted_at: deletedAt, updated_at: new Date() }),

    // Only the comments withdrawn in the SAME act, matched on the timestamp the
    // withdrawal stamped them with. Restoring every deleted comment on the pin
    // resurrects ones somebody took down separately, weeks earlier — words
    // nobody chose to bring back reappearing on a contractual record.
    restoreCommentsForMarkup: (markupId: string, deletedAt: Date) =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments")
        .where({ markup_id: markupId, deleted_at: deletedAt })
        .update({ deleted_at: null, updated_at: new Date() }),

    markupById: (id: string): PromiseLike<DrawingMarkupRow | undefined> =>
      db<DrawingMarkupRow>("drawing_markups").where({ id }).first(),

    commentsForMarkupIncludeDeleted: (markupId: string): PromiseLike<DrawingMarkupCommentRow[]> =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments").where({ markup_id: markupId }).orderBy("created_at", "asc"),

    usersByIds: (userIds: readonly string[]) =>
      userIds.length === 0
        ? Promise.resolve([])
        : db<MarkupAuthorRow>("user").whereIn("id", userIds).select("id", "name"),

    versionById: (versionId: string) =>
      db<MarkupVersionRow>("document_versions")
        .where({ id: versionId })
        .select("id", "document_id", "revision_label")
        .first(),

    currentVersionIdForDocument: (documentId: string) =>
      db<{ current_version_id: string | null }>("project_documents")
        .where({ id: documentId })
        .select("current_version_id")
        .first(),

    rfiLinksForMarkups: (markupIds: readonly string[]) =>
      markupIds.length === 0
        ? Promise.resolve([])
        : db<MarkupLinkRow>("rfis")
            .whereIn("source_markup_id", markupIds)
            .select("id", "source_markup_id"),

    approvalLinksForMarkups: (markupIds: readonly string[]) =>
      markupIds.length === 0
        ? Promise.resolve([])
        : db<MarkupLinkRow>("approvals")
            .whereIn("source_markup_id", markupIds)
            .select("id", "source_markup_id"),

    openCountsByDocument: (projectId: string) =>
      db<{ document_id: string; count: string }>("drawing_markups")
        .where({ project_id: projectId })
        .whereNull("deleted_at")
        .whereNull("resolved_at")
        .groupBy("document_id")
        .select("document_id")
        .count("id as count"),
  };
}

export type DrawingMarkupRepository = ReturnType<typeof drawingMarkupRepository>;
