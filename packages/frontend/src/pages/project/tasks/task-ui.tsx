import { Badge } from "@/components/atoms/badge";
import type { TaskEntityType, TaskLinkType, TaskPriority } from "@/lib/project-types";

export interface AssigneeOption {
  kind: "user" | "team";
  id: string;
  name: string;
}

export const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function htmlToText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").trim();
}

// The first image embedded in a task's description (data-file-id) becomes the
// card cover. We parse the id out of the stored HTML and resolve a fresh
// presigned URL on demand, mirroring the rich-text editor's resolution.
export function firstImageFileId(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/data-file-id="([^"]+)"/);
  return match ? match[1]! : null;
}

// Priority styling maps each level to a design-system Badge tone (colours live
// in the Badge atom, never hardcoded here) plus a distinct shape, so the level
// reads without relying on colour — robust for colour-blind users (WCAG 1.4.1).
export const PRIORITY_META: Record<
  TaskPriority,
  { tone: "info" | "warning" | "danger"; shape: "down" | "dash" | "up" }
> = {
  Low: { tone: "info", shape: "down" },
  Medium: { tone: "warning", shape: "dash" },
  High: { tone: "danger", shape: "up" },
};

export const PRIORITY_ORDER: TaskPriority[] = ["Low", "Medium", "High"];

export function PriorityIcon({ shape }: { shape: "down" | "dash" | "up" }) {
  return (
    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shape === "down" && <polyline points="6 9 12 15 18 9" />}
      {shape === "dash" && <line x1="5" y1="12" x2="19" y2="12" />}
      {shape === "up" && <polyline points="6 15 12 9 18 15" />}
    </svg>
  );
}

export function LinkGlyph() {
  return (
    <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge tone={meta.tone} size="sm">
      <PriorityIcon shape={meta.shape} />
      {priority}
    </Badge>
  );
}

export const LINK_TYPE_LABELS: Record<TaskLinkType, string> = {
  relates_to: "Relates to",
  blocks: "Blocks",
  blocked_by: "Blocked by",
  duplicates: "Duplicates",
};

export const LINK_TYPE_ORDER: TaskLinkType[] = ["blocks", "blocked_by", "relates_to", "duplicates"];

export const LINK_TYPE_TONE: Record<TaskLinkType, string> = {
  blocks: "bg-[#FEE2E2] text-[#B42318]",
  blocked_by: "bg-[#FEF0C7] text-[#B54708]",
  relates_to: "bg-[#EEF2FF] text-[#004DE7]",
  duplicates: "bg-[#F2F4F7] text-[#475467]",
};

export const ENTITY_META: Record<TaskEntityType, { label: string; route: string }> = {
  action_item: { label: "Action item", route: "action-items" },
  rfi: { label: "RFI", route: "rfis" },
  change_request: { label: "Change request", route: "change-requests" },
  material: { label: "Material", route: "materials" },
  invoice: { label: "Invoice", route: "finances/invoices" },
  milestone_payment: { label: "Milestone", route: "schedules/milestones" },
};

export const ENTITY_ORDER: TaskEntityType[] = [
  "action_item",
  "rfi",
  "change_request",
  "material",
  "invoice",
  "milestone_payment",
];
