import api from "./client";

export const MARKUP_KINDS = ["pin", "pen", "cloud", "measure"] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];

export const MARKUP_KIND = {
  PIN: "pin",
  PEN: "pen",
  CLOUD: "cloud",
  MEASURE: "measure",
} as const satisfies Record<string, MarkupKind>;

export const MEDIA_KINDS = ["audio", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND = {
  AUDIO: "audio",
  VIDEO: "video",
} as const satisfies Record<string, MediaKind>;

export interface MarkupPoint {
  x: number;
  y: number;
}

export interface MarkupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MarkupGeometry =
  | { kind: "pin"; at: MarkupPoint }
  | { kind: "pen"; points: MarkupPoint[] }
  | { kind: "cloud"; rect: MarkupRect }
  | { kind: "measure"; a: MarkupPoint; b: MarkupPoint };

export interface DrawingMarkupComment {
  id: string;
  markupId: string;
  body: string;
  bodyHtml: string | null;
  mediaKind: MediaKind | null;
  fileId: string | null;
  mediaDurationSeconds: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface DrawingMarkup {
  id: string;
  /** Project drawing anchor — null when the markup sits on a take-off sheet. */
  projectId: string | null;
  documentId: string | null;
  documentVersionId: string | null;
  revisionLabel: string | null;
  isCurrentRevision: boolean;
  pageNo: number | null;
  /** Take-off anchor (WS-M1D) — null when the markup sits on a project drawing. */
  preconSessionId: string | null;
  preconSheetId: string | null;
  /** The bill line the pin questions, if one was selected when it was placed. */
  preconRowId: string | null;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color: string;
  authorId: string | null;
  authorName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  comments: DrawingMarkupComment[];
  linkedRfiId: string | null;
  linkedApprovalId: string | null;
}

export interface CreateMarkupInput {
  documentId: string;
  documentVersionId: string;
  pageNo?: number;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color?: string;
}

export interface CreateMarkupCommentInput {
  body: string;
  bodyHtml?: string | null;
  mediaKind?: MediaKind | null;
  fileId?: string | null;
  mediaDurationSeconds?: number | null;
  assigneeId?: string | null;
}

export const drawingMarkupApi = {
  listForVersion: (projectId: string, documentVersionId: string, pageNo?: number) =>
    api
      .get<DrawingMarkup[]>(`/projects/${projectId}/drawing-markups`, {
        params: { documentVersionId, pageNo },
      })
      .then((r) => r.data),

  listForDocument: (projectId: string, documentId: string) =>
    api
      .get<DrawingMarkup[]>(`/projects/${projectId}/documents/${documentId}/drawing-markups`)
      .then((r) => r.data),

  create: (projectId: string, body: CreateMarkupInput) =>
    api.post<DrawingMarkup>(`/projects/${projectId}/drawing-markups`, body).then((r) => r.data),

  addComment: (projectId: string, markupId: string, body: CreateMarkupCommentInput) =>
    api
      .post<DrawingMarkupComment>(`/projects/${projectId}/drawing-markups/${markupId}/comments`, body)
      .then((r) => r.data),

  setResolved: (projectId: string, markupId: string, resolved: boolean) =>
    api
      .patch<DrawingMarkup>(`/projects/${projectId}/drawing-markups/${markupId}/resolve`, { resolved })
      .then((r) => r.data),

  remove: (projectId: string, markupId: string) =>
    api.delete<{ ok: true }>(`/projects/${projectId}/drawing-markups/${markupId}`).then((r) => r.data),
};

// ── WS-M1D: markups on take-off sheets ────────────────────────────────────
// Same register and DTOs as project drawings; only the anchor differs. Pin
// geometry here is in sheet points (the PreconGeometry.vertices space), not
// sheet percent, so pins stay with the measurements at any raster scale.

export interface CreatePreconMarkupInput {
  sheetId: string;
  /** The bill line selected when the pin was placed; null for a sheet-only note. */
  rowId?: string | null;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color?: string;
}

export const preconMarkupApi = {
  list: (sessionId: string, sheetId?: string) =>
    api
      .get<DrawingMarkup[]>(`/precon/sessions/${sessionId}/markups`, { params: { sheetId } })
      .then((r) => r.data),

  create: (sessionId: string, body: CreatePreconMarkupInput) =>
    api.post<DrawingMarkup>(`/precon/sessions/${sessionId}/markups`, body).then((r) => r.data),

  addComment: (markupId: string, body: CreateMarkupCommentInput) =>
    api.post<DrawingMarkupComment>(`/precon/markups/${markupId}/comments`, body).then((r) => r.data),

  setResolved: (markupId: string, resolved: boolean) =>
    api.post<DrawingMarkup>(`/precon/markups/${markupId}/resolve`, { resolved }).then((r) => r.data),

  remove: (markupId: string) => api.delete<{ ok: true }>(`/precon/markups/${markupId}`).then((r) => r.data),
};
