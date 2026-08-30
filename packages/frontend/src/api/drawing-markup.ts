import api from "./client";

export const MARKUP_KINDS = ["pin", "pen", "cloud", "measure"] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];

export const MEDIA_KINDS = ["audio", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

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
  projectId: string;
  documentId: string;
  documentVersionId: string;
  revisionLabel: string | null;
  isCurrentRevision: boolean;
  pageNo: number;
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
