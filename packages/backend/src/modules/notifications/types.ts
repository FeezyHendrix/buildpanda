export type NotificationType =
  | "update_posted"
  | "update_action_required"
  | "inspection_scheduled"
  | "milestone_released"
  | "milestone_disputed"
  | "document_uploaded";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  project_id: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}
