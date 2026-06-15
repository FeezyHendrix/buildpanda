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
  rfi_assigned: { eyebrow: "RFI — ball in your court", accent: "brand", ctaLabel: "View RFI" },
  rfi_answered: { eyebrow: "RFI answered", accent: "success", ctaLabel: "View RFI" },
  rfi_due: { eyebrow: "RFI due", accent: "warning", ctaLabel: "View RFI" },
  query_assigned: { eyebrow: "Query assigned", accent: "brand", ctaLabel: "View Query" },
  change_request_assigned: { eyebrow: "Change request assigned", accent: "brand", ctaLabel: "View Change Request" },
  activity_assigned: { eyebrow: "Site activity assigned", accent: "brand", ctaLabel: "View Activity" },
  bim_issue_assigned: { eyebrow: "Coordination issue assigned", accent: "brand", ctaLabel: "View Issue" },
  chat_mention: { eyebrow: "You were mentioned", accent: "brand", ctaLabel: "Open Chat" },
  chat_dm: { eyebrow: "New message", accent: "brand", ctaLabel: "Open Chat" },
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
