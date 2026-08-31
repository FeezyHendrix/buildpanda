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

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Percentages of the rendered sheet, so geometry survives any zoom or DPI. */
export type MarkupGeometry =
  | { kind: "pin"; at: Point }
  | { kind: "pen"; points: Point[] }
  | { kind: "cloud"; rect: Rect }
  | { kind: "measure"; a: Point; b: Point };

export interface DrawingMarkupRow {
  id: string;
  project_id: string;
  document_id: string;
  document_version_id: string;
  page_no: number;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color: string;
  created_by_id: string | null;
  resolved_at: Date | string | null;
  resolved_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DrawingMarkupCommentRow {
  id: string;
  markup_id: string;
  body: string;
  body_html: string | null;
  media_kind: MediaKind | null;
  file_id: string | null;
  media_duration_seconds: number | null;
  assignee_id: string | null;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

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
  /** False once a newer revision of the drawing exists — the item was raised against a superseded sheet. */
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

export interface CreateCommentInput {
  body: string;
  bodyHtml?: string | null;
  mediaKind?: MediaKind | null;
  fileId?: string | null;
  mediaDurationSeconds?: number | null;
  assigneeId?: string | null;
}

export interface MarkupAuthorRow {
  id: string;
  name: string | null;
}

export interface MarkupLinkRow {
  id: string;
  source_markup_id: string;
}

export interface MarkupVersionRow {
  id: string;
  document_id: string;
  revision_label: string | null;
}
