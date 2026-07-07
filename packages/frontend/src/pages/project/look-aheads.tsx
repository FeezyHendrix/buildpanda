import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { CalendarIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertLookAheadDialog,
  type LookAheadFormValues,
} from "@/components/molecules/upsert-look-ahead-dialog";
import { useProjectContext } from "@/layouts/project-layout";
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
import type { AutoWindowActivity, LookAhead, LookAheadStatus } from "@/lib/project-types";
import { toast } from "@/lib/toast";

const LOOK_AHEAD_STATUS_META: Record<LookAheadStatus, { label: string; tone: "neutral" | "info" | "success" }> = {
  Draft: { label: "Draft", tone: "neutral" },
  UnderReview: { label: "Under Review", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
};

const STATUS_FILTERS: Array<LookAheadStatus | "all"> = ["all", "Draft", "UnderReview", "Approved"];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function ProjectLookAheads() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "schedule", "manage");

  const [filter, setFilter] = useState<LookAheadStatus | "all">("all");
  const { data: lookAheads = [], isLoading } = useLookAheads(
    project.id,
    filter === "all" ? {} : { status: filter },
  );
  const { data: autoWindow, isLoading: autoWindowLoading } = useAutoWindow(project.id, 4);
  const { data: stock = [] } = useMaterialStock(project.id);
  const lowStock = stock.filter((s) => s.lowStock);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LookAhead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookAhead | null>(null);

  const createLookAhead = useCreateLookAhead();
  const updateLookAhead = useUpdateLookAhead();
  const deleteLookAhead = useDeleteLookAhead();

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
        actions={
          canManage && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              New look ahead
            </Button>
          )
        }
      />

      {lowStock.length > 0 && (
        <section className="mt-8 rounded-[16px] border-none bg-[#FFF7ED] p-5">
          <p className="text-[13px] font-semibold text-[#9A5B13]">
            {lowStock.length} material{lowStock.length === 1 ? "" : "s"} running low
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((s) => (
              <Badge key={s.materialId} tone="warning" size="sm">
                {s.materialName}: {s.onHandQty} {s.unit}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Coming up{autoWindow ? ` (${formatDate(autoWindow.from)} – ${formatDate(autoWindow.to)})` : ""}
        </h2>
        {autoWindowLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : !autoWindow || autoWindow.activities.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">
            Nothing scheduled in the next 4 weeks on the project chart.
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {autoWindow.activities.map((activity) => (
              <AutoWindowCard key={activity.activityId} activity={activity} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-3">
        <div className="flex flex-col gap-4 lg:gap-0 lg:flex-row items-start lg:items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Your look aheads</h2>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={
                  filter === s
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full bg-[#F6F6F6] px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                }
              >
                {s === "all" ? "All" : LOOK_AHEAD_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : lookAheads.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="size-8 text-gray-300" />}
            title="No look aheads yet"
            description="Create a look-ahead period and pick the activities it covers from the project chart or imported programme."
            action={
              canManage && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEditTarget(null);
                    setFormOpen(true);
                  }}
                >
                  <PlusIcon className="size-4" />
                  New look ahead
                </Button>
              )
            }
          />
        ) : (
          lookAheads.map((lookAhead) => (
            <Card
              key={lookAhead.id}
              padding="lg"
              className="flex flex-col gap-2 rounded-[16px] border-none bg-[#F8F8F8]"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold text-black-500">{lookAhead.name}</p>
                  <Badge tone={LOOK_AHEAD_STATUS_META[lookAhead.status].tone} size="sm">
                    {LOOK_AHEAD_STATUS_META[lookAhead.status].label}
                  </Badge>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditTarget(lookAhead);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(lookAhead)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </header>
              <p className="text-[12px] text-black-300">
                {formatDate(lookAhead.startDate)} – {formatDate(lookAhead.endDate)}
                {lookAhead.totalWorkers != null && ` · Crew ${lookAhead.totalWorkers}`}
                {" · "}
                {lookAhead.activities.length} activit{lookAhead.activities.length === 1 ? "y" : "ies"}
              </p>
              {lookAhead.description && (
                <p className="text-[13px] text-black-400">{lookAhead.description}</p>
              )}
              {lookAhead.activities.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {lookAhead.activities.map((a) => (
                    <Badge key={a.activityId} tone="neutral" size="sm">
                      {a.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))
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
    <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8]">
      <header className="flex flex-col gap-2 border-b border-[#EDEDED] pb-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-col divide-y divide-[#EDEDED]">
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
