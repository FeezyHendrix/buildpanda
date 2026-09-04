export type ChangeStatus = "Draft" | "Submitted" | "Approved" | "Rejected";
import type { CurrencyCode } from "../../lib/currencies.ts";
export type Currency = CurrencyCode;

export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  reason: string | null;
  reasonHtml: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: Currency;
  submittedById: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeBudgetLink {
  budgetCategoryId: string;
  amount: number;
  committed: boolean;
}

export interface ChangeComment {
  id: string;
  changeRequestId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChangeRequestDetail extends ChangeRequest {
  comments: ChangeComment[];
}

export interface ChangeRequestRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  reason: string | null;
  reason_html: string | null;
  status: ChangeStatus;
  cost_impact: string;
  time_impact_days: number;
  currency: Currency;
  submitted_by_id: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeCommentRow {
  id: string;
  change_request_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
