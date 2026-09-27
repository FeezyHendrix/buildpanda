import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import { GEOMETRY_SPACE } from "./types.ts";
import type {
  DrawingMarkup,
  DrawingMarkupComment,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupGeometry,
} from "./types.ts";

/**
 * A markup written before spaces existed carries none, so its space comes from
 * where it is anchored: a take-off pin has always been in sheet points, which
 * is what keeps it with the measurements at any raster scale, while a project
 * drawing's markup has always been in percent of the rendered sheet.
 */
export function withSpace(geometry: MarkupGeometry, onProjectDrawing: boolean): MarkupGeometry {
  if (geometry.space) return geometry;
  return { ...geometry, space: onProjectDrawing ? GEOMETRY_SPACE.PERCENT : GEOMETRY_SPACE.POINTS };
}

export function toComment(
  row: DrawingMarkupCommentRow,
  names: ReadonlyMap<string, string | null>,
): DrawingMarkupComment {
  return {
    id: row.id,
    markupId: row.markup_id,
    body: row.body,
    bodyHtml: row.body_html,
    mediaKind: row.media_kind,
    fileId: row.file_id,
    mediaDurationSeconds: row.media_duration_seconds,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_id ? (names.get(row.assignee_id) ?? null) : null,
    authorId: row.created_by_id,
    authorName: row.created_by_id ? (names.get(row.created_by_id) ?? null) : null,
    version: row.version ?? 1,
    createdAt: toIso(row.created_at),
  };
}

export interface MarkupContext {
  comments: ReadonlyMap<string, DrawingMarkupComment[]>;
  names: ReadonlyMap<string, string | null>;
  rfiByMarkup: ReadonlyMap<string, string>;
  approvalByMarkup: ReadonlyMap<string, string>;
  currentVersionByDocument: ReadonlyMap<string, string | null>;
  revisionByVersion: ReadonlyMap<string, string | null>;
}

export function toMarkup(row: DrawingMarkupRow, ctx: MarkupContext): DrawingMarkup {
  // A take-off pin lives on the session it was raised in; that session is the
  // revision, so it is always "current" from the markup's own point of view.
  const onProjectDrawing = row.document_id !== null && row.document_version_id !== null;
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    revisionLabel: onProjectDrawing ? (ctx.revisionByVersion.get(row.document_version_id!) ?? null) : null,
    isCurrentRevision: onProjectDrawing
      ? ctx.currentVersionByDocument.get(row.document_id!) === row.document_version_id
      : true,
    pageNo: row.page_no,
    preconSessionId: row.precon_session_id,
    preconSheetId: row.precon_sheet_id,
    preconRowId: row.precon_row_id,
    kind: row.kind,
    geometry: withSpace(row.geometry, onProjectDrawing),
    color: row.color,
    style: row.style ?? null,
    authorId: row.created_by_id,
    authorName: row.created_by_id ? (ctx.names.get(row.created_by_id) ?? null) : null,
    resolvedAt: toIsoOrNull(row.resolved_at),
    version: row.version ?? 1,
    deletedAt: toIsoOrNull(row.deleted_at ?? null),
    createdAt: toIso(row.created_at),
    comments: ctx.comments.get(row.id) ?? [],
    linkedRfiId: ctx.rfiByMarkup.get(row.id) ?? null,
    linkedApprovalId: ctx.approvalByMarkup.get(row.id) ?? null,
  };
}
