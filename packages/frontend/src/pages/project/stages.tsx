import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertStageDialog,
  type UpsertStageValues,
} from "@/components/molecules/upsert-stage-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateStage,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/hooks/use-stages";
import { cn } from "@/lib/utils";
import type { Stage, StageStatus } from "@/lib/project-types";

const STATUS_META: Record<StageStatus, { label: string; tone: "neutral" | "info" | "success" }> = {
  Pending: { label: "Not started", tone: "neutral" },
  InProgress: { label: "In progress", tone: "info" },
  Done: { label: "Complete", tone: "success" },
};

export default function ProjectStages() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: stages = [], isLoading } = useStages(project.id);
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [createOpen, setCreateOpen] = useState(false);

  const complete = stages.filter((s) => s.status === "Done").length;
  const overall =
    stages.length === 0
      ? 0
      : Math.round(stages.reduce((sum, s) => sum + s.progressPercent, 0) / stages.length);

  function handleCreate(values: UpsertStageValues): void {
    createStage.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return;
    next[index] = swap;
    next[target] = current;
    reorderStages.mutate({ projectId: project.id, stageIds: next.map((s) => s.id) });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Build Stages"
        description="Break the build into stages and track progress all the way to handover."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Add stage
          </Button>
        ) : undefined}
      />

      {stages.length > 0 && (
        <Card padding="md" className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Overall progress</p>
              <p className="text-xs text-gray-500">
                {complete} of {stages.length} stages complete
              </p>
            </div>
            <span className="text-2xl font-bold text-gray-900">{overall}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
            <div className="h-full rounded-full bg-[#004DE7]" style={{ width: `${overall}%` }} />
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading stages…</p>
        ) : stages.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">No stages yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Add your first stage to start tracking the build.
            </p>
          </Card>
        ) : (
          stages.map((stage, index) => (
            <StageRow
              key={stage.id}
              stage={stage}
              index={index}
              total={stages.length}
              projectId={project.id}
              onMove={move}
              onUpdate={(values) =>
                updateStage.mutate({ projectId: project.id, stageId: stage.id, ...values })
              }
              onDelete={() => deleteStage.mutate({ projectId: project.id, stageId: stage.id })}
            />
          ))
        )}
      </div>

      <UpsertStageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createStage.isPending}
        error={(createStage.error as Error | undefined)?.message ?? null}
      />
    </div>
  );
}

function StageRow({
  stage,
  index,
  total,
  onMove,
  onUpdate,
  onDelete,
}: {
  stage: Stage;
  index: number;
  total: number;
  projectId: string;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdate: (values: UpsertStageValues) => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const meta = STATUS_META[stage.status];

  return (
    <Card padding="md" className="flex items-center gap-4">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          className="text-gray-400 hover:text-gray-900 disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          className="text-gray-400 hover:text-gray-900 disabled:opacity-30"
        >
          ▼
        </button>
      </div>

      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F6F6F6] text-sm font-semibold text-gray-500">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{stage.name}</p>
          <Badge tone={meta.tone} size="sm">
            {meta.label}
          </Badge>
          {stage.dateRange && (
            <span className="text-xs text-gray-500">{stage.dateRange}</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div
              className={cn(
                "h-full rounded-full",
                stage.status === "Done" ? "bg-[#1B8E45]" : "bg-[#004DE7]",
              )}
              style={{ width: `${stage.progressPercent}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs tabular-nums text-gray-500">
            {stage.progressPercent}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="text-xs font-medium text-red-500 hover:text-red-600"
        >
          Delete
        </button>
      </div>

      <UpsertStageDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          name: stage.name,
          status: stage.status,
          startDate: stage.startDate,
          endDate: stage.endDate,
          progressPercent: stage.progressPercent,
        }}
        onSubmit={(values) => {
          onUpdate(values);
          setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete stage"
        description="This removes the stage from the build plan. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}
