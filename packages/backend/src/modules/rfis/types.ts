export const RFI_STATUSES = ["Draft", "Open", "InReview", "Answered", "Closed", "Void"] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

export const RFI_PRIORITIES = ["Low", "Normal", "High"] as const;
export type RfiPriority = (typeof RFI_PRIORITIES)[number];

export const RFI_VISIBILITIES = ["internal", "shared"] as const;
export type RfiVisibility = (typeof RFI_VISIBILITIES)[number];

export interface Rfi {
  id: string;
  projectId: string;
  number: number;
  subject: string;
  question: string;
  questionHtml: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  visibility: RfiVisibility;
  ballInCourtId: string | null;
  ballInCourtName: string | null;
  ballInCourtEmail: string | null;
  assigneeRole: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  officialResponseHtml: string | null;
  officialRespondedById: string | null;
  officialRespondedByName: string | null;
  officialRespondedAt: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  changeRequestId: string | null;
  reopenedCount: number;
  createdById: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RfiComment {
  id: string;
  rfiId: string;
  authorId: string;
  authorName: string;
  body: string;
  contentHtml: string | null;
  attachments: RfiCommentAttachment[];
  references: RfiCommentReference[];
  isProposedResponse: boolean;
  createdAt: string;
}

export interface RfiCommentAttachment {
  fileId: string;
  url: string;
  name: string;
}

export interface RfiCommentReference {
  type: "action_item" | "activity";
  id: string;
  label: string;
}

export interface RfiEvent {
  id: string;
  rfiId: string;
  type: string;
  actorId: string | null;
  actorLabel: string | null;
  detail: unknown;
  createdAt: string;
}

export interface RfiDetail extends Rfi {
  comments: RfiComment[];
  events: RfiEvent[];
}

export interface RfiRow {
  id: string;
  project_id: string;
  number: number;
  subject: string;
  question: string;
  question_html: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  visibility: RfiVisibility;
  ball_in_court_id: string | null;
  ball_in_court_name: string | null;
  ball_in_court_email: string | null;
  assignee_role: string | null;
  due_date: string | null;
  official_response: string | null;
  official_response_html: string | null;
  official_responded_by_id: string | null;
  official_responded_by_name: string | null;
  official_responded_at: string | null;
  cost_impact: boolean;
  schedule_impact: boolean;
  change_request_id: string | null;
  reopened_count: number;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfiCommentRow {
  id: string;
  rfi_id: string;
  author_id: string;
  author_name: string;
  body: string;
  content_html: string | null;
  attachments: unknown;
  references: unknown;
  is_proposed_response: boolean;
  created_at: string;
}

export interface RfiEventRow {
  id: string;
  rfi_id: string;
  type: string;
  actor_id: string | null;
  actor_label: string | null;
  detail: unknown;
  created_at: string;
}

export const RFI_DISTRIBUTION_ROLES = ["responder", "viewer"] as const;
export type RfiDistributionRole = (typeof RFI_DISTRIBUTION_ROLES)[number];

export interface RfiDistributionMember {
  id: string;
  rfiId: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: RfiDistributionRole;
  external: boolean;
  tokenConsumedAt: string | null;
  createdAt: string;
}

export interface RfiDistributionRow {
  id: string;
  rfi_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: RfiDistributionRole;
  reply_token_hash: string | null;
  token_expires_at: string | null;
  token_consumed_at: string | null;
  created_at: string;
}
