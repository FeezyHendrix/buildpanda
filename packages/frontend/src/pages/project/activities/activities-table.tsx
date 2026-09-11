import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { formatCurrency } from "@/lib/formatters";
import { ACTIVITY_STATUS_LABEL, ACTIVITY_STATUS_TONE } from "@/lib/project-meta";
import type { Activity } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { activitySchedule, formatDateSpan, formatVariance } from "./activity-helpers";

const HEAD_CELL = "px-4 py-3 text-[11px] font-semibold text-black-300 capitalize";
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
            <tr>
              <th className={cn("w-10", HEAD_CELL)} />
              <th className={HEAD_CELL}>Activity</th>
              <th className={HEAD_CELL}>Status</th>
              <th className={HEAD_CELL}>Planned</th>
              <th className={HEAD_CELL}>Actual</th>
              <th className={HEAD_CELL}>Variance</th>
              <th className={HEAD_CELL}>Delay cost</th>
              <th className={HEAD_CELL}>Progress</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {isPending ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4">
                  <div className="flex justify-center py-10">
                    <Spinner size="md" />
                  </div>
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4">
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
                </td>
              </tr>
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
          </tbody>
        </table>
      </div>
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
    <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
      <td className="px-4 py-3">
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-[#000000]">
          {index + 1}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-gray-900">
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
      </td>
      <td className="px-4 py-3">
        <Badge tone={ACTIVITY_STATUS_TONE[activity.status]} size="sm">
          {ACTIVITY_STATUS_LABEL[activity.status]}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-gray-900">
        {formatDateSpan(activity.plannedStartAt, activity.plannedEndAt)}
        <p className="mt-0.5 text-[12px] text-gray-400">{schedule.plannedDays} days</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-gray-900">
        {formatDateSpan(activity.actualStartAt, activity.actualEndAt)}
        {schedule.actualDays !== null ? (
          <p className="mt-0.5 text-[12px] text-gray-400">{schedule.actualDays} days</p>
        ) : null}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-[13px]",
          schedule.variance === null
            ? "text-gray-900"
            : schedule.variance > 0
              ? "text-red-600"
              : "text-[#1B8E45]",
        )}
      >
        {formatVariance(schedule.variance)}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-[13px]",
          schedule.totalDelayCost > 0 ? "text-[#C26A00]" : "text-gray-900",
        )}
      >
        {schedule.totalDelayCost > 0
          ? formatCurrency(schedule.totalDelayCost, schedule.delayCurrency)
          : "—"}
        {schedule.openDelays > 0 ? (
          <p className="mt-0.5 text-[12px] text-gray-400">{schedule.openDelays} open</p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-gray-900">
        {activity.percentComplete}%
      </td>
      <td className="px-3 py-3">
        {canManage ? (
          <div className="flex items-center justify-end gap-1">
            <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" onClick={onRaiseDelay}>
              Log a delay
            </Button>
            <RowActionsMenu ariaLabel="Activity actions" onEdit={onEdit} onDelete={onDelete} />
          </div>
        ) : null}
      </td>
    </tr>
  );
}
