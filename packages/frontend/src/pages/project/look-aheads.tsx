import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertLookAheadDialog,
  type LookAheadFormValues,
} from "@/components/molecules/upsert-look-ahead-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import {
  useAutoWindow,
  useCreateLookAhead,
  useDeleteLookAhead,
  useLookAheads,
  useUpdateLookAhead,
} from "@/hooks/use-look-aheads";
import { useMaterialStock } from "@/hooks/use-materials-ledger";
import { STATUS_META as ORDER_STATUS_META } from "./materials/shared";
import { canResourceAction } from "@/lib/project-types";
import type { AutoWindowActivity, LookAhead } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { LookAheadDetailDrawer } from "./look-aheads/look-ahead-detail-drawer";
import { LookAheadsTable } from "./look-aheads/look-aheads-table";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function ProjectLookAheads() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canManage = canResourceAction(access, "schedule", "manage");

  const { data: lookAheads = [], isLoading } = useLookAheads(
    project.id,
    {
      ...(selectedBuildingId ? { buildingId: selectedBuildingId } : {}),
    },
  );
  const { data: autoWindow, isLoading: autoWindowLoading } = useAutoWindow(project.id, 4);
  const { data: stock = [] } = useMaterialStock(project.id);
  const lowStock = stock.filter((s) => s.lowStock);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookAhead | null>(null);
  const [viewTarget, setViewTarget] = useState<LookAhead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookAhead | null>(null);

  const createLookAhead = useCreateLookAhead();
  const updateLookAhead = useUpdateLookAhead();
  const deleteLookAhead = useDeleteLookAhead();

  const activityCoverage = useMemo(
    () => new Map((autoWindow?.activities ?? []).map((activity) => [activity.activityId, activity.hasMaterialCoverage])),
    [autoWindow?.activities],
  );

  function handleSubmit(values: LookAheadFormValues): void {
    if (editTarget) {
      const initialIds = new Set(editTarget.activities.map((a) => a.activityId));
      const nextIds = new Set(values.activityIds);
      const assignActivityIds = values.activityIds.filter((id) => !initialIds.has(id));
      const unassignActivityIds = editTarget.activities
        .map((a) => a.activityId)
        .filter((id) => !nextIds.has(id));

      updateLookAhead.mutate(
        {
          projectId: project.id,
          lookAheadId: editTarget.id,
          name: values.name,
          description: values.description,
          status: values.status,
          startDate: values.startDate,
          endDate: values.endDate,
          totalWorkers: values.totalWorkers,
          assignActivityIds,
          unassignActivityIds,
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditTarget(null);
            toast("Look ahead updated", "success");
          },
          onError: () => toast("Could not update look ahead"),
        },
      );
    } else {
      createLookAhead.mutate(
        { projectId: project.id, ...values },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast("Look ahead created", "success");
          },
          onError: () => toast("Could not create look ahead"),
        },
      );
    }
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs items={[{ label: "Site Control" }, { label: "Look Aheads" }]} className="mb-4" />
      <PageHeader
        title="Look Aheads"
        description="Plan rolling look-ahead periods by picking activities from the project chart or imported programme, and preview what's coming up next."
      />

      {lowStock.length > 0 && (
        <section className="mt-8 flex flex-wrap items-center gap-2 rounded-[16px] border border-[#FED7AA] bg-[#FFF7ED] p-4">
          <p className="mr-2 text-[13px] font-semibold text-[#9A5B13]">
            {lowStock.length} material{lowStock.length === 1 ? "" : "s"} running low
          </p>
          {lowStock.slice(0, 6).map((s) => (
            <Badge key={s.materialId} tone="warning" size="sm">
              {s.materialName}: {s.onHandQty} {s.unit}
            </Badge>
          ))}
          {lowStock.length > 6 && <Badge tone="warning" size="sm">+{lowStock.length - 6} more</Badge>}
        </section>
      )}

      <section className="mt-8 rounded-[18px] border border-[#EDEDED] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Coming up{autoWindow ? ` (${formatDate(autoWindow.from)} – ${formatDate(autoWindow.to)})` : ""}
        </h2>
        {autoWindowLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : !autoWindow || autoWindow.activities.length === 0 ? (
          <Card padding="md" className="mt-3 text-sm text-gray-500">
            Nothing scheduled in the next 4 weeks on the project chart.
          </Card>
        ) : (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {autoWindow.activities.slice(0, 4).map((activity) => (
              <AutoWindowCard key={activity.activityId} activity={activity} />
            ))}
            {autoWindow.activities.length > 4 && (
              <Card padding="md" className="flex items-center justify-center rounded-[16px] border-dashed text-sm text-gray-500">
                +{autoWindow.activities.length - 4} more scheduled activities
              </Card>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : (
          <LookAheadsTable
            lookAheads={lookAheads}
            canManage={canManage}
            activityCoverage={activityCoverage}
            onCreate={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            onView={setViewTarget}
            onEdit={(lookAhead) => {
              setViewTarget(null);
              setEditTarget(lookAhead);
              setFormOpen(true);
            }}
            onDelete={setDeleteTarget}
          />
        )}
      </section>

      <UpsertLookAheadDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditTarget(null);
        }}
        projectId={project.id}
        initial={editTarget}
        isSubmitting={createLookAhead.isPending || updateLookAhead.isPending}
        error={
          createLookAhead.error
            ? (createLookAhead.error as Error).message
            : updateLookAhead.error
              ? (updateLookAhead.error as Error).message
              : null
        }
        onSubmit={handleSubmit}
      />

      <LookAheadDetailDrawer
        open={viewTarget !== null}
        lookAhead={viewTarget}
        canManage={canManage}
        onOpenChange={(next) => {
          if (!next) setViewTarget(null);
        }}
        onEdit={(lookAhead) => {
          setViewTarget(null);
          setEditTarget(lookAhead);
          setFormOpen(true);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "this look ahead"}?`}
        description="This removes the look-ahead period. The activities it referenced stay on the project chart."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteLookAhead.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteLookAhead.mutate(
            { projectId: project.id, lookAheadId: deleteTarget.id },
            {
              onSuccess: () => {
                setDeleteTarget(null);
                toast("Look ahead deleted", "success");
              },
              onError: () => toast("Could not delete look ahead"),
            },
          );
        }}
      />
    </div>
  );
}

function AutoWindowCard({ activity }: { activity: AutoWindowActivity }) {
  return (
    <Card padding="md" className="rounded-[16px] border-none bg-[#F8F8F8]">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-black-500">{activity.activityName}</p>
            {activity.phaseName && <Badge tone="neutral" size="sm">{activity.phaseName}</Badge>}
            {activity.fromProgramme && <Badge tone="info" size="sm">From programme</Badge>}
          </div>
          <p className="text-[12px] text-black-300">
            {formatDate(activity.plannedStartAt)} – {formatDate(activity.plannedEndAt)} · Crew{" "}
            {activity.workerCountPlanned}
          </p>
        </div>
        {!activity.hasMaterialCoverage && (
          <Badge tone="danger" size="sm">No materials ordered</Badge>
        )}
      </header>

      {activity.materialOrders.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-[#EDEDED] border-t border-[#EDEDED]">
          {activity.materialOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-medium text-black-500">
                  {order.quantity} {order.unit} · {order.materialName}
                </p>
                <p className="text-[12px] text-black-300">
                  {order.supplier ?? "No supplier set"} · Needed by {formatDate(order.neededBy)}
                </p>
              </div>
              <Badge tone={ORDER_STATUS_META[order.status].tone} size="sm">
                {ORDER_STATUS_META[order.status].label}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
