import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  AlertIcon,
  CalendarIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import {
  CreateActivityDialog,
  type ActivityPrefill,
} from "@/components/molecules/create-activity-dialog";
import { ActivityTemplateDialog } from "@/components/molecules/activity-template-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDelayDialog } from "@/components/molecules/raise-delay-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCreateActivity,
  useDeleteActivity,
  useProjectActivities,
  useRaiseDelay,
  useUpdateActivity,
} from "@/hooks/use-activities";
import { useDelayReasons } from "@/hooks/use-delay-reasons";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import type { Activity } from "@/lib/project-types";
import {
  ACTIVITY_STATUS_LABEL as STATUS_LABEL,
  ACTIVITY_STATUS_TONE as STATUS_TONE,
} from "@/lib/project-meta";

export default function ProjectActivities() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: activities = [], isPending } = useProjectActivities(project.id);
  const { data: reasons = [] } = useDelayReasons();

  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [prefill, setPrefill] = useState<ActivityPrefill | null>(null);
  const [editingTarget, setEditingTarget] = useState<Activity | null>(null);
  const [delayTarget, setDelayTarget] = useState<Activity | null>(null);

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const raiseDelay = useRaiseDelay();

  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  function startNewActivity(): void {
    setEditingTarget(null);
    setPrefill(null);
    setTemplateOpen(true);
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Site Activities"
        description="Track discrete work items with planned vs actual times and delay causes."
        actions={canManage ? (
          <Button
            variant="primary"
            size="md"
            onClick={startNewActivity}
          >
            <PlusIcon className="size-4" />
            New activity
          </Button>
        ) : undefined}
      />

      <section className="mt-8 flex flex-col gap-4">
        {isPending ? (
          <Card padding="lg" className="text-center text-sm text-gray-500">
            Loading activities…
          </Card>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="No activities yet"
            description="Track field work to capture planned vs actual progress and delay causes."
            action={canManage ? (
              <Button
                variant="primary"
                size="md"
                onClick={startNewActivity}
              >
                <PlusIcon className="size-4" />
                Add the first one
              </Button>
            ) : undefined}
          />
        ) : (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              projectId={project.id}
              activity={activity}
              onEdit={() => {
                setEditingTarget(activity);
                setCreateOpen(true);
              }}
              onRaiseDelay={() => setDelayTarget(activity)}
            />
          ))
        )}
      </section>

      <ActivityTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onPick={(item) => {
          setPrefill({ name: item.name, activityType: item.type });
          setTemplateOpen(false);
          setCreateOpen(true);
        }}
        onBlank={() => {
          setPrefill(null);
          setTemplateOpen(false);
          setCreateOpen(true);
        }}
      />

      <CreateActivityDialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setEditingTarget(null);
            setPrefill(null);
          }
        }}
        phases={project.timeline}
        initial={editingTarget}
        prefill={prefill}
        assigneeOptions={assigneeOptions}
        isSubmitting={createActivity.isPending || updateActivity.isPending}
        error={
          createActivity.error || updateActivity.error
            ? ((createActivity.error ?? updateActivity.error) as Error).message
            : null
        }
        onSubmit={(values) => {
          if (editingTarget) {
            updateActivity.mutate(
              {
                projectId: project.id,
                activityId: editingTarget.id,
                ...values,
                location: values.location || null,
                notes: values.notes || null,
              },
              {
                onSuccess: () => {
                  setCreateOpen(false);
                  setEditingTarget(null);
                },
              },
            );
            return;
          }
          createActivity.mutate(
            { projectId: project.id, ...values },
            { onSuccess: () => setCreateOpen(false) },
          );
        }}
      />

      <RaiseDelayDialog
        open={delayTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDelayTarget(null);
        }}
        activityName={delayTarget?.name ?? ""}
        reasons={reasons}
        isSubmitting={raiseDelay.isPending}
        error={
          raiseDelay.error ? (raiseDelay.error as Error).message : null
        }
        onSubmit={(values) => {
          if (!delayTarget) return;
          raiseDelay.mutate(
            {
              projectId: project.id,
              activityId: delayTarget.id,
              ...values,
            },
            { onSuccess: () => setDelayTarget(null) },
          );
        }}
      />
    </div>
  );
}

function ActivityCard({
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
        <Stat label="Actual" value={actualDays !== null ? `${actualDays} d` : "-"} />
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
        onConfirm={() => deleteActivity.mutate({ projectId, activityId: activity.id })}
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
