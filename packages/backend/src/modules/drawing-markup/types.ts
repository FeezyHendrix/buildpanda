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

/**
 * Which space a markup's coordinates are in.
 *
 * "percent" is what project drawings have always used: percentages of the
 * rendered sheet, which survive any zoom or DPI but carry no scale, so a
 * length drawn in that space can never become a quantity.
 *
 * "points" is the take-off space: sheet points for a PDF, drawing units
 * through the frame for a DWG, pixels over the raster scale for a picture.
 * A sheet with a calibrated scale turns those into millimetres, which is what
 * lets one viewer hold both a redline and a measurement.
 *
 * Rows written before this existed have no space and are read as "percent".
 */
export const GEOMETRY_SPACES = ["percent", "points"] as const;
export type GeometrySpace = (typeof GEOMETRY_SPACES)[number];

export const GEOMETRY_SPACE = {
  PERCENT: "percent",
  POINTS: "points",
} as const satisfies Record<string, GeometrySpace>;

type MarkupShape =
  | { kind: "pin"; at: Point }
  | { kind: "pen"; points: Point[] }
  | { kind: "cloud"; rect: Rect }
  | { kind: "measure"; a: Point; b: Point };

/** A shape plus the space its numbers are in. */
export type MarkupGeometry = MarkupShape & { space?: GeometrySpace };

/**
 * A markup is anchored to exactly one of: a project drawing revision
 * (project + document + version + page) or a pre-construction take-off sheet
 * (session + sheet, optionally the bill row it questions). The DB CHECK in
 * migration 20260822_markups_on_precon mirrors this.
 */
export interface DrawingMarkupRow {
  id: string;
  project_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
  page_no: number | null;
  precon_session_id: string | null;
  precon_sheet_id: string | null;
  precon_row_id: string | null;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color: string;
  created_by_id: string | null;
  resolved_at: Date | string | null;
  resolved_by_id: string | null;
  // Two people redlining the same sheet must collide loudly; a redline an RFI
  // was raised off is hidden, not erased.
  version?: number;
  deleted_at?: Date | string | null;
  // pen colour and stroke width as drawn, jsonb
  style?: MarkupStyle | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Ink beyond the single `color` swatch, so a stroke redraws as it was drawn. */
export interface MarkupStyle {
  color?: string;
  strokeWidthPx?: number;
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
  // A comment is evidence of what someone said: only its author may reword it,
  // only against the revision they were shown, and it is hidden, never erased.
  version?: number;
  deleted_at?: Date | string | null;
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
  version: number;
  createdAt: string;
}

export interface DrawingMarkup {
  id: string;
  projectId: string | null;
  documentId: string | null;
  documentVersionId: string | null;
  revisionLabel: string | null;
  /** False once a newer revision of the drawing exists — the item was raised against a superseded sheet. */
  isCurrentRevision: boolean;
  pageNo: number | null;
  /** Take-off anchor: the session (revision) and sheet the pin was raised on, plus the bill line it questions. */
  preconSessionId: string | null;
  preconSheetId: string | null;
  preconRowId: string | null;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color: string;
  style: MarkupStyle | null;
  authorId: string | null;
  authorName: string | null;
  resolvedAt: string | null;
  /** The number an edit must quote to win; a stale one is rejected, not merged. */
  version: number;
  deletedAt: string | null;
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

/**
 * Body of POST /precon/sessions/:sessionId/markups. Pin geometry on a take-off
 * sheet is in sheet points (the space PreconGeometry.vertices uses), not the
 * sheet-percent space project drawings use, so pins sit with the measurements.
 */
export interface CreatePreconMarkupInput {
  sheetId: string;
  /** The bill line selected when the pin was placed; null for a sheet-only note. */
  rowId?: string | null;
  kind: MarkupKind;
  geometry: MarkupGeometry;
  color?: string;
  /**
   * The pen as it was drawn with. Stated at creation, not restated after it: a
   * stroke that needed a follow-up `edit-markup` to record its own width read
   * back as a redline someone changed their mind about seconds later, which on
   * a contractual record is a different event from drawing it that way.
   */
  style?: MarkupStyle;
}

/**
 * The slice of the pdf-takeoff service the markup module needs: every take-off
 * access path proves the artefact belongs to the caller's organisation.
 */
export interface PreconAnchorGuard {
  assertSessionOrg(sessionId: string, orgId: string): Promise<unknown>;
  assertSheetOrg(sheetId: string, orgId: string): Promise<string>;
  assertRowOrg(rowId: string, orgId: string): Promise<string>;
}

export interface CreateCommentInput {
  body: string;
  bodyHtml?: string | null;
  mediaKind?: MediaKind | null;
  fileId?: string | null;
  mediaDurationSeconds?: number | null;
  assigneeId?: string | null;
}

/**
 * Moving a pin, redrawing a stroke or recolouring it. `version` is the one the
 * editor was shown: two people redlining the same sheet must collide loudly.
 */
export interface EditMarkupInput {
  version: number;
  geometry?: MarkupGeometry;
  color?: string;
  style?: MarkupStyle;
}

export interface EditCommentInput {
  version: number;
  body: string;
  bodyHtml?: string | null;
}

/**
 * The slice of the take-off audit trail this module writes to. Narrow on
 * purpose: `preconAuditRepository` satisfies it as-is, and a test passes an
 * array-backed fake without a database.
 */
export interface MarkupAuditSink {
  insertAuditEvent(row: {
    id: string;
    session_id: string;
    row_id: string | null;
    actor: string;
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }): PromiseLike<unknown>;
}

export interface MarkupPatch {
  version: number;
  geometry?: MarkupGeometry;
  color?: string;
  style?: MarkupStyle;
}

export interface CommentPatch {
  version: number;
  body: string;
  body_html: string | null;
}

export interface CommentAuthorRow {
  id: string;
  created_by_id: string | null;
}

/**
 * The slice of the repository the editing methods write through. Narrow for the
 * same reason `PreconAnchorGuard` is: the real repository satisfies it as-is,
 * and a guard test supplies these nine calls without a database.
 */
export interface MarkupEditingStore {
  updateMarkup(id: string, patch: MarkupPatch): Promise<DrawingMarkupRow | null>;
  updateComment(id: string, patch: CommentPatch): Promise<DrawingMarkupCommentRow | null>;
  softDeleteMarkup(id: string, deletedAt: Date, version: number): Promise<DrawingMarkupRow | null>;
  restoreMarkup(id: string, version: number): Promise<DrawingMarkupRow | null>;
  softDeleteCommentsForMarkup(markupId: string, deletedAt: Date): PromiseLike<unknown>;
  restoreCommentsForMarkup(markupId: string, deletedAt: Date): PromiseLike<unknown>;
  commentsForMarkupIncludeDeleted(markupId: string): PromiseLike<DrawingMarkupCommentRow[]>;
  commentById(id: string): PromiseLike<DrawingMarkupCommentRow | undefined>;
  commentAuthorsForMarkup(markupId: string): Promise<CommentAuthorRow[]>;
  usersByIds(userIds: readonly string[]): PromiseLike<MarkupAuthorRow[]>;
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
