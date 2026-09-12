import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
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
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { formatCurrency } from "@/lib/formatters";
import { ACTIVITY_STATUS_LABEL, ACTIVITY_STATUS_TONE } from "@/lib/project-meta";
import type { Activity } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { activitySchedule, formatDateSpan, formatVariance } from "./activity-helpers";

const COLUMN_COUNT = 9;

interface ActivitiesTableProps {
  activities: Activity[];
  totalCount: number;
  isPending: boolean;
  canManage: boolean;
  onEdit: (activity: Activity) => void;
  onRaiseDelay: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

export function ActivitiesTable({
  activities,
  totalCount,
  isPending,
  canManage,
  onEdit,
  onRaiseDelay,
  onDelete,
}: ActivitiesTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
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
                onEdit={() => onEdit(activity)}
                onRaiseDelay={() => onRaiseDelay(activity)}
                onDelete={() => onDelete(activity)}
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
  onEdit,
  onRaiseDelay,
  onDelete,
}: {
  activity: Activity;
  index: number;
  canManage: boolean;
  onEdit: () => void;
  onRaiseDelay: () => void;
  onDelete: () => void;
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
    <TableRow className="hover:bg-[#FAFAFA]">
      <TableCell>
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-[#000000]">
          {index + 1}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {titlePrefix}
            {activity.name}
          </span>
          {activity.isMilestone ? (
            <Badge tone="accent" size="sm">
              Milestone
            </Badge>
          ) : null}
        </div>
        {subLine ? <p className="mt-0.5 text-[12px] text-gray-400">{subLine}</p> : null}
      </TableCell>
      <TableCell>
        <Badge tone={ACTIVITY_STATUS_TONE[activity.status]} size="sm">
          {ACTIVITY_STATUS_LABEL[activity.status]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateSpan(activity.plannedStartAt, activity.plannedEndAt)}
        <p className="mt-0.5 text-[12px] text-gray-400">{schedule.plannedDays} days</p>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateSpan(activity.actualStartAt, activity.actualEndAt)}
        {schedule.actualDays !== null ? (
          <p className="mt-0.5 text-[12px] text-gray-400">{schedule.actualDays} days</p>
        ) : null}
      </TableCell>
      <TableCell
        className={cn(
          "whitespace-nowrap",
          schedule.variance === null
            ? undefined
            : schedule.variance > 0
              ? "text-red-600"
              : "text-[#1B8E45]",
        )}
      >
        {formatVariance(schedule.variance)}
      </TableCell>
      <TableCell
        className={cn("whitespace-nowrap", schedule.totalDelayCost > 0 ? "text-[#C26A00]" : undefined)}
      >
        {schedule.totalDelayCost > 0
          ? formatCurrency(schedule.totalDelayCost, schedule.delayCurrency)
          : "—"}
        {schedule.openDelays > 0 ? (
          <p className="mt-0.5 text-[12px] text-gray-400">{schedule.openDelays} open</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{activity.percentComplete}%</TableCell>
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
