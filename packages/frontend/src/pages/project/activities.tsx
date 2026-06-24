import { useState } from "react";
import { ActivityCard } from "./activities/activity-card";

import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import {
  CreateActivityDialog,
  type ActivityPrefill,
} from "@/components/molecules/create-activity-dialog";
import { ActivityTemplateDialog } from "@/components/molecules/activity-template-dialog";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDelayDialog } from "@/components/molecules/raise-delay-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCreateActivity,
  useProjectActivities,
  useRaiseDelay,
  useUpdateActivity,
} from "@/hooks/use-activities";
import { useDelayReasons } from "@/hooks/use-delay-reasons";
import type { Activity } from "@/lib/project-types";

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
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Schedule", to: `/project/${project.id}/schedule` },
          { label: "Site Activities" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Site Activities"
        description="Track discrete work items with planned vs actual times and delay causes."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={startNewActivity}>
              <PlusIcon className="size-4" />
              New activity
            </Button>
          ) : undefined
        }
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
            action={
              canManage ? (
                <Button variant="primary" size="md" onClick={startNewActivity}>
                  <PlusIcon className="size-4" />
                  Add the first one
                </Button>
              ) : undefined
            }
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
