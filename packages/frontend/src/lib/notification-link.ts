import { safeReturnPath } from "./return-path";
import type { Notification } from "@/lib/project-types";

const SECTION_BY_EXACT_TYPE: Record<string, string> = {
  update_posted: "updates",
  update_draft_ready: "updates",
  update_action_required: "updates",
  inspection_scheduled: "inspections",
  milestone_released: "finances/budget-invoices?tab=payments",
  milestone_disputed: "finances/budget-invoices?tab=payments",
  document_uploaded: "documents",
  task_assigned: "tasks",
  task_high_priority: "tasks",
  rfi_assigned: "rfis",
  rfi_answered: "rfis",
  rfi_due: "rfis",
  change_request_assigned: "change-requests",
  activity_assigned: "schedules/activities",
  bim_issue_assigned: "bim",
  chat_mention: "messages",
  chat_dm: "messages",
};

const SECTION_BY_PREFIX: Array<[string, string]> = [
  ["update", "updates"],
  ["inspection", "inspections"],
  ["milestone", "finances/budget-invoices?tab=payments"],
  ["document", "documents"],
  ["task", "tasks"],
  ["activity", "schedules/activities"],
  ["approval", "approvals"],
  ["selection", "selections"],
  ["invoice", "finances/budget-invoices?tab=invoices"],
  ["rfi", "rfis"],
  ["change_request", "change-requests"],
  ["bim", "bim"],
  ["chat", "messages"],
];

function sectionForType(type: string): string {
  if (SECTION_BY_EXACT_TYPE[type]) return SECTION_BY_EXACT_TYPE[type];
  const prefixed = SECTION_BY_PREFIX.find(([prefix]) => type.startsWith(prefix));
  return prefixed ? prefixed[1] : "overview";
}

// Older notifications fall back to their section.
export function notificationHref(notification: Pick<Notification, "type" | "projectId" | "ctaUrl">): string {
  const target = safeReturnPath(notification.ctaUrl);
  if (target) return target;
  if (!notification.projectId) return "/dashboard";
  return `/project/${notification.projectId}/${sectionForType(notification.type)}`;
}
