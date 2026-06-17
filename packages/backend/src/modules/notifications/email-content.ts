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
}

interface TypePresentation {
  eyebrow: string;
  accent: EmailAccent;
  ctaLabel: string;
}

const PRESENTATION: Record<NotificationType, TypePresentation> = {
  update_posted: { eyebrow: "Project update", accent: "brand", ctaLabel: "View Update" },
  update_action_required: { eyebrow: "Action required", accent: "warning", ctaLabel: "View Update" },
  inspection_scheduled: { eyebrow: "Inspection scheduled", accent: "brand", ctaLabel: "View Inspection" },
  milestone_released: { eyebrow: "Payment released", accent: "success", ctaLabel: "View Payment" },
  milestone_disputed: { eyebrow: "Payment disputed", accent: "danger", ctaLabel: "View Dispute" },
  document_uploaded: { eyebrow: "New document", accent: "brand", ctaLabel: "View Document" },
  action_item_due: { eyebrow: "Action item due", accent: "warning", ctaLabel: "View Action Item" },
  action_item_assigned: { eyebrow: "Action item assigned", accent: "brand", ctaLabel: "View Action Item" },
  task_assigned: { eyebrow: "Task assigned", accent: "brand", ctaLabel: "View Task" },
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
};

const GENERIC: TypePresentation = {
  eyebrow: "Notification",
  accent: "brand",
  ctaLabel: "Open BuildPanda",
};

function fallbackUrl(projectId: string | null): string {
  const base = config.mail.appUrl.replace(/\/+$/, "");
  return projectId ? `${base}/project/${projectId}/overview` : `${base}/dashboard`;
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
      url: input.ctaUrl ?? fallbackUrl(input.projectId),
    },
  });
}
