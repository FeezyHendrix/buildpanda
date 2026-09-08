import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import { generateId } from "../../lib/ids.ts";
import type { DrawingMarkupRepository } from "./repository.ts";
import { MARKUP_KIND } from "./types.ts";
import type {
  CreateCommentInput,
  CreateMarkupInput,
  CreatePreconMarkupInput,
  DrawingMarkup,
  DrawingMarkupComment,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupGeometry,
  MarkupKind,
  PreconAnchorGuard,
} from "./types.ts";

/**
 * The anchor a row (or a row about to be written) sits on. Mirrors the DB
 * CHECK so a bad insert fails here with a readable error, not a constraint name.
 */
export function anchorOf(
  row: Pick<
    DrawingMarkupRow,
    "project_id" | "document_id" | "document_version_id" | "page_no" | "precon_session_id" | "precon_sheet_id" | "precon_row_id"
  >,
): "project" | "precon" {
  const project = row.project_id !== null && row.document_id !== null && row.document_version_id !== null && row.page_no !== null;
  const precon = row.precon_session_id !== null && row.precon_sheet_id !== null;
  const anyProject = row.project_id !== null || row.document_id !== null || row.document_version_id !== null || row.page_no !== null;
  const anyPrecon = row.precon_session_id !== null || row.precon_sheet_id !== null || row.precon_row_id !== null;
  if (project && !anyPrecon) return "project";
  if (precon && !anyProject) return "precon";
  throw new BadRequestError("A markup must anchor to exactly one of a project drawing revision or a take-off sheet");
}

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

function nonNull(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))];
}

/**
 * @param precon the pdf-takeoff service (or a fake in tests); only needed by
 * the take-off methods, which prove every anchor belongs to the caller's org.
 */
export function drawingMarkupService(repo: DrawingMarkupRepository, precon?: PreconAnchorGuard) {
  function requirePrecon(): PreconAnchorGuard {
    if (!precon) throw new Error("drawingMarkupService: take-off anchors need the precon service");
    return precon;
  }

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

    const documentIds = nonNull(rows.map((r) => r.document_id));
    const versionIds = nonNull(rows.map((r) => r.document_version_id));
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
        precon_session_id: null,
        precon_sheet_id: null,
        precon_row_id: null,
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

    // ── Take-off sheets ─────────────────────────────────────────────────────
    // Same register, same comments, same resolve flow; only the anchor differs.

    /** The session must belong to the caller's org before any of its pins are read. */
    assertPreconSessionOrg(sessionId: string, orgId: string): Promise<unknown> {
      return requirePrecon().assertSessionOrg(sessionId, orgId);
    },

    async listForSession(sessionId: string, sheetId?: string): Promise<DrawingMarkup[]> {
      const rows = await repo.listBySession(sessionId, sheetId);
      const ctx = await buildContext(rows);
      return rows.map((row) => toMarkup(row, ctx));
    },

    async createForSession(
      sessionId: string,
      orgId: string,
      userId: string,
      input: CreatePreconMarkupInput,
    ): Promise<DrawingMarkup> {
      assertGeometryMatchesKind(input.kind, input.geometry);
      const guard = requirePrecon();
      await guard.assertSessionOrg(sessionId, orgId);
      const [sheetSession, rowSession] = await Promise.all([
        guard.assertSheetOrg(input.sheetId, orgId),
        input.rowId ? guard.assertRowOrg(input.rowId, orgId) : Promise.resolve(sessionId),
      ]);
      if (sheetSession !== sessionId) throw new BadRequestError("Sheet does not belong to this take-off");
      if (rowSession !== sessionId) throw new BadRequestError("Bill line does not belong to this take-off");

      const now = new Date();
      const row: DrawingMarkupRow = {
        id: generateId("mk"),
        project_id: null,
        document_id: null,
        document_version_id: null,
        page_no: null,
        precon_session_id: sessionId,
        precon_sheet_id: input.sheetId,
        precon_row_id: input.rowId ?? null,
        kind: input.kind,
        geometry: input.geometry,
        color: input.color ?? "#004DE7",
        created_by_id: userId,
        resolved_at: null,
        resolved_by_id: null,
        created_at: now,
        updated_at: now,
      };
      anchorOf(row);
      await repo.insertMarkup(row);
      const ctx = await buildContext([row]);
      return toMarkup(row, ctx);
    },

    /**
     * Proves a markup is a take-off pin the caller's org may touch and returns
     * its session id; the comment / resolve / delete methods above then apply.
     */
    async preconSessionOf(markupId: string, orgId: string): Promise<string> {
      const row = await loadMarkup(markupId);
      if (row.precon_session_id === null) throw new NotFoundError("Markup");
      await requirePrecon().assertSessionOrg(row.precon_session_id, orgId);
      return row.precon_session_id;
    },
  };
}

export type DrawingMarkupService = ReturnType<typeof drawingMarkupService>;
