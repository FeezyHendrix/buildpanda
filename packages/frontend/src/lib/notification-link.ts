import type { Notification } from "@/lib/project-types";

const SECTION_BY_EXACT_TYPE: Record<string, string> = {
  update_posted: "updates",
  update_draft_ready: "updates",
  update_action_required: "updates",
  inspection_scheduled: "inspections",
  milestone_released: "finances/payments",
  milestone_disputed: "finances/payments",
  document_uploaded: "documents",
  action_item_due: "action-items",
  action_item_assigned: "action-items",
  action_item_blocked: "action-items",
  action_item_resolved: "action-items",
  task_assigned: "tasks",
  task_high_priority: "tasks",
  rfi_assigned: "rfis",
  rfi_answered: "rfis",
  rfi_due: "rfis",
  query_assigned: "queries",
  change_request_assigned: "change-requests",
  activity_assigned: "tasks",
  bim_issue_assigned: "bim",
  chat_mention: "messages",
  chat_dm: "messages",
};

const SECTION_BY_PREFIX: Array<[string, string]> = [
  ["update", "updates"],
  ["inspection", "inspections"],
  ["milestone", "finances/payments"],
  ["document", "documents"],
  ["action_item", "action-items"],
  ["task", "tasks"],
  ["activity", "tasks"],
  ["rfi", "rfis"],
  ["query", "queries"],
  ["change_request", "change-requests"],
  ["bim", "bim"],
  ["chat", "messages"],
];

function sectionForType(type: string): string {
  if (SECTION_BY_EXACT_TYPE[type]) return SECTION_BY_EXACT_TYPE[type];
  const prefixed = SECTION_BY_PREFIX.find(([prefix]) => type.startsWith(prefix));
  return prefixed ? prefixed[1] : "overview";
}

// In-app notifications carry only type + projectId (no stored deep link), so the
// destination is derived from the type's project section, mirroring the email CTA.
export function notificationHref(notification: Pick<Notification, "type" | "projectId">): string {
  if (!notification.projectId) return "/dashboard";
  return `/project/${notification.projectId}/${sectionForType(notification.type)}`;
}
