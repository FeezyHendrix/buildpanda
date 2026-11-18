import { useMemo } from "react";
import { CreateActivityDialog } from "@/components/molecules/create-activity-dialog";
import { useCreateActivity } from "@/hooks/use-activities";
import { errorMessage } from "@/lib/api-error";
import type { Activity, ProjectPhase } from "@/lib/project-types";
import type { AddRowTarget } from "../use-schedule-editor";

/**
 * The form behind the chart's "+": a new work item under (or beside) the row it
 * was pressed on, starting from that row's milestone and dates. It is saved by
 * the server before it is drawn, so the chart never shows a row that is not real.
 */
export function ScheduleAddRow({
  projectId,
  phases,
  activities,
  target,
  onClose,
}: {
  projectId: string;
  phases: ProjectPhase[];
  activities: Activity[];
  target: AddRowTarget | null;
  onClose: () => void;
}) {
  const create = useCreateActivity();
  const row = activities.find((a) => a.id === target?.target);
  const parentActivityId = row ? (target?.mode === "child" ? row.id : row.parentActivityId) : null;
  // "+" on a milestone's summary row adds the work item to that milestone.
  const phaseId = row?.phaseId ?? phases.find((p) => p.id === target?.target)?.id ?? null;
  // Stable while the form is open: the dialog resets its fields whenever the prefill changes.
  const prefill = useMemo(
    () => ({ name: "", activityType: "", phaseId, plannedStartAt: row?.plannedStartAt, plannedEndAt: row?.plannedEndAt }),
    [phaseId, row?.plannedStartAt, row?.plannedEndAt],
  );

  return (
    <CreateActivityDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          create.reset();
          onClose();
        }
      }}
      phases={phases}
      prefill={prefill}
      predecessorOptions={activities.map((a) => ({ id: a.id, name: a.name }))}
      isSubmitting={create.isPending}
      error={errorMessage(create.error, "") || null}
      errorSource={create.error}
      onSubmit={(values) => create.mutate({ projectId, ...values, parentActivityId }, { onSuccess: onClose })}
    />
  );
}

ScheduleAddRow.displayName = "ScheduleAddRow";
