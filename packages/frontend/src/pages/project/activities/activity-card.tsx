import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { useDeleteActivity } from "@/hooks/use-activities";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/project-types";

const STAT_COLUMNS = ["Planned", "Actual", "Variance", "Delay cost"] as const;

export function ActivityCard({
  projectId,
  activity,
  onEdit,
  onRaiseDelay,
}: {
  projectId: string;
  activity: Activity;
  onEdit: () => void;
  onRaiseDelay: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteActivity = useDeleteActivity();

  const plannedDays = daysBetween(activity.plannedStartAt, activity.plannedEndAt);
  const actualDays =
    activity.actualStartAt && activity.actualEndAt
      ? daysBetween(activity.actualStartAt, activity.actualEndAt)
      : null;
  const variance = actualDays !== null ? actualDays - plannedDays : null;
  const openDelays = activity.delays.filter((d) => d.resolvedAt === null);
  const totalCost = activity.delays.reduce((sum, d) => sum + d.costImpact, 0);
  const titlePrefix = activity.wbsCode ? `${activity.wbsCode} ` : "";

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 leading-snug">
              {titlePrefix}{activity.name}
            </p>
            <p className="mt-0.5 text-[12px] text-gray-400">
              {activity.isSummary ? "Programme summary" : activity.activityType}
              {activity.phaseName ? ` · ${activity.phaseName}` : ""}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
          </div>
          <div className="ml-3">
            <RowActionsMenu
              ariaLabel="Card actions"
              onEdit={onEdit}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>

        {/* Stats table */}
        <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-[#F0F0F0]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#FAFAFA]">
                {STAT_COLUMNS.map((col) => (
                  <th key={col} className="px-4 py-2.5 text-[11px] font-semibold text-black-300 capitalize">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#F0F0F0] bg-white">
                <td className="px-4 py-3 text-[13px] text-gray-900">
                  {plannedDays} days
                </td>
                <td className="px-4 py-3 text-[13px] text-gray-900">
                  {actualDays !== null ? `${actualDays} days` : "—"}
                </td>
                <td className={cn("px-4 py-3 text-[13px]",
                  variance === null ? "text-gray-900"
                  : variance > 0 ? "text-red-600"
                  : "text-[#1B8E45]",
                )}>
                  {variance === null ? "—" : variance > 0 ? `+${variance} days` : `${variance} days`}
                </td>
                <td className={cn("px-4 py-3 text-[13px]",
                  totalCost > 0 ? "text-[#C26A00]" : "text-gray-900",
                )}>
                  {totalCost > 0 ? formatCurrency(totalCost, "NGN") : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Delays list (when present) */}
        {activity.delays.length > 0 ? (
          <div className="mx-5 mb-4 flex flex-col gap-2">
            {activity.delays.slice(0, 3).map((delay) => (
              <div
                key={delay.id}
                className="flex items-start gap-3 rounded-xl border border-[#F0F0F0] bg-white px-4 py-3"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <span className="size-1.5 rounded-full bg-red-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900">
                    {delay.reasonName}
                    <span className="ml-1 text-[12px] font-normal text-gray-400">
                      · {delay.reasonCategory}
                    </span>
                  </p>
                  {delay.description ? (
                    <p className="mt-0.5 text-[12px] text-gray-500 text-pretty">
                      {delay.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-gray-400">
                    Started {formatTimeAgo(delay.startedAt)}
                    {delay.costImpact > 0
                      ? ` · cost ${formatCurrency(delay.costImpact, delay.currency)}`
                      : ""}
                    {delay.resolvedAt === null ? " · ongoing" : " · resolved"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#F0F0F0] px-5 py-3">
          <span className="text-[12px] text-gray-400">
            {openDelays.length > 0
              ? `${openDelays.length} open delay${openDelays.length === 1 ? "" : "s"}`
              : "No open delays"}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={onRaiseDelay}>
            Log a delay
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() =>
          deleteActivity.mutate({ projectId, activityId: activity.id })
        }
        title="Delete activity"
        description="This permanently removes the activity and its logged delays. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 3600 * 1000)));
}
