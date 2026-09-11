import { useState } from "react";
import { ActivitiesTable } from "./activities/activities-table";
import {
  ACTIVITY_STATUS_FILTERS,
  matchesActivitySearch,
  type ActivityStatusFilter,
} from "./activities/activity-helpers";

import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import {
  CreateActivityDialog,
  type ActivityPrefill,
} from "@/components/molecules/create-activity-dialog";
import { ActivityTemplateDialog } from "@/components/molecules/activity-template-dialog";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDelayDialog } from "@/components/molecules/raise-delay-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCreateActivity,
  useDeleteActivity,
  useProjectActivities,
  useRaiseDelay,
  useUpdateActivity,
} from "@/hooks/use-activities";
import { useDelayReasons } from "@/hooks/use-delay-reasons";
import { icons } from "@/assets/icons/icons";
import { canResourceAction, type Activity } from "@/lib/project-types";

export default function ProjectActivities() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canManage = Boolean(access && canResourceAction(access, "schedule", "manage"));
  const { data: activities = [], isPending } = useProjectActivities(project.id, selectedBuildingId);
  const { data: reasons = [] } = useDelayReasons();

  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [prefill, setPrefill] = useState<ActivityPrefill | null>(null);
  const [editingTarget, setEditingTarget] = useState<Activity | null>(null);
  const [delayTarget, setDelayTarget] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>("all");

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const raiseDelay = useRaiseDelay();

  const { data: participants = [] } = useParticipants(project.id, canManage);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  const inProgressCount = activities.filter((a) => a.status === "InProgress").length;
  const delayedCount = activities.filter((a) => a.isDelayed).length;
  const completedCount = activities.filter((a) => a.status === "Completed").length;

  const filtered = activities
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => matchesActivitySearch(a, search));

  function startNewActivity(): void {
    setEditingTarget(null);
    setPrefill(null);
    setTemplateOpen(true);
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Site activity"
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={startNewActivity}>
              <PlusIcon className="size-4" />
              Add activity
            </Button>
          ) : undefined
        }
      />

      {activities.length > 0 ? (
        <section aria-label="Activity summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total activities" icon={icons.calendarSearch} value={activities.length} />
          <KpiCard label="In progress" icon={icons.penSquare} value={inProgressCount} />
          <KpiCard label="Delayed" icon={icons.hourglass} value={delayedCount} />
          <KpiCard label="Completed" icon={icons.verifiedCheck} value={completedCount} />
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 rounded-lg border border-[#EDEDED] bg-white lg:max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities"
            aria-label="Search activities"
          />
        </div>
        <FilterTabs
          items={ACTIVITY_STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter activities"
        />
      </div>

      <ActivitiesTable
        activities={filtered}
        totalCount={activities.length}
        isPending={isPending}
        canManage={canManage}
        onEdit={(activity) => {
          setEditingTarget(activity);
          setCreateOpen(true);
        }}
        onRaiseDelay={setDelayTarget}
        onDelete={setDeleteTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        loading={deleteActivity.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteActivity.mutate(
            { projectId: project.id, activityId: deleteTarget.id },
            { onSettled: () => setDeleteTarget(null) },
          );
        }}
        title="Delete activity"
        description="This permanently removes the activity and its logged delays. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

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
          const { actualStartAt: _as, actualEndAt: _ae, ...createValues } = values;
          createActivity.mutate(
            { projectId: project.id, ...createValues },
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
        error={raiseDelay.error ? (raiseDelay.error as Error).message : null}
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
