import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import { generateId } from "../../lib/ids.ts";
import type { DrawingMarkupRepository } from "./repository.ts";
import { MARKUP_KIND } from "./types.ts";
import type {
  CreateCommentInput,
  CreateMarkupInput,
  DrawingMarkup,
  DrawingMarkupComment,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupGeometry,
  MarkupKind,
} from "./types.ts";

function assertGeometryMatchesKind(kind: MarkupKind, geometry: MarkupGeometry): void {
  if (geometry.kind !== kind) {
    throw new BadRequestError(`Geometry kind "${geometry.kind}" does not match markup kind "${kind}"`);
  }
  const invalid =
    (geometry.kind === MARKUP_KIND.PEN && geometry.points.length < 2) ||
    (geometry.kind === MARKUP_KIND.CLOUD && (geometry.rect.w <= 0 || geometry.rect.h <= 0));
  if (invalid) throw new BadRequestError(`Incomplete geometry for a ${kind} markup`);
}

function toComment(
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
    createdAt: toIso(row.created_at),
  };
}

interface MarkupContext {
  comments: ReadonlyMap<string, DrawingMarkupComment[]>;
  names: ReadonlyMap<string, string | null>;
  rfiByMarkup: ReadonlyMap<string, string>;
  approvalByMarkup: ReadonlyMap<string, string>;
  currentVersionByDocument: ReadonlyMap<string, string | null>;
  revisionByVersion: ReadonlyMap<string, string | null>;
}

function toMarkup(row: DrawingMarkupRow, ctx: MarkupContext): DrawingMarkup {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    revisionLabel: ctx.revisionByVersion.get(row.document_version_id) ?? null,
    isCurrentRevision: ctx.currentVersionByDocument.get(row.document_id) === row.document_version_id,
    pageNo: row.page_no,
    kind: row.kind,
    geometry: row.geometry,
    color: row.color,
    authorId: row.created_by_id,
    authorName: row.created_by_id ? (ctx.names.get(row.created_by_id) ?? null) : null,
    resolvedAt: toIsoOrNull(row.resolved_at),
    createdAt: toIso(row.created_at),
    comments: ctx.comments.get(row.id) ?? [],
    linkedRfiId: ctx.rfiByMarkup.get(row.id) ?? null,
    linkedApprovalId: ctx.approvalByMarkup.get(row.id) ?? null,
  };
}

export function drawingMarkupService(repo: DrawingMarkupRepository) {
  /** One batched round of lookups for a set of markups — never a query per row. */
  async function buildContext(rows: DrawingMarkupRow[]): Promise<MarkupContext> {
    const markupIds = rows.map((r) => r.id);
    const [commentRows, rfiLinks, approvalLinks] = await Promise.all([
      repo.commentsForMarkups(markupIds),
      repo.rfiLinksForMarkups(markupIds),
      repo.approvalLinksForMarkups(markupIds),
    ]);

    const userIds = new Set<string>();
    for (const r of rows) if (r.created_by_id) userIds.add(r.created_by_id);
    for (const c of commentRows) {
      if (c.created_by_id) userIds.add(c.created_by_id);
      if (c.assignee_id) userIds.add(c.assignee_id);
    }

    const documentIds = [...new Set(rows.map((r) => r.document_id))];
    const versionIds = [...new Set(rows.map((r) => r.document_version_id))];
    const [users, documents, versions] = await Promise.all([
      repo.usersByIds([...userIds]),
      Promise.all(documentIds.map((id) => repo.currentVersionIdForDocument(id))),
      Promise.all(versionIds.map((id) => repo.versionById(id))),
    ]);

    const names = new Map(users.map((u) => [u.id, u.name]));
    const currentVersionByDocument = new Map(
      documentIds.map((id, i) => [id, documents[i]?.current_version_id ?? null]),
    );
    const revisionByVersion = new Map(
      versionIds.map((id, i) => [id, versions[i]?.revision_label ?? null]),
    );

    const comments = new Map<string, DrawingMarkupComment[]>();
    for (const row of commentRows) {
      const list = comments.get(row.markup_id);
      const mapped = toComment(row, names);
      if (list) list.push(mapped);
      else comments.set(row.markup_id, [mapped]);
    }

    return {
      comments,
      names,
      rfiByMarkup: new Map(rfiLinks.map((l) => [l.source_markup_id, l.id])),
      approvalByMarkup: new Map(approvalLinks.map((l) => [l.source_markup_id, l.id])),
      currentVersionByDocument,
      revisionByVersion,
    };
  }

  async function loadMarkup(id: string): Promise<DrawingMarkupRow> {
    const row = await repo.byId(id);
    if (!row) throw new NotFoundError("Markup");
    return row;
  }

  return {
    async listForVersion(documentVersionId: string, pageNo?: number): Promise<DrawingMarkup[]> {
      const rows = await repo.listByVersion(documentVersionId, pageNo);
      const ctx = await buildContext(rows);
      return rows.map((row) => toMarkup(row, ctx));
    },

    async listForDocument(documentId: string): Promise<DrawingMarkup[]> {
      const rows = await repo.listByDocument(documentId);
      const ctx = await buildContext(rows);
      return rows.map((row) => toMarkup(row, ctx));
    },

    async get(id: string): Promise<DrawingMarkup> {
      const row = await loadMarkup(id);
      const ctx = await buildContext([row]);
      return toMarkup(row, ctx);
    },

    async create(
      projectId: string,
      userId: string,
      input: CreateMarkupInput,
    ): Promise<DrawingMarkup> {
      assertGeometryMatchesKind(input.kind, input.geometry);

      const version = await repo.versionById(input.documentVersionId);
      if (!version) throw new NotFoundError("Document version");
      if (version.document_id !== input.documentId) {
        throw new BadRequestError("Document version does not belong to that document");
      }

      const now = new Date();
      const row: DrawingMarkupRow = {
        id: generateId("mk"),
        project_id: projectId,
        document_id: input.documentId,
        document_version_id: input.documentVersionId,
        page_no: input.pageNo ?? 1,
        kind: input.kind,
        geometry: input.geometry,
        color: input.color ?? "#004DE7",
        created_by_id: userId,
        resolved_at: null,
        resolved_by_id: null,
        created_at: now,
        updated_at: now,
      };
      await repo.insertMarkup(row);
      const ctx = await buildContext([row]);
      return toMarkup(row, ctx);
    },

    async addComment(
      markupId: string,
      userId: string,
      input: CreateCommentInput,
    ): Promise<DrawingMarkupComment> {
      await loadMarkup(markupId);
      const body = input.body.trim();
      if (!body) throw new BadRequestError("Comment body is required");

      const now = new Date();
      const row: DrawingMarkupCommentRow = {
        id: generateId("mkc"),
        markup_id: markupId,
        body,
        body_html: input.bodyHtml ?? null,
        media_kind: input.mediaKind ?? null,
        file_id: input.fileId ?? null,
        media_duration_seconds: input.mediaDurationSeconds ?? null,
        assignee_id: input.assigneeId ?? null,
        created_by_id: userId,
        created_at: now,
        updated_at: now,
      };
      await repo.insertComment(row);

      const userIds = [userId, ...(input.assigneeId ? [input.assigneeId] : [])];
      const users = await repo.usersByIds(userIds);
      return toComment(row, new Map(users.map((u) => [u.id, u.name])));
    },

    async setResolved(markupId: string, userId: string, resolved: boolean): Promise<DrawingMarkup> {
      await loadMarkup(markupId);
      await repo.resolveMarkup(markupId, userId, resolved);
      return this.get(markupId);
    },

    async remove(markupId: string): Promise<void> {
      await loadMarkup(markupId);
      await repo.deleteMarkup(markupId);
    },
  };
}

export type DrawingMarkupService = ReturnType<typeof drawingMarkupService>;
