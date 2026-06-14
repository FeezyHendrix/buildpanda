export const NOTIFICATION_TYPES = [
  { type: "update_posted", label: "Project updates posted", group: "Project" },
  { type: "update_action_required", label: "Action required on an update", group: "Project" },
  { type: "inspection_scheduled", label: "Inspection scheduled", group: "Project" },
  { type: "milestone_released", label: "Milestone payment released", group: "Payments" },
  { type: "milestone_disputed", label: "Milestone payment disputed", group: "Payments" },
  { type: "document_uploaded", label: "Document uploaded", group: "Documents" },
  { type: "action_item_due", label: "Action item due or overdue", group: "Tasks" },
  { type: "action_item_assigned", label: "Action item assigned to you", group: "Tasks" },
  { type: "rfi_assigned", label: "RFI assigned to you (ball in court)", group: "RFIs" },
  { type: "rfi_answered", label: "RFI answered", group: "RFIs" },
  { type: "rfi_due", label: "RFI due or overdue", group: "RFIs" },
  { type: "query_assigned", label: "A query was assigned to you", group: "Tasks" },
  { type: "change_request_assigned", label: "A change request was assigned to you", group: "Tasks" },
  { type: "activity_assigned", label: "A site activity was assigned to you", group: "Tasks" },
  { type: "bim_issue_assigned", label: "A coordination issue was assigned to you", group: "Tasks" },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["type"];

export const NOTIFICATION_TYPE_VALUES = NOTIFICATION_TYPES.map((t) => t.type) as readonly NotificationType[];

export function isNotificationType(value: string): value is NotificationType {
  return NOTIFICATION_TYPES.some((t) => t.type === value);
}

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

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  group: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationPreferenceRow {
  id: string;
  user_id: string;
  type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}
