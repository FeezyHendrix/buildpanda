import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useBuildings,
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
  useCloneProgramme,
} from "@/hooks/use-buildings";
import { canResourceAction } from "@/lib/project-types";
import { ProgressBar } from "@/components";
import type { Building, BuildingStatus } from "@/api/buildings";
import {
  UpsertBuildingDialog,
  type UpsertBuildingValues,
} from "@/components/molecules/upsert-building-dialog";
import { CloneProgrammeDialog } from "@/components/molecules/clone-programme-dialog";

function StatusCell({ status }: { status: BuildingStatus }) {
  if (status === "active")
    return (
      <Badge tone="info" size="sm">
        Active
      </Badge>
    );
  if (status === "completed")
    return (
      <Badge tone="success" size="sm">
        Completed
      </Badge>
    );
  if (status === "on_hold")
    return (
      <Badge tone="warning" size="sm">
        On Hold
      </Badge>
    );
  return <span className="text-sm text-ink-muted">Planned</span>;
}

export default function ProjectBuildings() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "buildings", "manage"));
  const { data: buildings = [], isLoading } = useBuildings(project.id);
  const realBuildings = buildings.filter((b) => b.kind === "real");

  const createBuilding = useCreateBuilding();
  const updateBuilding = useUpdateBuilding();
  const deleteBuilding = useDeleteBuilding();
  const cloneProgramme = useCloneProgramme();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Building | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
  const [cloneTarget, setCloneTarget] = useState<Building | null>(null);

  function handleCreate(values: UpsertBuildingValues): void {
    createBuilding.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertBuildingValues): void {
    if (!editTarget) return;
    updateBuilding.mutate(
      { projectId: project.id, buildingId: editTarget.id, ...values },
      { onSuccess: () => setEditTarget(null) },
    );
  }

  function handleClone(fromBuildingId: string): void {
    if (!cloneTarget) return;
    cloneProgramme.mutate(
      { projectId: project.id, buildingId: cloneTarget.id, fromBuildingId },
      { onSuccess: () => setCloneTarget(null) },
    );
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Buildings"
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="-ml-1 mr-1.5 size-4" />
              Add building
            </Button>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        {realBuildings.map((b) => (
          <div
            key={b.id}
            className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border border-line-hair bg-white p-4 shadow-card"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link
                  to={`/project/${project.id}/buildings/${b.id}/stages`}
                  className="text-base font-semibold text-ink hover:text-primary-500 transition-colors"
                >
                  {b.name}
                </Link>
                {b.code && (
                  <Badge tone="neutral" size="sm">
                    {b.code}
                  </Badge>
                )}
                <StatusCell status={b.status} />
              </div>
            </div>

            <div className="flex w-full sm:w-48 flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Progress</span>
                <span className="font-medium text-ink">{b.progressPercent}%</span>
              </div>
              <ProgressBar value={b.progressPercent} className="h-2" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setCloneTarget(b)}
                disabled={!canManage}
              >
                Clone Programme
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditTarget(b)}
                disabled={!canManage}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                onClick={() => setDeleteTarget(b)}
                disabled={!canManage}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}

        {realBuildings.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line py-12 text-center">
            <h3 className="mt-2 text-sm font-semibold text-ink">No buildings</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Get started by adding a building to this project.
            </p>
            {canManage && (
              <div className="mt-6">
                <Button onClick={() => setCreateOpen(true)}>
                  <PlusIcon className="-ml-1 mr-1.5 size-4" />
                  Add building
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <UpsertBuildingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createBuilding.isPending}
      />

      <UpsertBuildingDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        mode="edit"
        initial={editTarget ? { ...editTarget, code: editTarget.code ?? undefined } : undefined}
        onSubmit={handleEdit}
        isSubmitting={updateBuilding.isPending}
      />

      <CloneProgrammeDialog
        open={cloneTarget !== null}
        onOpenChange={(open) => !open && setCloneTarget(null)}
        targetBuilding={cloneTarget}
        buildings={realBuildings}
        onSubmit={handleClone}
        isSubmitting={cloneProgramme.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete building"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteBuilding.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteBuilding.mutate(
              { projectId: project.id, buildingId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) },
            );
          }
        }}
      />
    </div>
  );
}
