import { useEffect, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { HoldPointBadge } from "@/components/molecules/hold-point-badge";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ACTIVITY_STATUS_LABEL, ACTIVITY_STATUS_TONE } from "@/lib/project-meta";
import type { Activity } from "@/lib/project-types";
import { activitySchedule, formatDateSpan, formatVariance } from "./activity-helpers";

const COLUMN_COUNT = 9;

interface ActivitiesTableProps {
  activities: Activity[];
  totalCount: number;
  isPending: boolean;
  canManage: boolean;
  /** Activity id -> title of a hold-point inspection that has not passed. */
  holdPoints?: ReadonlyMap<string, string>;
  onEdit: (activity: Activity) => void;
  onRaiseDelay: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  /** Opens the delay register for the activity — what "N open" points at. */
  onOpenDelays: (activity: Activity) => void;
  onProgressChange: (activity: Activity, percentComplete: number) => void;
}

const NO_HOLD_POINTS: ReadonlyMap<string, string> = new Map();

export function ActivitiesTable({
  activities,
  totalCount,
  isPending,
  canManage,
  holdPoints = NO_HOLD_POINTS,
  onEdit,
  onRaiseDelay,
  onDelete,
  onOpenDelays,
  onProgressChange,
}: ActivitiesTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[960px]">
        <TableHead>
          <tr>
            <TableHeaderCell className="w-10" />
            <TableHeaderCell>Activity</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Planned</TableHeaderCell>
            <TableHeaderCell>Actual</TableHeaderCell>
            <TableHeaderCell>Variance</TableHeaderCell>
            <TableHeaderCell>Delay cost</TableHeaderCell>
            <TableHeaderCell>Progress</TableHeaderCell>
            <TableHeaderCell className="w-10" />
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : activities.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<CalendarIcon />}
                title={totalCount === 0 ? "No activities yet" : "No activities match these filters"}
                description={
                  totalCount === 0
                    ? "Track field work to capture planned vs actual progress and delay causes."
                    : "Try clearing the search or status filter."
                }
              />
            </TableEmptyRow>
          ) : (
            activities.map((activity, idx) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={idx}
                canManage={canManage}
                holdPointTitle={holdPoints.get(activity.id) ?? null}
                onEdit={() => onEdit(activity)}
                onRaiseDelay={() => onRaiseDelay(activity)}
                onDelete={() => onDelete(activity)}
                onOpenDelays={() => onOpenDelays(activity)}
                onProgressChange={(percent) => onProgressChange(activity, percent)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

ActivitiesTable.displayName = "ActivitiesTable";

function ActivityRow({
  activity,
  index,
  canManage,
  holdPointTitle,
  onEdit,
  onRaiseDelay,
  onDelete,
  onOpenDelays,
  onProgressChange,
}: {
  activity: Activity;
  index: number;
  canManage: boolean;
  holdPointTitle: string | null;
  onEdit: () => void;
  onRaiseDelay: () => void;
  onDelete: () => void;
  onOpenDelays: () => void;
  onProgressChange: (percentComplete: number) => void;
}) {
  const schedule = activitySchedule(activity);
  const titlePrefix = activity.wbsCode ? `${activity.wbsCode} ` : "";
  const subLine = [
    activity.isSummary ? "Programme summary" : activity.activityType,
    activity.phaseName,
    activity.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TableRow className="hover:bg-surface-alt">
      <TableCell>
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-surface-alt text-xs font-medium text-ink">
          {index + 1}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">
            {titlePrefix}
            {activity.name}
          </span>
          {activity.isMilestone ? (
            <Badge tone="accent" size="sm">
              Milestone
            </Badge>
          ) : null}
          {/* Read-only here: the work is gated, but the result is the
              inspector's to record on the inspections page. */}
          {holdPointTitle ? <HoldPointBadge inspectionTitle={holdPointTitle} /> : null}
        </div>
        {subLine ? <p className="mt-0.5 text-xs text-ink-muted">{subLine}</p> : null}
      </TableCell>
      <TableCell>
        <Badge tone={ACTIVITY_STATUS_TONE[activity.status]} size="sm">
          {ACTIVITY_STATUS_LABEL[activity.status]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateSpan(activity.plannedStartAt, activity.plannedEndAt)}
        <p className="mt-0.5 text-xs text-ink-muted">{schedule.plannedDays} working days</p>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateSpan(activity.actualStartAt, activity.actualEndAt)}
        {schedule.actualDays !== null ? (
          <p className="mt-0.5 text-xs text-ink-muted">{schedule.actualDays} days</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {schedule.variance === null ? (
          "—"
        ) : (
          // Status reads as a pill with a dot, the same way every other status
          // on the page does; the sign says late or early, the tone confirms it.
          <Badge dot tone={schedule.variance > 0 ? "danger" : schedule.variance < 0 ? "success" : "neutral"}>
            {formatVariance(schedule.variance)}
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {schedule.totalDelayCost > 0
          ? formatCurrency(schedule.totalDelayCost, schedule.delayCurrency)
          : "—"}
        {/* The count was dead text for the life of the job (F16): it is the way
            into the delay register, where a delay is resolved or amended. */}
        {activity.delays.length > 0 ? (
          <div className="mt-1">
            <button
              type="button"
              onClick={onOpenDelays}
              className="rounded outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              <Badge dot tone={schedule.openDelays > 0 ? "warning" : "success"} className="cursor-pointer hover:underline">
                {schedule.openDelays > 0
                  ? `${schedule.openDelays} open`
                  : `${activity.delays.length} resolved`}
              </Badge>
            </button>
          </div>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        <InlineProgress
          value={activity.percentComplete}
          canManage={canManage}
          onCommit={onProgressChange}
        />
      </TableCell>
      <TableCell className="px-3">
        {canManage ? (
          <div className="flex items-center justify-end gap-1">
            <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" onClick={onRaiseDelay}>
              Log a delay
            </Button>
            <RowActionsMenu ariaLabel="Activity actions" onEdit={onEdit} onDelete={onDelete} />
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

ActivityRow.displayName = "ActivityRow";

/**
 * Progress was unsettable anywhere in the app, so "Construction progress" sat
 * at 0% for the life of a job (finding F25). It belongs on the row a PM is
 * already looking at; the drawer keeps the slider for a considered edit.
 */
function InlineProgress({
  value,
  canManage,
  onCommit,
}: {
  value: number;
  canManage: boolean;
  onCommit: (percentComplete: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));

  // The server owns this number — a cascade or a daily log can move it, so the
  // input follows the row rather than holding a stale copy.
  useEffect(() => {
    setDraft(String(Math.round(value)));
  }, [value]);

  if (!canManage) return <span>{Math.round(value)}%</span>;

  function commit(): void {
    const next = Math.max(0, Math.min(100, Math.round(Number(draft) || 0)));
    setDraft(String(next));
    if (next !== Math.round(value)) onCommit(next);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label="Percent complete"
        type="number"
        min={0}
        max={100}
        step={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(INPUT_CLASS, "h-8 w-16 px-2 text-right tabular-nums")}
      />
      <span className="text-ink-muted">%</span>
    </span>
  );
}

InlineProgress.displayName = "InlineProgress";
