export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Resubmit";

// Entering one of these stamps reviewer + reviewed_at, and is what the
// reviewer-only route guard keys off.
export const DECISION_STATUSES: readonly ApprovalStatus[] = ["Approved", "Rejected", "Resubmit"];

// Both kinds share one lifecycle and one `approvals` table, so every read of
// that table must filter on kind or it leaks the other workflow's records.
export const APPROVAL_KINDS = ["client", "material"] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_SORTS = ["attention", "newest", "oldest", "dueDate"] as const;
export type ApprovalSort = (typeof APPROVAL_SORTS)[number];

// Seeded into the Category picker until a project edits its own list.
export const DEFAULT_APPROVAL_CATEGORIES = ["Finishes", "Fittings", "Materials", "Structural", "Other"] as const;

/** Who is asking: the route resolves this from the same guard it enforces. */
export interface ApprovalViewer {
  id: string;
  canDecide: boolean;
  /** May open the files behind attachments (documents:view); otherwise chips render without a link. */
  canOpenFiles: boolean;
}

export interface ApprovalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Short-lived view link; null when the viewer may not open the file. */
  url: string | null;
  documentId: string | null;
  documentVersionId: string | null;
  /** The document has a newer version than the one this approval was made against. */
  isSuperseded: boolean;
}

export interface ApprovalDecision {
  id: string;
  decision: ApprovalStatus;
  note: string | null;
  noteHtml: string | null;
  actorId: string | null;
  actorName: string | null;
  decidedAt: string;
  revision: number;
}

export interface ApprovalRevision {
  revision: number;
  submittedAt: string;
  attachments: ApprovalAttachment[];
  decision: ApprovalStatus | null;
  decisionNote: string | null;
}

export interface Approval {
  id: string;
  projectId: string;
  kind: ApprovalKind;
  title: string;
  category: string | null;
  description: string | null;
  descriptionHtml: string | null;
  status: ApprovalStatus;
  response: string | null;
  responseHtml: string | null;
  dueDate: string | null;
  submittedById: string | null;
  requestedReviewerId: string | null;
  requestedReviewerName: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  revision: number;
  commentCount: number;
  /** The list carries the first few; the detail carries them all. */
  attachments: ApprovalAttachment[];
  attachmentCount: number;
  /** The caller may record a decision: same rule the PATCH guard enforces. */
  viewerCanDecide: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalComment {
  id: string;
  approvalId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ApprovalDetail extends Approval {
  comments: ApprovalComment[];
  decisions: ApprovalDecision[];
  revisions: ApprovalRevision[];
}

export interface ApprovalListQuery {
  q?: string;
  status?: ApprovalStatus[];
  needsMyDecision?: boolean;
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  pageSize?: number;
  sort?: ApprovalSort;
}

export interface ApprovalCounts {
  needsMe: number;
  awaiting: number;
  approved: number;
  rejected: number;
  changesRequested: number;
}

export interface ApprovalPage {
  items: Approval[];
  total: number;
  page: number;
  pageSize: number;
  counts: ApprovalCounts;
}

export interface Approver {
  id: string;
  name: string;
  role: string;
}

export interface ApprovalCategory {
  id: string;
  name: string;
}

export interface ApprovalRow {
  id: string;
  project_id: string;
  kind: ApprovalKind;
  title: string;
  category: string | null;
  description: string | null;
  description_html: string | null;
  status: ApprovalStatus;
  response: string | null;
  response_html: string | null;
  due_date: string | null;
  submitted_by_id: string | null;
  requested_reviewer_id: string | null;
  requested_reviewer_name: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalCommentRow {
  id: string;
  approval_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface ApprovalAttachmentRow {
  id: string;
  approval_id: string;
  file_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
  position: number;
  revision: number;
  created_by: string | null;
  created_at: string;
}

export interface ApprovalDecisionRow {
  id: string;
  approval_id: string;
  decision: ApprovalStatus;
  note: string | null;
  note_html: string | null;
  actor_id: string | null;
  actor_name?: string | null;
  decided_at: string;
  revision: number;
}

export interface ApprovalCategoryRow {
  id: string;
  project_id: string;
  name: string;
  position: number;
}
