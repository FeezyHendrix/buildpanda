import type { Knex } from "knex";
import type {
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupAuthorRow,
  MarkupLinkRow,
  MarkupVersionRow,
} from "./types.ts";

export function drawingMarkupRepository(db: Knex) {
  return {
    listByVersion: (documentVersionId: string, pageNo?: number): Promise<DrawingMarkupRow[]> =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ document_version_id: documentVersionId })
        .modify((q) => {
          if (pageNo !== undefined) q.where({ page_no: pageNo });
        })
        .orderBy("created_at", "asc"),

    listByDocument: (documentId: string) =>
      db<DrawingMarkupRow>("drawing_markups")
        .where({ document_id: documentId })
        .orderBy("created_at", "asc"),

    byId: (id: string) => db<DrawingMarkupRow>("drawing_markups").where({ id }).first(),

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

    commentsForMarkups: (markupIds: readonly string[]) =>
      markupIds.length === 0
        ? Promise.resolve([])
        : db<DrawingMarkupCommentRow>("drawing_markup_comments")
            .whereIn("markup_id", markupIds)
            .orderBy("created_at", "asc"),

    insertComment: (row: DrawingMarkupCommentRow) =>
      db<DrawingMarkupCommentRow>("drawing_markup_comments").insert(row),

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
        .whereNull("resolved_at")
        .groupBy("document_id")
        .select("document_id")
        .count("id as count"),
  };
}

export type DrawingMarkupRepository = ReturnType<typeof drawingMarkupRepository>;
