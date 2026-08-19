import { config } from "../../config/index.ts";
import {
  notificationEmail,
  type EmailAccent,
} from "../../lib/email-templates.ts";
import type { NotificationType } from "./types.ts";

export interface NotificationEmailInput {
  recipientName: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  ctaUrl: string | null;
  entityId?: string | null;
}

interface TypePresentation {
  eyebrow: string;
  accent: EmailAccent;
  ctaLabel: string;
}

const PRESENTATION: Record<NotificationType, TypePresentation> = {
  update_posted: { eyebrow: "Project update", accent: "brand", ctaLabel: "View Update" },
  update_draft_ready: { eyebrow: "Draft ready to review", accent: "brand", ctaLabel: "Review Draft" },
  update_action_required: { eyebrow: "Action required", accent: "warning", ctaLabel: "View Update" },
  inspection_scheduled: { eyebrow: "Inspection scheduled", accent: "brand", ctaLabel: "View Inspection" },
  milestone_released: { eyebrow: "Payment released", accent: "success", ctaLabel: "View Payment" },
  milestone_disputed: { eyebrow: "Payment disputed", accent: "danger", ctaLabel: "View Dispute" },
  document_uploaded: { eyebrow: "New document", accent: "brand", ctaLabel: "View Document" },
  action_item_due: { eyebrow: "Action item due", accent: "warning", ctaLabel: "View Action Item" },
  action_item_assigned: { eyebrow: "Action item assigned", accent: "brand", ctaLabel: "View Action Item" },
  task_assigned: { eyebrow: "Task assigned", accent: "brand", ctaLabel: "View Task" },
  task_high_priority: { eyebrow: "High priority", accent: "danger", ctaLabel: "View Task" },
  rfi_assigned: { eyebrow: "RFI — ball in your court", accent: "brand", ctaLabel: "View RFI" },
  rfi_answered: { eyebrow: "RFI answered", accent: "success", ctaLabel: "View RFI" },
  rfi_due: { eyebrow: "RFI due", accent: "warning", ctaLabel: "View RFI" },
  query_assigned: { eyebrow: "Query assigned", accent: "brand", ctaLabel: "View Query" },
  change_request_assigned: { eyebrow: "Change request assigned", accent: "brand", ctaLabel: "View Change Request" },
  activity_assigned: { eyebrow: "Site activity assigned", accent: "brand", ctaLabel: "View Activity" },
  bim_issue_assigned: { eyebrow: "Coordination issue assigned", accent: "brand", ctaLabel: "View Issue" },
  chat_mention: { eyebrow: "You were mentioned", accent: "brand", ctaLabel: "Open Chat" },
  chat_dm: { eyebrow: "New message", accent: "brand", ctaLabel: "Open Chat" },
  action_item_blocked: { eyebrow: "Action item blocked", accent: "danger", ctaLabel: "View Action Item" },
  action_item_resolved: { eyebrow: "Action item resolved", accent: "success", ctaLabel: "View Action Item" },
  query_answered: { eyebrow: "Query answered", accent: "success", ctaLabel: "View Query" },
  change_request_decided: { eyebrow: "Change request decided", accent: "brand", ctaLabel: "View Change Request" },
  approval_requested: { eyebrow: "Approval needed", accent: "warning", ctaLabel: "Review & Approve" },
  approval_decided: { eyebrow: "Approval decided", accent: "brand", ctaLabel: "View Approval" },
  selection_created: { eyebrow: "Selection needed", accent: "warning", ctaLabel: "View Selection" },
  selection_decided: { eyebrow: "Selection decided", accent: "brand", ctaLabel: "View Selection" },
  decision_reminder: { eyebrow: "Decision needed", accent: "warning", ctaLabel: "Make a Decision" },
  decision_escalated: { eyebrow: "Awaiting client decision", accent: "danger", ctaLabel: "View Item" },
  inspection_failed: { eyebrow: "Inspection — action required", accent: "danger", ctaLabel: "View Inspection" },
  invoice_submitted: { eyebrow: "Invoice submitted", accent: "brand", ctaLabel: "View Invoice" },
  invoice_overdue: { eyebrow: "Invoice overdue", accent: "danger", ctaLabel: "View Invoice" },
  permit_expiring: { eyebrow: "Permit expiring soon", accent: "warning", ctaLabel: "View Permit" },
  permit_expired: { eyebrow: "Permit expired", accent: "danger", ctaLabel: "View Permit" },
  key_date_approaching: { eyebrow: "Key date approaching", accent: "warning", ctaLabel: "View Key Date" },
  key_date_missed: { eyebrow: "Key date missed", accent: "danger", ctaLabel: "View Key Date" },
  risk_high_added: { eyebrow: "High-severity risk", accent: "danger", ctaLabel: "View Risk" },
  budget_overrun: { eyebrow: "Budget over plan", accent: "warning", ctaLabel: "View Budget" },
  team_member_added: { eyebrow: "Added to project", accent: "brand", ctaLabel: "Open Project" },
  ai_health_drop: { eyebrow: "Project health dropped", accent: "warning", ctaLabel: "View Insights" },
  material_negative_stock: { eyebrow: "Negative stock", accent: "warning", ctaLabel: "View Materials" },
  material_low_stock: { eyebrow: "Low stock", accent: "warning", ctaLabel: "View Materials" },
  material_reorder_created: { eyebrow: "Reorder created", accent: "brand", ctaLabel: "View Materials" },
};

const GENERIC: TypePresentation = {
  eyebrow: "Notification",
  accent: "brand",
  ctaLabel: "Open BuildPanda",
};

/**
 * Where each notification type lives, as a path under /project/:id.
 *
 * Only tasks (`?task=`) and site activities (path segment) can focus a single
 * record from the URL today; every other screen opens its detail dialog from
 * component state. Those entries therefore ignore `entityId` rather than
 * inventing a parameter the page does not read. To make one of them
 * item-level: teach the page to read the id from the URL, update its entry
 * here, and pass `entityId` at that type's notify() call site.
 *
 * Total Record on purpose: a new NotificationType fails the build until it is
 * given a destination, which is how they all ended up on the overview.
 */
const SECTION: Record<NotificationType, (entityId: string | null) => string> = {
  update_posted: () => "updates",
  update_draft_ready: () => "updates",
  update_action_required: () => "updates",

  task_assigned: (id) => (id ? `tasks?task=${encodeURIComponent(id)}` : "tasks"),
  task_high_priority: (id) => (id ? `tasks?task=${encodeURIComponent(id)}` : "tasks"),
  activity_assigned: (id) => (id ? `schedules/activities/${encodeURIComponent(id)}` : "schedules/activities"),

  action_item_due: () => "action-items",
  action_item_assigned: () => "action-items",
  action_item_blocked: () => "action-items",
  action_item_resolved: () => "action-items",

  rfi_assigned: () => "rfis",
  rfi_answered: () => "rfis",
  rfi_due: () => "rfis",
  query_assigned: () => "queries",
  query_answered: () => "queries",
  approval_requested: () => "approvals",
  approval_decided: () => "approvals",
  change_request_assigned: () => "change-requests",
  change_request_decided: () => "change-requests",
  selection_created: () => "selections",
  selection_decided: () => "selections",
  decision_reminder: () => "whats-next",
  decision_escalated: () => "whats-next",

  inspection_scheduled: () => "inspections",
  inspection_failed: () => "inspections",
  document_uploaded: () => "documents",
  permit_expiring: () => "permits",
  permit_expired: () => "permits",
  key_date_approaching: () => "key-dates",
  key_date_missed: () => "key-dates",
  risk_high_added: () => "whats-next",

  milestone_released: () => "finances/milestone-payments",
  milestone_disputed: () => "finances/milestone-payments",
  invoice_submitted: () => "finances/invoices",
  invoice_overdue: () => "finances/invoices",
  budget_overrun: () => "finances/budget",

  material_negative_stock: () => "material-log",
  material_low_stock: () => "material-log",
  material_reorder_created: () => "materials",

  chat_mention: () => "chat",
  chat_dm: () => "chat",
  bim_issue_assigned: () => "bim",
  team_member_added: () => "team",
  ai_health_drop: () => "panda-ai",
};

function resolveUrl(
  type: NotificationType,
  projectId: string | null,
  entityId: string | null,
): string {
  const base = config.mail.appUrl.replace(/\/+$/, "");
  if (!projectId) return `${base}/dashboard`;
  const section = SECTION[type];
  if (!section) return `${base}/project/${projectId}/overview`;
  return `${base}/project/${projectId}/${section(entityId)}`;
}

export function buildNotificationEmail(
  input: NotificationEmailInput,
): { subject: string; html: string } {
  const preset = PRESENTATION[input.type] ?? GENERIC;
  return notificationEmail({
    recipientName: input.recipientName,
    eyebrow: preset.eyebrow,
    heading: input.title,
    message: input.body,
    accent: preset.accent,
    cta: {
      label: preset.ctaLabel,
      url: input.ctaUrl ?? resolveUrl(input.type, input.projectId, input.entityId ?? null),
    },
  });
}

export interface NotificationPushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Push reuses the email's presentation content: the same title/body the email
 * renders as heading/message, and the same CTA/deep-link resolution (explicit
 * ctaUrl, else the project overview / dashboard fallback).
 */
export function buildNotificationPush(input: {
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  ctaUrl: string | null;
  entityId?: string | null;
}): NotificationPushPayload {
  return {
    title: input.title,
    body: input.body,
    url: input.ctaUrl ?? resolveUrl(input.type, input.projectId, input.entityId ?? null),
  };
}
