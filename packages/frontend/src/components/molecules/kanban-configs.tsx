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
  { status: "Open", label: "Open", accent: "bg-ink-disabled" },
  { status: "InProgress", label: "In progress", accent: "bg-primary-500" },
  { status: "Blocked", label: "Blocked", accent: "bg-amber-500" },
  { status: "Resolved", label: "Resolved", accent: "bg-emerald-500" },
];

export const QUERY_COLUMNS: KanbanColumn<QueryStatus>[] = [
  { status: "Open", label: "Open", accent: "bg-amber-500" },
  { status: "Answered", label: "Answered", accent: "bg-primary-500" },
  { status: "Closed", label: "Closed", accent: "bg-emerald-500" },
];

export const APPROVAL_COLUMNS: KanbanColumn<ApprovalStatus>[] = [
  { status: "Pending", label: "Pending", accent: "bg-amber-500" },
  { status: "Resubmit", label: "Resubmit", accent: "bg-orange-500" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-negative-500" },
];

export const CHANGE_COLUMNS: KanbanColumn<ChangeStatus>[] = [
  { status: "Draft", label: "Draft", accent: "bg-ink-disabled" },
  { status: "Submitted", label: "Submitted", accent: "bg-primary-500" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Executed", label: "Executed", accent: "bg-accent-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-negative-500" },
];

export const PERMIT_COLUMNS: KanbanColumn<PermitStatus>[] = [
  { status: "NotStarted", label: "Not started", accent: "bg-ink-disabled" },
  { status: "Applied", label: "Applied", accent: "bg-primary-500" },
  { status: "Approved", label: "Approved", accent: "bg-emerald-500" },
  { status: "Rejected", label: "Rejected", accent: "bg-negative-500" },
  { status: "Expired", label: "Expired", accent: "bg-amber-500" },
];

export const INSPECTION_COLUMNS: KanbanColumn<InspectionStatus>[] = [
  { status: "Scheduled", label: "Scheduled", accent: "bg-primary-500" },
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
          <span className="truncate text-xs text-ink-muted">{name}</span>
        </>
      ) : (
        <span className="text-xs text-ink-muted">Unassigned</span>
      )}
      {due && <span className="ml-2 shrink-0 text-xs text-ink-muted">{formatDayMonth(due)}</span>}
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
        <Badge tone="info" size="sm">
          Repeats {recurrenceShort(item.recurrenceUnit, item.recurrenceInterval)}
        </Badge>
      )}
    </>
  );
}

export function dueMeta(due: string | null) {
  if (!due) return null;
  return (
    <Badge tone="neutral" size="sm">
      Due {formatDayMonth(due)}
    </Badge>
  );
}

export function textMeta(text: string | null) {
  if (!text) return null;
  return (
    <Badge tone="neutral" size="sm">

    </Badge>
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
