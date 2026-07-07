import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  ChevronRightIcon,
  MaterialsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { ImportBoqDialog } from "@/components/molecules/import-boq-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { toast } from "@/lib/toast";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateMaterialOrder,
  useDeleteMaterialOrder,
  useMaterialOrders,
  useUpdateMaterialOrder,
  type MaterialOrderInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { MetricCard } from "./materials/metric-card";
import { MaterialOrderRow } from "./materials/material-order-row";
import { LifecyclePanel } from "./materials/lifecycle-panel";
import { MaterialOrderDialog } from "./materials/material-order-dialog";
import { STATUS_META, STATUS_FILTERS } from "./materials/shared";

export default function ProjectMaterials() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const canRequest = canManage && canResourceAction(access, "materials", "request");
  const canApprove = canManage && canResourceAction(access, "materials", "approve");
  const [filter, setFilter] = useState<MaterialOrderStatus | "all">("all");
  const { data: orders = [], isLoading } = useMaterialOrders(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialOrder | null>(null);
  const createOrder = useCreateMaterialOrder();
  const updateOrder = useUpdateMaterialOrder();
  const deleteOrder = useDeleteMaterialOrder();

  const committed = orders.reduce((sum, order) => sum + order.estimatedCost, 0);
  const received = orders.filter(
    (order) => order.status === "Delivered",
  ).length;
  const critical = orders.filter(
    (order) => order.priority === "Critical",
  ).length;

  function upsert(values: MaterialOrderInput): void {
    if (editTarget) {
      updateOrder.mutate(
        { projectId: project.id, orderId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createOrder.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Materials & equipment"
        description="Request materials, track deliveries, and connect every order to phases, site activities, receipts, and project cost control."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/project/${project.id}/equipment-requests`}
              className="inline-flex h-[32px] items-center justify-center gap-2.5 rounded-lg bg-[#F6F6F6] px-5 py-3 text-[13px] font-semibold text-gray-900 hover:bg-gray-200"
            >
              Equipment requests
              <ChevronRightIcon className="size-4" />
            </Link>
            {canRequest && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setImportOpen(true)}
              >
                Import from BoQ
              </Button>
            )}
            {canRequest && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon className="size-4" />
                New material order
              </Button>
            )}
          </div>
        }
      />

      <ImportBoqDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={project.id}
        currency={project.currency}
        onImported={(count) =>
          toast(
            `Added ${count} material${count === 1 ? "" : "s"} from the BoQ.`,
            "success",
          )
        }
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open material orders"
          value={orders.length.toString()}
          helper="Requests through delivery"
        />
        <MetricCard
          label="Committed material cost"
          value={formatCurrency(committed, project.currency, { compact: true })}
          helper="Estimated against finance"
        />
        <MetricCard
          label="Lifecycle health"
          value={`${received} delivered`}
          helper={
            critical ? `${critical} critical priority` : "No critical orders"
          }
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="lg" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Material orders & requests
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Every row carries schedule, activity, document, and finance
                context.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    filter === item
                      ? "bg-[#004DE7] text-white"
                      : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {item === "all" ? "All" : STATUS_META[item].label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Loading material orders…
            </p>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<MaterialsIcon className="size-8 text-gray-300" />}
              title="No material orders yet"
              description="Create the first request and tie it to the phase and site activity it unlocks."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  Create order
                </Button>
              }
              className="py-10"
            />
          ) : (
            <div className="flex flex-col divide-y divide-[#F0F0F0]">
              {orders.map((order) => (
                <MaterialOrderRow
                  key={order.id}
                  order={order}
                  canRequest={canRequest}
                  canApprove={canApprove}
                  onEdit={() => setEditTarget(order)}
                  onDelete={() => setDeleteTarget(order)}
                  onAdvance={(status) =>
                    updateOrder.mutate({
                      projectId: project.id,
                      orderId: order.id,
                      status,
                    })
                  }
                />
              ))}
            </div>
          )}
        </Card>

        <LifecyclePanel projectId={project.id} orders={orders} />
      </section>

      <MaterialOrderDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        projectId={project.id}
        initial={editTarget}
        onSubmit={upsert}
        isSubmitting={createOrder.isPending || updateOrder.isPending}
        error={
          editTarget
            ? ((updateOrder.error as Error | null)?.message ?? null)
            : ((createOrder.error as Error | null)?.message ?? null)
        }
        currency={project.currency}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete material order?"
        description="This removes the material request from the lifecycle board. Delivered finance receipts remain in finance history."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteOrder.mutate(
              { projectId: project.id, orderId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) },
            );
          }
        }}
      />
    </div>
  );
}
