import { useState } from "react";
import { CreateButton } from "@/components/molecules/create-button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useBuildings,
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
  useCloneProgramme,
} from "@/hooks/use-buildings";
import { canResourceAction } from "@/lib/project-types";
import type { Building, BuildingStatus } from "@/api/buildings";
import {
  UpsertBuildingDialog,
  type UpsertBuildingValues,
} from "@/components/molecules/upsert-building-dialog";
import { CloneProgrammeDialog } from "@/components/molecules/clone-programme-dialog";
import { cn } from "@/lib/utils";
import { BuildingRow } from "./buildings/building-row";
import { BUILDING_STATUS_LABEL } from "./buildings/building-status-badge";

const FILTER_ORDER: BuildingStatus[] = ["planned", "completed", "active", "on_hold"];

export default function ProjectBuildings() {
  useSetPageTitle("Manage Buildings", "Add, edit and track the buildings that make up this project.");
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "buildings", "manage"));
  const { data: buildings = [], isLoading } = useBuildings(project.id);
  const realBuildings = buildings.filter((b) => b.kind === "real");
  // No pill is on until one is picked, so every building shows by default;
  // picking the active pill again clears it.
  const [statusFilter, setStatusFilter] = useState<BuildingStatus | null>(null);
  const visibleBuildings = statusFilter ? realBuildings.filter((b) => b.status === statusFilter) : realBuildings;

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
    <div className="w-full px-4 pb-8 pt-6 lg:px-8">
      <div className="mx-auto max-w-[925px]">
        {canManage ? (
          <div className="flex justify-end">
            <CreateButton onClick={() => setCreateOpen(true)}>Add Buildings</CreateButton>
          </div>
        ) : null}

        <div role="group" aria-label="Filter buildings by status" className="mt-6 flex flex-wrap gap-2">
          {FILTER_ORDER.map((status) => {
            const on = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                onClick={() => setStatusFilter(on ? null : status)}
                className={cn(
                  "h-9 rounded-full border px-4 text-caption-l! font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
                  on
                    ? "border-[#1E1E1E] bg-[#1E1E1E] text-white"
                    : "border-[#EBEBEB] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
                )}
              >
                {BUILDING_STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {visibleBuildings.length > 0 ? (
            <div className="divide-y divide-[#EBEBEB] border border-[#EBEBEB] bg-white">
              {visibleBuildings.map((b) => (
                <BuildingRow
                  key={b.id}
                  building={b}
                  stagesHref={`/project/${project.id}/buildings/${b.id}/stages`}
                  canManage={canManage}
                  onClone={() => setCloneTarget(b)}
                  onEdit={() => setEditTarget(b)}
                  onDelete={() => setDeleteTarget(b)}
                />
              ))}
            </div>
          ) : null}

          {visibleBuildings.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-[#EBEBEB] py-12 text-center">
              <h3 className="mt-2 text-caption-l! font-semibold text-ink">
                {realBuildings.length === 0 ? "No buildings" : `No ${BUILDING_STATUS_LABEL[statusFilter!].toLowerCase()} buildings`}
              </h3>
              <p className="mt-1 text-caption-l! text-ink-muted">
                {realBuildings.length === 0
                  ? "Get started by adding a building to this project."
                  : "Pick another status, or select this one again to see every building."}
              </p>
            </div>
          ) : null}
        </div>
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
