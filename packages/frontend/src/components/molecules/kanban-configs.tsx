import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { formatDayMonth } from "@/lib/formatters";
import type {
  Approval,
  ApprovalStatus,
  ChangeRequest,
  ChangeStatus,
  InspectionReport,
  InspectionStatus,
  Permit,
  PermitStatus,
} from "@/lib/project-types";
import type { KanbanColumn } from "@/components/molecules/kanban-board";

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
  Approval,
  ChangeRequest,
  InspectionReport,
  Permit,
};
