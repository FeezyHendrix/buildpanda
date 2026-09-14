export const NOTIFICATION_TYPES = [
  { type: "update_posted", label: "Project updates posted", group: "Project" },
  { type: "update_draft_ready", label: "Weekly client update draft ready to review", group: "Project" },
  { type: "update_action_required", label: "Action required on an update", group: "Project" },
  { type: "inspection_scheduled", label: "Inspection scheduled", group: "Project" },
  { type: "milestone_released", label: "Milestone payment released", group: "Payments" },
  { type: "milestone_disputed", label: "Milestone payment disputed", group: "Payments" },
  { type: "document_uploaded", label: "Document uploaded", group: "Documents" },
  { type: "task_assigned", label: "Task assigned to you", group: "Tasks" },
  { type: "task_high_priority", label: "A high-priority task needs your attention", group: "Tasks" },
  { type: "rfi_assigned", label: "RFI assigned to you (ball in court)", group: "RFIs" },
  { type: "rfi_answered", label: "RFI answered", group: "RFIs" },
  { type: "rfi_due", label: "RFI due or overdue", group: "RFIs" },
  { type: "change_request_assigned", label: "A change request was assigned to you", group: "Tasks" },
  { type: "activity_assigned", label: "A site activity was assigned to you", group: "Tasks" },
  { type: "bim_issue_assigned", label: "A coordination issue was assigned to you", group: "Tasks" },
  { type: "chat_mention", label: "You were mentioned in chat", group: "Messages" },
  { type: "chat_dm", label: "New direct message", group: "Messages" },
  { type: "change_request_decided", label: "A change request was approved or rejected", group: "Tasks" },
  { type: "approval_requested", label: "An approval needs your decision", group: "Approvals" },
  { type: "approval_decided", label: "An approval you submitted was decided", group: "Approvals" },
  { type: "selection_created", label: "A selection needs your decision", group: "Approvals" },
  { type: "selection_decided", label: "A selection was decided", group: "Approvals" },
  { type: "decision_reminder", label: "A pending decision needs your attention", group: "Approvals" },
  { type: "decision_escalated", label: "A client decision is overdue", group: "Approvals" },
  { type: "inspection_failed", label: "An inspection requires action", group: "Project" },
  { type: "invoice_submitted", label: "A vendor invoice was submitted", group: "Payments" },
  { type: "invoice_overdue", label: "An invoice is overdue", group: "Payments" },
  // The certificate lifecycle. A QS gets no signal from the finance module
  // without these: issuing a certificate, a client query on it, certification,
  // and the receipt — flagged when it lands after the due date.
  { type: "invoice_sent", label: "A certificate or invoice was issued", group: "Payments" },
  { type: "invoice_queried", label: "An invoice was queried by the client", group: "Payments" },
  { type: "invoice_approved", label: "An invoice was approved / certified", group: "Payments" },
  { type: "invoice_paid", label: "A payment was recorded against an invoice", group: "Payments" },
  { type: "invoice_paid_late", label: "A payment was recorded after the due date", group: "Payments" },
  { type: "invoice_voided", label: "A certificate was voided", group: "Payments" },
  { type: "change_request_submitted", label: "A change request was submitted for decision", group: "Tasks" },
  { type: "change_request_approved", label: "A change request was approved", group: "Tasks" },
  { type: "change_request_rejected", label: "A change request was rejected", group: "Tasks" },
  { type: "permit_expiring", label: "A permit is expiring soon", group: "Project" },
  { type: "permit_expired", label: "A permit has expired", group: "Project" },
  { type: "compliance_doc_expiring", label: "A compliance document is expiring soon", group: "Project" },
  { type: "compliance_doc_expired", label: "A compliance document has expired", group: "Project" },
  { type: "key_date_approaching", label: "A key date is approaching", group: "Project" },
  { type: "key_date_missed", label: "A key date was missed", group: "Project" },
  { type: "risk_high_added", label: "A high-severity risk was added", group: "Project" },
  { type: "budget_overrun", label: "A budget category is over plan", group: "Payments" },
  { type: "team_member_added", label: "You were added to a project", group: "Project" },
  { type: "ai_health_drop", label: "Project health score dropped", group: "Project" },
  { type: "material_negative_stock", label: "Material stock went negative", group: "Materials" },
  { type: "material_low_stock", label: "Material is running low", group: "Materials" },
  { type: "material_reorder_created", label: "An automatic reorder request was created", group: "Materials" },
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
  ctaUrl?: string | null;
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
  cta_url?: string | null;
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

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: Date | string;
  last_used_at: Date | string | null;
}
