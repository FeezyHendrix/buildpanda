export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Resubmit";

export interface Approval {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  description: string | null;
  descriptionHtml: string | null;
  status: ApprovalStatus;
  response: string | null;
  dueDate: string | null;
  submittedById: string | null;
  requestedReviewerId: string | null;
  requestedReviewerName: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  commentCount: number;
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
}

export interface ApprovalRow {
  id: string;
  project_id: string;
  title: string;
  category: string | null;
  description: string | null;
  description_html: string | null;
  status: ApprovalStatus;
  response: string | null;
  due_date: string | null;
  submitted_by_id: string | null;
  requested_reviewer_id: string | null;
  requested_reviewer_name: string | null;
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
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
