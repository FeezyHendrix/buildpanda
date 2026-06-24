import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { AlertIcon } from "@/components/atoms/project-nav-icons";
import { useDeleteActivity } from "@/hooks/use-activities";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import type { Activity } from "@/lib/project-types";
import {
  ACTIVITY_STATUS_LABEL as STATUS_LABEL,
  ACTIVITY_STATUS_TONE as STATUS_TONE,
} from "@/lib/project-meta";

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
  const plannedDays = daysBetween(
    activity.plannedStartAt,
    activity.plannedEndAt,
  );
  const actualDays =
    activity.actualStartAt && activity.actualEndAt
      ? daysBetween(activity.actualStartAt, activity.actualEndAt)
      : null;
  const variance = actualDays !== null ? actualDays - plannedDays : null;
  const openDelays = activity.delays.filter((d) => d.resolvedAt === null);
  const totalCost = activity.delays.reduce((sum, d) => sum + d.costImpact, 0);

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900">
            {activity.name}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {activity.activityType}
            {activity.phaseName ? ` · ${activity.phaseName}` : ""}
            {activity.location ? ` · ${activity.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activity.isDelayed && (
            <Badge tone="danger" size="md" dot>
              Delayed
            </Badge>
          )}
          <Badge tone={STATUS_TONE[activity.status]} size="md">
            {STATUS_LABEL[activity.status]}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#FAFAFA] p-3 text-xs sm:grid-cols-4">
        <Stat label="Planned" value={`${plannedDays} d`} />
        <Stat
          label="Actual"
          value={actualDays !== null ? `${actualDays} d` : "-"}
        />
        <Stat
          label="Variance"
          value={
            variance === null
              ? "-"
              : variance > 0
                ? `+${variance} d`
                : `${variance} d`
          }
          tone={
            variance === null ? undefined : variance > 0 ? "danger" : "success"
          }
        />
        <Stat
          label="Delay cost"
          value={totalCost > 0 ? formatCurrency(totalCost, "NGN") : "-"}
          tone={totalCost > 0 ? "warning" : undefined}
        />
      </div>

      {activity.delays.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Delays ({activity.delays.length})
          </p>
          <ul className="flex flex-col gap-2">
            {activity.delays.slice(0, 3).map((delay) => (
              <li
                key={delay.id}
                className="flex items-start gap-3 rounded-xl border border-[#F0F0F0] bg-white p-3"
              >
                <AlertIcon className="mt-0.5 size-4 shrink-0 text-[#C72525]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {delay.reasonName}{" "}
                    <span className="text-xs font-normal text-gray-500">
                      · {delay.reasonCategory}
                    </span>
                  </p>
                  {delay.description && (
                    <p className="mt-0.5 text-xs text-gray-600 text-pretty">
                      {delay.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-500">
                    Started {formatTimeAgo(delay.startedAt)}{" "}
                    {delay.costImpact > 0 &&
                      `· cost ${formatCurrency(delay.costImpact, delay.currency)}`}{" "}
                    {delay.resolvedAt === null ? "· ongoing" : "· resolved"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex items-center justify-between border-t border-[#F0F0F0] pt-3">
        <span className="text-[11px] text-gray-400">
          {openDelays.length > 0
            ? `${openDelays.length} open delay${openDelays.length === 1 ? "" : "s"}`
            : "No open delays"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={onRaiseDelay}
          >
            <AlertIcon className="size-3.5" />
            Log a delay
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-red-500 hover:text-red-600"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </footer>

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
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[#C72525]"
      : tone === "success"
        ? "text-[#1B8E45]"
        : tone === "warning"
          ? "text-[#C26A00]"
          : "text-gray-900";
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 3600 * 1000)));
}
