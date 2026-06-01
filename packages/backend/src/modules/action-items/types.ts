export type ActionStatus = "Open" | "InProgress" | "Blocked" | "Resolved";
export type ActionPriority = "Low" | "Medium" | "High" | "Urgent";

export interface ActionItem {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionComment {
  id: string;
  actionItemId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ActionItemDetail extends ActionItem {
  comments: ActionComment[];
}

export interface ActionItemRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  resolved_at: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionCommentRow {
  id: string;
  action_item_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
