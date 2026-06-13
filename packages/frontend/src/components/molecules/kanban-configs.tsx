import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { formatDayMonth } from "@/lib/formatters";
import { ACTION_PRIORITY_META } from "@/components/molecules/action-item-detail-dialog";
import type {
  ActionItem,
  ActionStatus,
  Approval,
  ApprovalStatus,
  ChangeRequest,
  ChangeStatus,
  InspectionReport,
  InspectionStatus,
  Permit,
  PermitStatus,
  RecurrenceUnit,
  SiteQuery,
  QueryStatus,
} from "@/lib/project-types";
import type { KanbanColumn } from "@/components/molecules/kanban-board";

export const ACTION_ITEM_COLUMNS: KanbanColumn<ActionStatus>[] = [
  { status: "Open", label: "Open", accent: "bg-gray-300" },
  { status: "InProgress", label: "In progress", accent: "bg-[#004DE7]" },
  { status: "Blocked", label: "Blocked", accent: "bg-amber-500" },
  { status: "Resolved", label: "Resolved", accent: "bg-emerald-500" },
];

export const QUERY_COLUMNS: KanbanColumn<QueryStatus>[] = [
  { status: "Open", label: "Open", accent: "bg-amber-500" },
  { status: "Answered", label: "Answered", accent: "bg-[#004DE7]" },
  { status: "Closed", label: "Closed", accent: "bg-emerald-500" },
];

export const APPROVAL_COLUMNS: KanbanColumn<ApprovalStatus>[] = [
  { status: "Pending", label: "Pending", accent: "bg-amber-500" },
  { status: "Resubmit", label: "Resubmit", accent: "bg-orange-500" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-red-500" },
];

export const CHANGE_COLUMNS: KanbanColumn<ChangeStatus>[] = [
  { status: "Draft", label: "Draft", accent: "bg-gray-300" },
  { status: "Submitted", label: "Submitted", accent: "bg-[#004DE7]" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-red-500" },
];

export const PERMIT_COLUMNS: KanbanColumn<PermitStatus>[] = [
  { status: "NotStarted", label: "Not started", accent: "bg-gray-300" },
  { status: "Applied", label: "Applied", accent: "bg-[#004DE7]" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-red-500" },
  { status: "Expired", label: "Expired", accent: "bg-amber-500" },
];

export const INSPECTION_COLUMNS: KanbanColumn<InspectionStatus>[] = [
  { status: "Scheduled", label: "Scheduled", accent: "bg-[#004DE7]" },
  { status: "Action Required", label: "Action required", accent: "bg-amber-500" },
  { status: "Completed", label: "Completed", accent: "bg-emerald-500" },
];

function recurrenceShort(unit: RecurrenceUnit, interval: number | null): string {
  const count = interval ?? 1;
  const noun = unit === "day" ? "day" : unit === "week" ? "week" : "month";
  return count === 1 ? `every ${noun}` : `every ${count} ${noun}s`;
}

export function assigneeFooter(name: string | null, due: string | null) {
  return (
    <>
      {name ? (
        <>
          <Avatar name={name} size="sm" />
          <span className="truncate text-xs text-gray-500">{name}</span>
        </>
      ) : (
        <span className="text-xs text-gray-400">Unassigned</span>
      )}
      {due && <span className="ml-2 shrink-0 text-xs text-gray-500">{formatDayMonth(due)}</span>}
    </>
  );
}

export function actionItemMeta(item: ActionItem) {
  return (
    <>
      <Badge tone={ACTION_PRIORITY_META[item.priority].tone} size="sm">
        {item.priority}
      </Badge>
      {item.recurrenceUnit && (
        <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#004DE7]">
          Repeats {recurrenceShort(item.recurrenceUnit, item.recurrenceInterval)}
        </span>
      )}
    </>
  );
}

export function dueMeta(due: string | null) {
  if (!due) return null;
  return (
    <span className="rounded-md bg-[#F6F6F6] px-2 py-0.5 text-xs font-medium text-gray-600">
      Due {formatDayMonth(due)}
    </span>
  );
}

export function textMeta(text: string | null) {
  if (!text) return null;
  return (
    <span className="rounded-md bg-[#F6F6F6] px-2 py-0.5 text-xs font-medium text-gray-600">
      {text}
    </span>
  );
}

export type {
  ActionItem,
  Approval,
  ChangeRequest,
  InspectionReport,
  Permit,
  SiteQuery,
};
