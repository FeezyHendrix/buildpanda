import type {
  MarkupGeometry,
  MarkupKind,
  MarkupPoint,
  MarkupRect,
  MediaKind,
} from "@/components/plan-review/markup-types";
import { request } from "./client";

export type { MarkupGeometry, MarkupKind, MarkupPoint, MarkupRect, MediaKind };

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
  bodyHtml?: string | null;
  mediaKind?: MediaKind | null;
  fileId?: string | null;
  mediaDurationSeconds?: number | null;
  assigneeId?: string | null;
}

export const drawingMarkupApi = {
  listForVersion: (projectId: string, documentVersionId: string, pageNo?: number) => {
    const page = pageNo ? `&pageNo=${pageNo}` : "";
    return request<DrawingMarkup[]>(
      `/projects/${projectId}/drawing-markups?documentVersionId=${encodeURIComponent(documentVersionId)}${page}`,
    );
  },

  create: (projectId: string, input: CreateMarkupInput) =>
    request<DrawingMarkup>(`/projects/${projectId}/drawing-markups`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  addComment: (projectId: string, markupId: string, input: CreateMarkupCommentInput) =>
    request<DrawingMarkupComment>(`/projects/${projectId}/drawing-markups/${markupId}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  setResolved: (projectId: string, markupId: string, resolved: boolean) =>
    request<DrawingMarkup>(`/projects/${projectId}/drawing-markups/${markupId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolved }),
    }),

  remove: (projectId: string, markupId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/drawing-markups/${markupId}`, {
      method: "DELETE",
    }),
};
